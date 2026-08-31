import AppKit
import HitSlopCore
import HitSlopRuntime
import SwiftUI
import UniformTypeIdentifiers

private final class FramelessDocumentWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

private class HoverView: NSView {
    var changed: ((Bool) -> Void)?
    private var area: NSTrackingArea?
    override func updateTrackingAreas() {
        if let area { removeTrackingArea(area) }
        let next = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self)
        addTrackingArea(next); area = next; super.updateTrackingAreas()
    }
    override func mouseEntered(with event: NSEvent) { changed?(true) }
    override func mouseExited(with event: NSEvent) { changed?(false) }
}

private final class ShapedView: HoverView {
    let windowMask: SlopWindowMask
    private let maskLayer: CALayer
    init(frame: NSRect, windowMask: SlopWindowMask) {
        self.windowMask = windowMask
        maskLayer = windowMask.makeLayer()
        super.init(frame: frame)
        wantsLayer = true
        windowMask.installBacking(on: layer)
        layer?.mask = maskLayer
    }
    required init?(coder: NSCoder) { nil }
    override func layout() { super.layout(); windowMask.update(maskLayer, bounds: bounds) }
    override func hitTest(_ point: NSPoint) -> NSView? { windowMask.contains(point, in: bounds) ? super.hitTest(point) : nil }
}

@MainActor final class SlopToolbarDragHandleView: NSImageView {
    var onDrag: (NSEvent) -> Void

    init(onDrag: @escaping (NSEvent) -> Void) {
        self.onDrag = onDrag
        super.init(frame: .zero)
        image = NSImage(systemSymbolName: "circle.grid.3x3.fill", accessibilityDescription: "Drag window")?
            .withSymbolConfiguration(.init(pointSize: 8, weight: .medium))
        imageScaling = .scaleProportionallyDown
        contentTintColor = .secondaryLabelColor
        setAccessibilityElement(true)
        setAccessibilityLabel("Drag window")
    }

    required init?(coder: NSCoder) { nil }
    override func resetCursorRects() { super.resetCursorRects(); addCursorRect(bounds, cursor: .openHand) }
    override func mouseDown(with event: NSEvent) { onDrag(event) }
}

private struct ToolbarDragHandle: NSViewRepresentable {
    let onDrag: (NSEvent) -> Void

    func makeNSView(context: Context) -> SlopToolbarDragHandleView { SlopToolbarDragHandleView(onDrag: onDrag) }
    func updateNSView(_ view: SlopToolbarDragHandleView, context: Context) { view.onDrag = onDrag }
}

@MainActor public final class SlopDocumentWindowController: NSWindowController, NSWindowDelegate, SlopRuntimeSessionDelegate {
    public let packageURL: URL
    public let session: SlopRuntimeSession
    public var onClose: (() -> Void)?
    public var onOpenDocument: ((URL) -> Void)?
    private let opened: SlopOpenedDocument
    private var toolbar: NSPanel?, toolbarHost: NSHostingView<SlopToolbar>?, hideWork: DispatchWorkItem?
    private var failedOverlay: NSHostingView<FailureOverlay>?, previewWork: DispatchWorkItem?

