import AppKit
import SlopCore
import SlopMacSupport
import SlopWebRuntime
import SwiftUI
import UniformTypeIdentifiers

final class FramelessDocumentWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

private extension NSBezierPath {
    var cgPath: CGPath {
        let result = CGMutablePath()
        var points = [NSPoint](repeating: .zero, count: 3)
        for index in 0..<elementCount {
            switch element(at: index, associatedPoints: &points) {
            case .moveTo: result.move(to: points[0])
            case .lineTo: result.addLine(to: points[0])
            case .curveTo, .cubicCurveTo:
                result.addCurve(to: points[2], control1: points[0], control2: points[1])
            case .quadraticCurveTo:
                result.addQuadCurve(to: points[1], control: points[0])
            case .closePath: result.closeSubpath()
            @unknown default: break
            }
        }
        return result
    }
}

private class HoverTrackingView: NSView {
    var hoverChanged: ((Bool) -> Void)?
    private var tracking: NSTrackingArea?

    override func updateTrackingAreas() {
        if let tracking { removeTrackingArea(tracking) }
        let area = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self)
        addTrackingArea(area)
        tracking = area
        super.updateTrackingAreas()
    }

    override func mouseEntered(with event: NSEvent) { hoverChanged?(true) }
    override func mouseExited(with event: NSEvent) { hoverChanged?(false) }
}

private final class ShapedContentView: HoverTrackingView {
    var shape: SlopManifest.WindowShape { didSet { needsLayout = true } }
    private let shapeMask = CAShapeLayer()

    init(frame: NSRect, shape: SlopManifest.WindowShape) {
        self.shape = shape
        super.init(frame: frame)
        wantsLayer = true
        layer?.mask = shapeMask
    }

    required init?(coder: NSCoder) { nil }

    override func layout() {
        super.layout()
        shapeMask.frame = bounds
        shapeMask.path = path(in: bounds).cgPath
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        guard path(in: bounds).contains(point) else { return nil }
        return super.hitTest(point)
    }

    private func path(in rect: NSRect) -> NSBezierPath {
        switch shape.kind {
        case .roundedRect:
            let radius = min(CGFloat(shape.radius ?? 0), min(rect.width, rect.height) / 2)
            return NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        case .capsule:
            let radius = min(rect.width, rect.height) / 2
            return NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        case .circle:
            return NSBezierPath(ovalIn: rect)
        }
    }
}

private final class DragHandleView: NSView {
    static let height: CGFloat = 16

    override var mouseDownCanMoveWindow: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel("Drag to move window")
    }

    required init?(coder: NSCoder) { nil }

    override func resetCursorRects() {
        super.resetCursorRects()
        addCursorRect(bounds, cursor: .openHand)
    }

    override func mouseDown(with event: NSEvent) {
        NSCursor.closedHand.push()
        defer { NSCursor.pop() }
        window?.performDrag(with: event)
    }
}

@MainActor
final class SlopDocumentWindowController: NSWindowController, NSWindowDelegate, SlopRuntimeSessionDelegate {
    let packageURL: URL
    let session: SlopRuntimeSession
    var onClose: (() -> Void)?
    var onOpenDocument: ((URL) -> Void)?

    private var toolbar: NSPanel?
    private var toolbarHost: NSHostingView<ToolbarView>?
    private var hideWork: DispatchWorkItem?
    private var menuTracking = false
    private var previewWork: DispatchWorkItem?
    private var previewTask: Task<Void, Never>?
    private var securityScoped = false

    init(packageURL: URL) throws {
        self.packageURL = packageURL.standardizedFileURL
        securityScoped = self.packageURL.startAccessingSecurityScopedResource()
        session = try SlopRuntimeSession(packageURL: self.packageURL)
        let size = NSSize(width: session.package.manifest.window.width, height: session.package.manifest.window.height)
        let window = FramelessDocumentWindow(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.borderless, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = session.package.manifest.title
        window.minSize = NSSize(width: 320, height: 320)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.isReleasedWhenClosed = false
        window.isRestorable = false
        window.tabbingMode = .disallowed
        window.acceptsMouseMovedEvents = true
        window.center()

        let container = ShapedContentView(
            frame: NSRect(origin: .zero, size: size),
            shape: session.package.manifest.window.shape
        )
        session.webView.frame = NSRect(
            x: 0,
            y: 0,
            width: size.width,
            height: size.height
        )
        session.webView.autoresizingMask = [.width, .height]
        session.webView.setValue(false, forKey: "drawsBackground")
        container.addSubview(session.webView)
        let drag = DragHandleView(frame: NSRect(
            x: 0,
            y: size.height - DragHandleView.height,
            width: size.width,
            height: DragHandleView.height
        ))
        drag.autoresizingMask = [.width, .minYMargin]
        container.addSubview(drag)
        window.contentView = container
        if session.package.manifest.window.shape.kind == .circle {
            window.contentAspectRatio = NSSize(width: 1, height: 1)
        }

        super.init(window: window)
        window.delegate = self
        session.delegate = self
        container.hoverChanged = { [weak self] inside in inside ? self?.showToolbar() : self?.scheduleToolbarHide() }
        setupToolbar()
        session.load()
    }

    required init?(coder: NSCoder) { nil }

    func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) {
        schedulePreview(delay: 0.25)
    }

