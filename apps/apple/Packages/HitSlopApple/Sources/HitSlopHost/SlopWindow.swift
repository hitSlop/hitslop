import AppKit
import HitSlopCore
import HitSlopRuntime
import SwiftUI
import UniformTypeIdentifiers

private final class FramelessDocumentWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
    override func performMiniaturize(_ sender: Any?) { miniaturize(sender) }
    override func performClose(_ sender: Any?) {
        if delegate?.windowShouldClose?(self) ?? true { close() }
    }
}

func slopDocumentWindowStyleMask(resizable: Bool) -> NSWindow.StyleMask {
    var mask: NSWindow.StyleMask = [.borderless, .miniaturizable]
    if resizable { mask.insert(.resizable) }
    return mask
}

func slopDockMenuImage(iconURL: URL, fallbackURL: URL) -> NSImage {
    let source = NSImage(contentsOf: iconURL) ?? NSWorkspace.shared.icon(forFile: fallbackURL.path)
    let image = (source.copy() as? NSImage) ?? source
    image.size = NSSize(width: 16, height: 16)
    return image
}

func dynamicSlopWindowFrame(current: NSRect, requested: NSSize, visible: NSRect?) -> NSRect {
    let size = NSSize(
        width: min(requested.width, visible?.width ?? requested.width),
        height: min(requested.height, visible?.height ?? requested.height)
    )
    var origin = NSPoint(x: current.minX, y: current.maxY - size.height)
    if let visible {
        origin.x = min(max(origin.x, visible.minX), visible.maxX - size.width)
        origin.y = min(max(origin.y, visible.minY), visible.maxY - size.height)
    }
    return NSRect(origin: origin, size: size)
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

@MainActor enum SlopDocumentAssetRefreshQueue {
    private struct Job {
        let snapshot: SlopRenderSnapshot
        let destination: URL
        let generation: UUID
    }
    private static var generations: [URL: UUID] = [:]
    private static var pending: [Job] = []
    private static var worker: Task<Void, Never>?

    static func invalidate(_ url: URL) {
        let key = url.standardizedFileURL
        generations[key] = UUID()
        pending.removeAll { $0.destination == key }
    }
    static func schedule(snapshot: SlopRenderSnapshot, presentedURL: URL) {
        let key = presentedURL.standardizedFileURL
        invalidate(key)
        let generation = generations[key]!
        pending.append(Job(snapshot: snapshot, destination: key, generation: generation))
        startWorkerIfNeeded()
    }
    private static func startWorkerIfNeeded() {
        guard worker == nil, !pending.isEmpty else { return }
        worker = Task { @MainActor in
            defer { worker = nil; startWorkerIfNeeded() }
            while !pending.isEmpty, !Task.isCancelled {
                let job = pending.removeFirst()
                do {
                    let assets = try await SlopRenderer.documentAssetsPNGData(snapshot: job.snapshot)
                    guard !Task.isCancelled, generations[job.destination] == job.generation else { continue }
                    if let preview = assets.previewPNG {
                        do { try SlopPreviewWriter.write(preview, to: job.destination) }
                        catch { print("[hitSlop assets] Preview write failed: \(error.localizedDescription)") }
                    }
                    if let icon = assets.finderIconPNG { SlopPreviewWriter.installFinderIcon(icon, for: job.destination) }
                } catch { print("[hitSlop assets] Refresh failed: \(error.localizedDescription)") }
            }
        }
    }
    static func finishForTermination(grace: Duration = .seconds(5)) async {
        let deadline = ContinuousClock.now.advanced(by: grace)
        while worker != nil, ContinuousClock.now < deadline { try? await Task.sleep(for: .milliseconds(40)) }
        if worker != nil { worker?.cancel(); pending.removeAll(); generations.removeAll() }
    }
}

@MainActor public final class SlopDocumentWindowController: NSWindowController, NSWindowDelegate, SlopRuntimeSessionDelegate {
    public let packageURL: URL
    public let session: SlopRuntimeSession
    public var onClose: (() -> Void)?
    public var onOpenDocument: ((URL) -> Void)?
    private let opened: SlopOpenedDocument
    private var toolbar: NSPanel?, toolbarHost: NSHostingView<SlopToolbar>?, hideWork: DispatchWorkItem?
    private var failedOverlay: NSHostingView<FailureOverlay>?

    public init(packageURL: URL) throws {
        let opened = try SlopOpenedDocument(presentedURL: packageURL)
        self.opened = opened
        self.packageURL = opened.presentedURL
        session = opened.session
        let windowMask = try SlopWindowMask(package: session.package)
        let spec = session.package.manifest.presentation, size = NSSize(width: spec.width, height: spec.height)
        let window = FramelessDocumentWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: slopDocumentWindowStyleMask(resizable: session.package.isResizable), backing: .buffered, defer: false)
        window.title = session.package.manifest.title; window.minSize = NSSize(width: 240, height: 180); window.isOpaque = false
        window.backgroundColor = .clear; window.hasShadow = !session.package.usesTransparentBackground || session.package.isSkinned; window.isReleasedWhenClosed = false; window.tabbingMode = .disallowed
        window.representedURL = opened.presentedURL
        window.miniwindowTitle = session.package.manifest.title
        window.miniwindowImage = NSImage(contentsOf: session.package.iconURL)
        if session.package.shape == .ellipse, spec.width == spec.height { window.contentAspectRatio = NSSize(width: 1, height: 1) }
        let container = ShapedView(frame: NSRect(origin: .zero, size: size), windowMask: windowMask)
        session.webView.frame = container.bounds; session.webView.autoresizingMask = [.width, .height]; container.addSubview(session.webView)
        window.contentView = container; window.center()
        super.init(window: window)
        window.delegate = self; session.delegate = self; container.changed = { [weak self] in $0 ? self?.showToolbar() : self?.scheduleHide() }
        opened.onFlushError = { [weak self] error in self?.present("Could not save to iCloud", error) }
        setupToolbar()
        SlopDocumentAssetRefreshQueue.invalidate(self.packageURL)
        SlopPreviewWriter.installExistingPreview(for: self.packageURL)
        session.load()
    }
    required init?(coder: NSCoder) { nil }

    public func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) { failedOverlay?.removeFromSuperview(); failedOverlay = nil }
    public func runtimeSession(_ session: SlopRuntimeSession, resizeContentTo requested: CGSize) throws -> CGSize {
        guard let window else { throw SlopPackageError.invalid("document window is unavailable") }
        let frame = dynamicSlopWindowFrame(current: window.frame, requested: requested, visible: window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame)
        window.setFrame(frame, display: true, animate: true)
        if toolbar?.isVisible == true { showToolbar() }
        return frame.size
    }
    public func runtimeSessionDidRequestWindowDrag(_ session: SlopRuntimeSession) throws {
        guard let window else { throw SlopPackageError.invalid("document window is unavailable") }
        try session.performWindowDrag(on: window)
    }
    public func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) { showFailure(error) }

    private func setupToolbar() {
        let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 388, height: 44), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true; panel.level = .floating; panel.hidesOnDeactivate = false; panel.isReleasedWhenClosed = false
        panel.isExcludedFromWindowsMenu = true
        let tracking = HoverView(frame: panel.contentView?.bounds ?? NSRect(x: 0, y: 0, width: 388, height: 44)); panel.contentView = tracking
        let host = NSHostingView(rootView: toolbarView()); host.frame = tracking.bounds; host.autoresizingMask = [.width, .height]; tracking.addSubview(host)
        tracking.changed = { [weak self] in if $0 { self?.hideWork?.cancel() } else { self?.scheduleHide() } }
        window?.addChildWindow(panel, ordered: .above); panel.orderOut(nil); toolbar = panel; toolbarHost = host
    }
    private func toolbarView() -> SlopToolbar {
        SlopToolbar(drag: { [weak self] event in self?.dragWindow(with: event) }, pinned: isPinned, close: { [weak self] in self?.close() }, minimize: { [weak self] in self?.miniaturizeFromToolbar() }, pin: { [weak self] in self?.togglePin() }, duplicate: { [weak self] in self?.duplicate() }, png: { [weak self] in self?.export(.png) }, pdf: { [weak self] in self?.export(.pdf) }, share: { [weak self] in self?.share() }, reveal: { [weak self] in self?.reveal() }, copyPath: { [weak self] in self?.copyPath() }, editors: installedEditors(), openEditor: { [weak self] url in self?.openInEditor(url) })
    }
    private func dragWindow(with event: NSEvent) { hideWork?.cancel(); window?.performDrag(with: event); showToolbar() }
    private func miniaturizeFromToolbar() { hideWork?.cancel(); toolbar?.orderOut(nil); window?.miniaturize(nil) }
    private func showToolbar() {
        hideWork?.cancel(); guard let panel = toolbar, let window, !window.isMiniaturized else { return }
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
    public var documentTitle: String { window?.title ?? session.package.manifest.title }
    public var dockMenuImage: NSImage {
        slopDockMenuImage(iconURL: session.package.iconURL, fallbackURL: packageURL)
    }
    public func owns(_ candidate: NSWindow?) -> Bool { candidate === window || candidate === toolbar }
    public func togglePinFromMenu() { togglePin() }
    public func duplicateFromMenu() { duplicate() }
    public func exportPNGFromMenu() { export(.png) }
    public func exportPDFFromMenu() { export(.pdf) }
    public func shareFromMenu() { share() }
    public func revealFromDock() {
        showWindow(nil)
        window?.deminiaturize(nil)
        window?.makeKeyAndOrderFront(nil)
    }

    private func duplicate() {
        guard let window else { return }; let panel = NSSavePanel(); panel.allowedContentTypes = [.slop]; panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + " copy.slop"
        panel.directoryURL = SlopCloud.defaultCreationDirectory()
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let self, let target = panel.url else { return }
                Task {
                    do {
                        try await self.session.flush()
                        try self.opened.flush()
                        self.onOpenDocument?(try SlopDuplicator.duplicate(from: self.session.package.rootURL, to: target))
                    } catch { self.present("Could not duplicate", error) }
                }
        }
    }
    private enum ExportKind { case png, pdf }
    private func export(_ kind: ExportKind) {
        let panel = NSSavePanel(); panel.allowedContentTypes = [kind == .png ? .png : .pdf]; panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + (kind == .png ? ".png" : ".pdf")
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { do { try await session.flush(); try await (kind == .png ? SlopRenderer.exportPNGData(session: session) : SlopRenderer.exportPDFData(session: session)).write(to: url, options: .atomic) } catch { present("Export failed", error) } }
    }
    private func share() { guard let view = toolbar?.contentView else { return }; NSSharingServicePicker(items: [packageURL]).show(relativeTo: view.bounds, of: view, preferredEdge: .minY) }
    private func reveal() { NSWorkspace.shared.activateFileViewerSelecting([packageURL]) }
    private func copyPath() { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(packageURL.path, forType: .string) }
    private func installedEditors() -> [(String, URL)] {
        // Resolve via Launch Services first so non-/Applications installs work.
        [
            ("Open in Cursor", "com.todesktop.230313mzl4w4u92", "/Applications/Cursor.app"),
            ("Open in Visual Studio Code", "com.microsoft.VSCode", "/Applications/Visual Studio Code.app"),
            ("Open in VS Code Insiders", "com.microsoft.VSCodeInsiders", "/Applications/Visual Studio Code - Insiders.app"),
        ].compactMap { title, bundleID, fallbackPath in
            if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) { return (title, url) }
            return FileManager.default.fileExists(atPath: fallbackPath) ? (title, URL(fileURLWithPath: fallbackPath)) : nil
        }
    }
    private func openInEditor(_ app: URL) { NSWorkspace.shared.open([packageURL], withApplicationAt: app, configuration: NSWorkspace.OpenConfiguration()) }

    private func showFailure(_ error: Error) {
        guard let content = window?.contentView else { return }; failedOverlay?.removeFromSuperview()
        let overlay = NSHostingView(rootView: FailureOverlay(message: error.localizedDescription, retry: { [weak self] in self?.failedOverlay?.removeFromSuperview(); self?.failedOverlay = nil; self?.session.reload() }))
        overlay.frame = content.bounds; overlay.autoresizingMask = [.width, .height]; content.addSubview(overlay); failedOverlay = overlay
    }
    public func windowDidMove(_ notification: Notification) { if toolbar?.isVisible == true { showToolbar() } }
    private var closePrepared = false
    private var preparingClose = false
    public override func close() {
        guard let window, windowShouldClose(window) else { return }
        super.close()
    }
    public func prepareToClose() async throws {
        try await session.flush()
        try opened.flush()
        do {
            let snapshot = try SlopRenderSnapshot(packageURL: session.package.rootURL)
            SlopDocumentAssetRefreshQueue.schedule(snapshot: snapshot, presentedURL: packageURL)
        } catch { print("[hitSlop assets] Could not snapshot saved document: \(error.localizedDescription)") }
    }
    public static func finishAssetRefreshesForTermination() async {
        await SlopDocumentAssetRefreshQueue.finishForTermination()
    }
    public func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closePrepared { return true }
        guard !preparingClose else { return false }
        preparingClose = true
        Task {
            defer { preparingClose = false }
            do { try await prepareToClose(); closePrepared = true; sender.close() }
            catch { present("Changes could not be saved", error) }
        }
        return false
    }
    public func windowDidResize(_ notification: Notification) { if toolbar?.isVisible == true { showToolbar() } }
    public func windowWillMiniaturize(_ notification: Notification) { hideWork?.cancel(); toolbar?.orderOut(nil) }
    public func windowWillClose(_ notification: Notification) {
        toolbar?.orderOut(nil); if let toolbar { window?.removeChildWindow(toolbar) }; toolbar?.close(); toolbar = nil
        opened.close()
        onClose?()
    }
    private func present(_ title: String, _ error: Error) { let alert = NSAlert(error: error); alert.messageText = title; alert.runModal() }
}

