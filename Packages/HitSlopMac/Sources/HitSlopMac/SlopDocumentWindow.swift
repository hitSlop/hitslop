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

private final class HoverTrackingView: NSView {
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

private final class DragHandleView: NSView {
    override var mouseDownCanMoveWindow: Bool { true }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setAccessibilityElement(true)
        setAccessibilityRole(.group)
        setAccessibilityLabel("Drag to move window")
    }

    required init?(coder: NSCoder) { nil }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let grip = NSRect(x: bounds.midX - 20, y: bounds.midY - 2, width: 40, height: 4)
        NSColor.labelColor.withAlphaComponent(0.24).setFill()
        NSBezierPath(roundedRect: grip, xRadius: 2, yRadius: 2).fill()
    }

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

        let container = HoverTrackingView(frame: NSRect(origin: .zero, size: size))
        container.wantsLayer = true
        container.layer?.cornerRadius = 22
        container.layer?.cornerCurve = .continuous
        container.layer?.masksToBounds = true
        session.webView.frame = container.bounds
        session.webView.autoresizingMask = [.width, .height]
        session.webView.setValue(false, forKey: "drawsBackground")
        container.addSubview(session.webView)
        let drag = DragHandleView(frame: NSRect(x: size.width / 2 - 36, y: size.height - 22, width: 72, height: 22))
        drag.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin]
        container.addSubview(drag)
        window.contentView = container

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
            contentRect: NSRect(x: 0, y: 0, width: session.package.isSourceCurrent ? 244 : 352, height: 42),
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
            needsBuild: !session.package.isSourceCurrent,
            close: { [weak self] in self?.close() },
            togglePin: { [weak self] in self?.togglePin() },
            duplicate: { [weak self] in self?.duplicateDocument() },
            exportPNG: { [weak self] in self?.chooseExport(.png) },
            exportPDF: { [weak self] in self?.chooseExport(.pdf) },
            share: { [weak self] in self?.shareDocument() }
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
        do {
            let destination = SlopDuplicator.nextDuplicateURL(for: packageURL)
            let url = try SlopDuplicator.duplicate(from: packageURL, to: destination)
            onOpenDocument?(url)
        } catch { showError("Could not duplicate document", error) }
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
                    try SlopPreviewAssets.install(png, into: self.packageURL)
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
    let needsBuild: Bool
    let close: () -> Void
    let togglePin: () -> Void
    let duplicate: () -> Void
    let exportPNG: () -> Void
    let exportPDF: () -> Void
    let share: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            if needsBuild {
                Label("Needs rebuild", systemImage: "hammer").font(.caption2).foregroundStyle(.orange)
                divider
            }
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