    func runtimeSessionDidReloadStyle(_ session: SlopRuntimeSession) {
        schedulePreview(delay: 0.15)
    }

    func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopManifest.StoreKind, storeID: String) {
        schedulePreview()
    }

    func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) {
        let alert = NSAlert(error: error)
        alert.messageText = "Could not render this slop"
        alert.beginSheetModal(for: window!)
    }

    private func setupToolbar() {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 42),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        let trackingView = HoverTrackingView(frame: panel.contentView!.bounds)
        trackingView.autoresizingMask = [.width, .height]
        panel.contentView = trackingView
        let host = NSHostingView(rootView: toolbarView())
        host.frame = trackingView.bounds
        host.autoresizingMask = [.width, .height]
        trackingView.addSubview(host)
        trackingView.hoverChanged = { [weak self] inside in
            if inside {
                self?.hideWork?.cancel()
            } else {
                self?.scheduleToolbarHide()
            }
        }
        window?.addChildWindow(panel, ordered: .above)
        panel.orderOut(nil)
        toolbar = panel
        toolbarHost = host
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(menuDidBeginTracking(_:)),
            name: NSMenu.didBeginTrackingNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(menuDidEndTracking(_:)),
            name: NSMenu.didEndTrackingNotification,
            object: nil
        )
    }

    private func toolbarView() -> ToolbarView {
        ToolbarView(
            pinned: window?.level == .floating,
            close: { [weak self] in self?.close() },
            togglePin: { [weak self] in self?.togglePin() },
            duplicate: { [weak self] in self?.duplicateDocument() },
            exportPNG: { [weak self] in self?.chooseExport(.png) },
            exportPDF: { [weak self] in self?.chooseExport(.pdf) },
            share: { [weak self] in self?.shareDocument() },
            reveal: { [weak self] in self?.revealPackage() },
            copyPath: { [weak self] in self?.copyPackagePath() }
        )
    }

    private func showToolbar() {
        hideWork?.cancel()
        guard let panel = toolbar, let window else { return }
        let frame = window.frame
        var x = frame.midX - panel.frame.width / 2
        var y = frame.maxY + 8
        if let visible = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame {
            x = min(max(x, visible.minX + 8), visible.maxX - panel.frame.width - 8)
            if y + panel.frame.height > visible.maxY { y = frame.maxY - panel.frame.height - 10 }
        }
        panel.setFrameOrigin(NSPoint(x: x, y: y))
        panel.orderFront(nil)
    }

    private func scheduleToolbarHide() {
        hideWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            guard !self.menuTracking else { return }
            let pointer = NSEvent.mouseLocation
            if self.window?.frame.contains(pointer) == true || self.toolbar?.frame.contains(pointer) == true {
                return
            }
            self.toolbar?.orderOut(nil)
        }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75, execute: work)
    }

    @objc private func menuDidBeginTracking(_ notification: Notification) {
        guard toolbar?.isVisible == true else { return }
        menuTracking = true
        hideWork?.cancel()
    }

    @objc private func menuDidEndTracking(_ notification: Notification) {
        guard menuTracking else { return }
        menuTracking = false
        scheduleToolbarHide()
    }

    private func togglePin() {
        guard let window else { return }
        window.level = window.level == .floating ? .normal : .floating
        toolbarHost?.rootView = toolbarView()
    }

    private func duplicateDocument() {
        guard let window else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.slop]
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false
        panel.prompt = "Duplicate"
        panel.message = "Choose where to save the copy."
        panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + " copy.slop"
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let self, let requestedURL = panel.url else { return }
            do {
                let title = requestedURL.deletingPathExtension().lastPathComponent
                let url = try SlopDuplicator.duplicate(from: self.packageURL, to: requestedURL, title: title)
                self.onOpenDocument?(url)
            } catch {
                self.showError("Could not duplicate document", error)
            }
        }
    }

    func duplicateFromMenu() { duplicateDocument() }
    func exportPNGFromMenu() { chooseExport(.png) }
    func exportPDFFromMenu() { chooseExport(.pdf) }
    func shareFromMenu() { shareDocument() }
    func togglePinFromMenu() { togglePin() }
    var isPinned: Bool { window?.level == .floating }

    func owns(_ candidate: NSWindow?) -> Bool {
        guard let candidate else { return false }
        return candidate === window || candidate === toolbar
    }

    private enum ExportKind { case png, pdf }

    private func chooseExport(_ kind: ExportKind) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [kind == .png ? .png : .pdf]
        panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + (kind == .png ? ".png" : ".pdf")
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task {
            do {
                let data = try await SlopDocumentRenderer.render(packageURL: packageURL, format: kind == .png ? .png : .pdf)
                try data.write(to: url, options: .atomic)
            } catch { showError("Export failed", error) }
        }
    }

    private func shareDocument() {
        guard let view = toolbar?.contentView else { return }
        NSSharingServicePicker(items: [packageURL]).show(relativeTo: view.bounds, of: view, preferredEdge: .minY)
    }

    private func revealPackage() {
        NSWorkspace.shared.activateFileViewerSelecting([packageURL])
    }

    private func copyPackagePath() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(packageURL.path, forType: .string)
    }

    private func schedulePreview(delay: TimeInterval = 0.5) {
        previewWork?.cancel()
        previewTask?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.previewTask = Task { @MainActor [weak self] in
                guard let self else { return }
                do {
                    let png = try await SlopDocumentRenderer.preview(webView: self.session.webView)
                    try Task.checkCancellation()
                    let shape = (try? SlopManifestIO.read(from: self.packageURL).window.shape)
                        ?? self.session.package.manifest.window.shape
                    try SlopPreviewAssets.install(png, into: self.packageURL, shape: shape)
                } catch is CancellationError {
                    // A newer document change superseded this derived preview.
                } catch {
                    // Quick Look images are derived and never block document writes.
                }
            }
        }
        previewWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    func windowDidMove(_ notification: Notification) { if toolbar?.isVisible == true { showToolbar() } }
    func windowDidResize(_ notification: Notification) { if toolbar?.isVisible == true { showToolbar() } }

    func windowWillClose(_ notification: Notification) {
        NotificationCenter.default.removeObserver(self)
        previewWork?.cancel()
        previewTask?.cancel()
        session.close()
        if securityScoped { packageURL.stopAccessingSecurityScopedResource() }
        toolbar?.orderOut(nil)
        if let toolbar { window?.removeChildWindow(toolbar) }
        toolbar?.close()
        toolbar = nil
        onClose?()
    }

    private func showError(_ title: String, _ error: Error) {
        let alert = NSAlert(error: error)
        alert.messageText = title
        alert.runModal()
    }
}