private struct FailureOverlay: View {
    let message: String, retry: () -> Void
    var body: some View { VStack(spacing: 12) { Image(systemName: "exclamationmark.triangle").font(.title); Text("This slop stopped responding").font(.headline); Text(message).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center); Button("Retry", action: retry).buttonStyle(.borderedProminent) }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity).background(.regularMaterial) }
}

private struct SlopToolbar: View {
    let drag: (NSEvent) -> Void
    let pinned: Bool, close: () -> Void, minimize: () -> Void, pin: () -> Void, duplicate: () -> Void, png: () -> Void, pdf: () -> Void, share: () -> Void, reveal: () -> Void, copyPath: () -> Void
    let editors: [(String, URL)], openEditor: (URL) -> Void
    var body: some View {
        HStack(spacing: 3) {
            ToolbarDragHandle(onDrag: drag).frame(width: 20, height: 25).help("Drag window")
            Divider().frame(height: 16)
            icon("xmark", "Close", close); icon("minus", "Minimize", minimize); icon(pinned ? "pin.fill" : "pin", pinned ? "Unpin" : "Always on Top", pin); Divider().frame(height: 16)
            icon("doc.on.doc", "Duplicate", duplicate)
            Menu { Button("Export PNG…", action: png); Button("Export PDF…", action: pdf) } label: { Image(systemName: "arrow.down.doc").frame(width: 25, height: 25) }.menuStyle(.borderlessButton).fixedSize().help("Export")
            icon("square.and.arrow.up", "Share", share)
            Menu { ForEach(editors, id: \.1) { editor in Button(editor.0) { openEditor(editor.1) } }; if !editors.isEmpty { Divider() }; Button("Reveal in Finder", action: reveal); Button("Copy Path", action: copyPath) } label: { Image(systemName: "arrow.up.forward.square").frame(width: 25, height: 25) }.menuStyle(.borderlessButton).fixedSize().help("Open in")
        }.padding(.horizontal, 9).padding(.vertical, 6).background(.ultraThinMaterial, in: Capsule()).overlay(Capsule().stroke(.white.opacity(0.25))).padding(2)
    }
    private func icon(_ name: String, _ help: String, _ action: @escaping () -> Void) -> some View { Button(action: action) { Image(systemName: name).frame(width: 25, height: 25).contentShape(Rectangle()) }.buttonStyle(.plain).help(help) }
}

public extension UTType { static let slop = UTType(exportedAs: "com.hitslop.slop", conformingTo: .package) }