    public init(packageURL: URL) throws {
        let opened = try SlopOpenedDocument(presentedURL: packageURL)
        self.opened = opened
        self.packageURL = opened.presentedURL
        session = opened.session
        let windowMask = try SlopWindowMask(package: session.package)
        let spec = session.package.manifest.presentation, size = NSSize(width: spec.width, height: spec.height)
        let window = FramelessDocumentWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless, .resizable], backing: .buffered, defer: false)
        window.title = session.package.manifest.title; window.minSize = NSSize(width: 240, height: 180); window.isOpaque = false
        window.backgroundColor = .clear; window.hasShadow = true; window.isReleasedWhenClosed = false; window.tabbingMode = .disallowed
        if !session.package.isResizable { window.styleMask.remove(.resizable) }
        if session.package.shape == .ellipse, spec.width == spec.height { window.contentAspectRatio = NSSize(width: 1, height: 1) }
        let container = ShapedView(frame: NSRect(origin: .zero, size: size), windowMask: windowMask)
        session.webView.frame = container.bounds; session.webView.autoresizingMask = [.width, .height]; container.addSubview(session.webView)
        window.contentView = container; window.center()
        super.init(window: window)
        window.delegate = self; session.delegate = self; container.changed = { [weak self] in $0 ? self?.showToolbar() : self?.scheduleHide() }
        opened.onFlushError = { [weak self] error in self?.present("Could not save to iCloud", error) }
        setupToolbar()
        SlopPreviewWriter.installExistingPreview(for: self.packageURL)
        session.load()
    }
    required init?(coder: NSCoder) { nil }

    public func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) { failedOverlay?.removeFromSuperview(); failedOverlay = nil; schedulePreview() }
    public func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopStoreKind) {}
    public func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) { showFailure(error) }

    private func setupToolbar() {
        let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 360, height: 44), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true; panel.level = .floating; panel.hidesOnDeactivate = false; panel.isReleasedWhenClosed = false
        let tracking = HoverView(frame: panel.contentView!.bounds); panel.contentView = tracking
        let host = NSHostingView(rootView: toolbarView()); host.frame = tracking.bounds; host.autoresizingMask = [.width, .height]; tracking.addSubview(host)
        tracking.changed = { [weak self] in if $0 { self?.hideWork?.cancel() } else { self?.scheduleHide() } }
        window?.addChildWindow(panel, ordered: .above); panel.orderOut(nil); toolbar = panel; toolbarHost = host
    }
    private func toolbarView() -> SlopToolbar {
        SlopToolbar(drag: { [weak self] event in self?.dragWindow(with: event) }, pinned: isPinned, close: { [weak self] in self?.close() }, pin: { [weak self] in self?.togglePin() }, duplicate: { [weak self] in self?.duplicate() }, png: { [weak self] in self?.export(.png) }, pdf: { [weak self] in self?.export(.pdf) }, share: { [weak self] in self?.share() }, reveal: { [weak self] in self?.reveal() }, copyPath: { [weak self] in self?.copyPath() }, editors: installedEditors(), openEditor: { [weak self] url in self?.openInEditor(url) })
    }
    private func dragWindow(with event: NSEvent) { hideWork?.cancel(); window?.performDrag(with: event); showToolbar() }
    private func showToolbar() {
        hideWork?.cancel(); guard let panel = toolbar, let window else { return }
        let frame = window.frame; var x = frame.midX - panel.frame.width / 2, y = frame.maxY + 8
        if let visible = window.screen?.visibleFrame { x = min(max(x, visible.minX + 8), visible.maxX - panel.frame.width - 8); if y + panel.frame.height > visible.maxY { y = frame.maxY - panel.frame.height - 10 } }
        panel.setFrameOrigin(NSPoint(x: x, y: y)); panel.orderFront(nil)
    }
    private func scheduleHide() {
        hideWork?.cancel(); let work = DispatchWorkItem { [weak self] in
            guard let self else { return }; let point = NSEvent.mouseLocation
            if self.window?.frame.contains(point) != true, self.toolbar?.frame.contains(point) != true { self.toolbar?.orderOut(nil) }
        }; hideWork = work; DispatchQueue.main.asyncAfter(deadline: .now() + 0.65, execute: work)
    }
    private func togglePin() { window?.level = isPinned ? .normal : .floating; toolbarHost?.rootView = toolbarView() }
    public var isPinned: Bool { window?.level == .floating }
    public func owns(_ candidate: NSWindow?) -> Bool { candidate === window || candidate === toolbar }
    public func togglePinFromMenu() { togglePin() }
    public func duplicateFromMenu() { duplicate() }
    public func exportPNGFromMenu() { export(.png) }
    public func exportPDFFromMenu() { export(.pdf) }
    public func shareFromMenu() { share() }

    private func duplicate() {
        guard let window else { return }; let panel = NSSavePanel(); panel.allowedContentTypes = [.slop]; panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + " copy.slop"
        panel.directoryURL = SlopCloud.defaultCreationDirectory()
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let self, let target = panel.url else { return }
            do {
                try self.opened.flush()
                self.onOpenDocument?(try SlopDuplicator.duplicate(from: self.session.package.rootURL, to: target))
            } catch { self.present("Could not duplicate", error) }
        }
    }
    private enum ExportKind { case png, pdf }
    private func export(_ kind: ExportKind) {
        let panel = NSSavePanel(); panel.allowedContentTypes = [kind == .png ? .png : .pdf]; panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + (kind == .png ? ".png" : ".pdf")
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { do { try await (kind == .png ? SlopRenderer.pngData(packageURL: session.package.rootURL) : SlopRenderer.pdfData(packageURL: session.package.rootURL)).write(to: url, options: .atomic) } catch { present("Export failed", error) } }
    }
    private func share() { guard let view = toolbar?.contentView else { return }; NSSharingServicePicker(items: [packageURL]).show(relativeTo: view.bounds, of: view, preferredEdge: .minY) }
    private func reveal() { NSWorkspace.shared.activateFileViewerSelecting([packageURL]) }
    private func copyPath() { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(packageURL.path, forType: .string) }
    private func installedEditors() -> [(String, URL)] {
        [
            ("Open in Cursor", "/Applications/Cursor.app"),
            ("Open in Visual Studio Code", "/Applications/Visual Studio Code.app"),
            ("Open in VS Code Insiders", "/Applications/Visual Studio Code - Insiders.app"),
        ].compactMap { FileManager.default.fileExists(atPath: $0.1) ? ($0.0, URL(fileURLWithPath: $0.1)) : nil }
    }
    private func openInEditor(_ app: URL) { NSWorkspace.shared.open([packageURL], withApplicationAt: app, configuration: NSWorkspace.OpenConfiguration()) }

    private func showFailure(_ error: Error) {
        guard let content = window?.contentView else { return }; failedOverlay?.removeFromSuperview()
        let overlay = NSHostingView(rootView: FailureOverlay(message: error.localizedDescription, retry: { [weak self] in self?.failedOverlay?.removeFromSuperview(); self?.failedOverlay = nil; self?.session.reload() }))
        overlay.frame = content.bounds; overlay.autoresizingMask = [.width, .height]; content.addSubview(overlay); failedOverlay = overlay
    }
    private func schedulePreview() {
        previewWork?.cancel(); let work = DispatchWorkItem { [weak self] in
            guard let self else { return }; Task { @MainActor in
                guard let image = try? await self.session.webView.takeSnapshot(configuration: nil), let png = try? SlopPreviewImage.png(from: image, package: self.session.package) else { return }
                try? SlopPreviewWriter.write(png, to: self.packageURL)
            }
        }; previewWork = work; DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }
    public func windowDidMove(_ notification: Notification) { if toolbar?.isVisible == true { showToolbar() } }
    public func windowDidResize(_ notification: Notification) { if toolbar?.isVisible == true { showToolbar() } }
    public func windowDidResignKey(_ notification: Notification) { schedulePreview() }
    public func windowWillClose(_ notification: Notification) {
        previewWork?.cancel(); toolbar?.orderOut(nil); if let toolbar { window?.removeChildWindow(toolbar) }; toolbar?.close(); toolbar = nil; onClose?()
        Task { @MainActor [self] in
            if let image = try? await session.webView.takeSnapshot(configuration: nil), let png = try? SlopPreviewImage.png(from: image, package: session.package) { try? SlopPreviewWriter.write(png, to: packageURL) }
            opened.close()
        }
    }
    private func present(_ title: String, _ error: Error) { let alert = NSAlert(error: error); alert.messageText = title; alert.runModal() }
}