private struct ToolbarView: View {
    let pinned: Bool
    let close: () -> Void
    let togglePin: () -> Void
    let duplicate: () -> Void
    let exportPNG: () -> Void
    let exportPDF: () -> Void
    let share: () -> Void
    let reveal: () -> Void
    let copyPath: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            button("xmark", "Close", close)
            button(pinned ? "pin.fill" : "pin", pinned ? "Unpin" : "Always on Top", togglePin)
            divider
            button("doc.on.doc", "Duplicate", duplicate)
            Menu {
                Button("Export PNG", action: exportPNG)
                Button("Export PDF", action: exportPDF)
            } label: {
                Image(systemName: "arrow.down.doc").frame(width: 25, height: 25)
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            button("square.and.arrow.up", "Share", share)
            Menu {
                Button("Reveal in Finder", action: reveal)
                Button("Copy Package Path", action: copyPath)
            } label: {
                Image(systemName: "ellipsis").frame(width: 25, height: 25)
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.18)))
        .padding(2)
    }

    private var divider: some View { Rectangle().fill(.primary.opacity(0.16)).frame(width: 1, height: 16).padding(.horizontal, 3) }

    private func button(_ icon: String, _ help: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: icon).frame(width: 25, height: 25).contentShape(Rectangle()) }
            .buttonStyle(.plain).help(help)
    }
}