private struct FailureOverlay: View {
    let message: String, retry: () -> Void
    var body: some View { VStack(spacing: 12) { Image(systemName: "exclamationmark.triangle").font(.title); Text("This slop stopped responding").font(.headline); Text(message).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center); Button("Retry", action: retry).buttonStyle(.borderedProminent) }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity).background(.regularMaterial) }
}

private struct SlopToolbar: View {
    let drag: (NSEvent) -> Void
    let pinned: Bool, close: () -> Void, pin: () -> Void, duplicate: () -> Void, png: () -> Void, pdf: () -> Void, share: () -> Void, reveal: () -> Void, copyPath: () -> Void
    let editors: [(String, URL)], openEditor: (URL) -> Void
    var body: some View {
        HStack(spacing: 3) {
            ToolbarDragHandle(onDrag: drag).frame(width: 20, height: 25).help("Drag window")
            Divider().frame(height: 16)
            icon("xmark", "Close", close); icon(pinned ? "pin.fill" : "pin", pinned ? "Unpin" : "Always on Top", pin); Divider().frame(height: 16)
            icon("doc.on.doc", "Duplicate", duplicate)
            Menu { Button("Export PNG…", action: png); Button("Export PDF…", action: pdf) } label: { Image(systemName: "arrow.down.doc").frame(width: 25, height: 25) }.menuStyle(.borderlessButton).fixedSize().help("Export")
            icon("square.and.arrow.up", "Share", share)
            Menu { ForEach(editors, id: \.1) { editor in Button(editor.0) { openEditor(editor.1) } }; if !editors.isEmpty { Divider() }; Button("Reveal in Finder", action: reveal); Button("Copy Path", action: copyPath) } label: { Image(systemName: "arrow.up.forward.square").frame(width: 25, height: 25) }.menuStyle(.borderlessButton).fixedSize().help("Open in")
        }.padding(.horizontal, 9).padding(.vertical, 6).background(.ultraThinMaterial, in: Capsule()).overlay(Capsule().stroke(.white.opacity(0.25))).padding(2)
    }
    private func icon(_ name: String, _ help: String, _ action: @escaping () -> Void) -> some View { Button(action: action) { Image(systemName: name).frame(width: 25, height: 25).contentShape(Rectangle()) }.buttonStyle(.plain).help(help) }
}

public extension UTType { static let slop = UTType(exportedAs: "com.hitslop.slop", conformingTo: .package) }
