import AppKit
import HitSlopCore
import HitSlopRuntime
import SwiftUI
import Observation
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

@MainActor @Observable private final class SlopToolbarPresentation {
    var pinned = false
    var commandsEnabled = true
}

public enum SlopDocumentCommand: Equatable, Sendable {
    case pin(Bool), exportPNG, exportPDF, duplicate, share, reveal, copyPath, openEditor(URL), retry, close
}

@MainActor public final class SlopDocumentWindowController: NSWindowController, NSWindowDelegate, SlopRuntimeSessionDelegate {
    public let packageURL: URL
    public let session: SlopRuntimeSession
    public var onClose: (() -> Void)?
    public var onOpenDocument: ((URL) -> Void)?
    public var onCommand: ((SlopDocumentCommand) -> Void)?
    public var onRuntimeReady: (() -> Void)?
    public var onRuntimeFailure: ((String) -> Void)?
    public var onShare: (() -> Void)?
    private let toolbarPresentation = SlopToolbarPresentation()
    private let opened: SlopOpenedDocument
    private var toolbar: NSPanel?, toolbarHost: NSHostingView<SlopToolbar>?, hideWork: DispatchWorkItem?
    private let reportStack = NSStackView()
    private var reportRows: [String: ReportRow] = [:]
    private var syncPanel: NSPanel?
    private var presentedRuntimeError: String?
    public var isShowingRuntimeFailure: Bool { failedOverlay != nil }
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
        setupToolbar()
        SlopDocumentAssetRefreshQueue.invalidate(self.packageURL)
        SlopPreviewWriter.installExistingPreview(for: self.packageURL)
        session.load()
    }
    required init?(coder: NSCoder) { nil }

    public func runtimeSession(_ session: SlopRuntimeSession, errorsChanged errors: [SlopHostError]) {
        guard let window else { return }
        if errors.isEmpty {
            if let panel = syncPanel { window.removeChildWindow(panel); panel.close(); syncPanel = nil }
            for row in reportRows.values { reportStack.removeArrangedSubview(row); row.removeFromSuperview() }
            reportRows.removeAll()
            return
        }
        let panel: NSPanel
        if let existing = syncPanel { panel = existing }
        else {
            panel = NSPanel(contentRect: .zero, styleMask: [.nonactivatingPanel, .titled], backing: .buffered, defer: false)
            panel.isReleasedWhenClosed = false; syncPanel = panel; window.addChildWindow(panel, ordered: .above)
            reportStack.orientation = .vertical; reportStack.alignment = .leading; reportStack.spacing = 8
            panel.contentView?.addSubview(reportStack)
        }
        panel.title = errors.count == 1 ? errors[0].message : "Document needs attention"
        let ids = Set(errors.map(\.id))
        for id in reportRows.keys.filter({ !ids.contains($0) }) {
            let row = reportRows.removeValue(forKey: id)!; reportStack.removeArrangedSubview(row); row.removeFromSuperview()
        }
        for report in errors {
            let row: ReportRow
            if let existing = reportRows[report.id] { row = existing }
            else {
                row = ReportRow(target: self, run: #selector(runErrorAction(_:)), details: #selector(showErrorDetails(_:)), dismiss: #selector(dismissError(_:)))
                reportRows[report.id] = row; reportStack.addArrangedSubview(row)
            }
            row.update(report)
        }
        let height = CGFloat(24 + errors.count * 44)
        panel.setFrame(NSRect(x: window.frame.minX, y: window.frame.minY - height - 24, width: max(480, window.frame.width), height: height), display: true)
        reportStack.frame = NSRect(x: 12, y: 12, width: panel.frame.width - 24, height: height - 24)
        reportStack.autoresizingMask = [.width, .height]; panel.orderFront(nil)
    }
    @objc private func runErrorAction(_ sender: ReportButton) { performError(sender, dismiss: false) }
    @objc private func dismissError(_ sender: ReportButton) { performError(sender, dismiss: true) }
    private func performError(_ sender: ReportButton, dismiss: Bool) {
        guard let report = sender.report else { return }; sender.isEnabled = false
        Task { do { _ = try await session.performErrorAction(id: report.id, revision: report.revision, instance: report.instance, dismiss: dismiss) } catch { sender.isEnabled = true; present("Action failed", error) } }
    }
    @objc private func showErrorDetails(_ sender: ReportButton) {
        guard let report = sender.report, let window else { return }
        let alert = NSAlert(); alert.messageText = report.message; alert.informativeText = report.details; alert.beginSheetModal(for: window)
    }
    public func runtimeSession(_ session: SlopRuntimeSession, review proposal: String, canApply: Bool) async -> String {
        guard let window else { return "cancel" }
        let alert = NSAlert(); alert.messageText = "Review external file changes"
        alert.informativeText = "The original file will be retained in the recovery journal."
        if canApply { alert.addButton(withTitle: "Apply file changes") }
        alert.addButton(withTitle: "Keep current document"); alert.addButton(withTitle: "Cancel")
        let scroll = NSScrollView(frame: NSRect(x: 0, y: 0, width: 560, height: 300)); scroll.hasVerticalScroller = true
        let text = NSTextView(frame: scroll.bounds); text.isEditable = false; text.string = proposal
        text.font = .monospacedSystemFont(ofSize: 12, weight: .regular); text.isVerticallyResizable = true; text.autoresizingMask = [.width]; text.textContainer?.widthTracksTextView = true
        scroll.documentView = text; alert.accessoryView = scroll
        return await withCheckedContinuation { continuation in
            alert.beginSheetModal(for: window) { response in
                let index = response.rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue
                let choices = canApply ? ["apply", "keep", "cancel"] : ["keep", "cancel"]
                continuation.resume(returning: choices.indices.contains(index) ? choices[index] : "cancel")
            }
        }
    }
    public func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) {
        if let onRuntimeReady { onRuntimeReady() }
        else { updateRuntimeFailure(nil) }
    }
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
    public func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) {
        if let onRuntimeFailure { onRuntimeFailure(error.localizedDescription) }
        else { updateRuntimeFailure(error.localizedDescription) }
    }

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
        SlopToolbar(drag: { [weak self] event in self?.dragWindow(with: event) }, presentation: toolbarPresentation,
            close: { [weak self] in self?.request(.close) }, minimize: { [weak self] in self?.miniaturizeFromToolbar() },
            pin: { [weak self] in guard let self else { return }; self.request(.pin(!self.isPinned)) },
            duplicate: { [weak self] in self?.request(.duplicate) }, png: { [weak self] in self?.request(.exportPNG) },
            pdf: { [weak self] in self?.request(.exportPDF) }, share: { [weak self] in self?.request(.share) },
            reveal: { [weak self] in self?.request(.reveal) }, copyPath: { [weak self] in self?.request(.copyPath) },
            applications: installedApplications(), openApplication: { [weak self] in self?.request(.openEditor($0)) })
    }
    public func updatePresentation(pinned: Bool, commandsEnabled: Bool, runtimeError: String? = nil) {
        updateRuntimeFailure(runtimeError)
        guard isPinned != pinned || toolbarPresentation.commandsEnabled != commandsEnabled else { return }
        window?.level = pinned ? .floating : .normal
        toolbarPresentation.pinned = pinned
        toolbarPresentation.commandsEnabled = commandsEnabled
    }
    private func request(_ command: SlopDocumentCommand) {
        if let onCommand { onCommand(command); return }
        Task { do { if let url = try await perform(command) { onOpenDocument?(url) } } catch { present("Could not complete command", error) } }
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
    public var isPinned: Bool { window?.level == .floating }
    public var documentTitle: String { window?.title ?? session.package.manifest.title }
    public var dockMenuImage: NSImage {
        slopDockMenuImage(iconURL: session.package.iconURL, fallbackURL: packageURL)
    }
    public func owns(_ candidate: NSWindow?) -> Bool { candidate === window || candidate === toolbar }
    public func togglePinFromMenu() { request(.pin(!isPinned)) }
    public func duplicateFromMenu() { request(.duplicate) }
    public func exportPNGFromMenu() { request(.exportPNG) }
    public func exportPDFFromMenu() { request(.exportPDF) }
    public func shareFromMenu() { request(.share) }
    public func revealFromDock() {
        showWindow(nil)
        window?.deminiaturize(nil)
        window?.makeKeyAndOrderFront(nil)
    }

    /// Executes a command authorized by the application feature. Resource ownership stays native.
    public func perform(_ command: SlopDocumentCommand) async throws -> URL? {
        switch command {
        case .pin(let pinned): window?.level = pinned ? .floating : .normal; toolbarPresentation.pinned = pinned
        case .duplicate:
            guard let target = await destination(types: [.slop], name: packageURL.deletingPathExtension().lastPathComponent + " copy.slop") else { return nil }
            try await session.flush()
            return try await session.independentCopy(to: target).standardizedFileURL.resolvingSymlinksInPath()
        case .exportPNG, .exportPDF:
            let png = command == .exportPNG
            guard let target = await destination(types: [png ? .png : .pdf], name: packageURL.deletingPathExtension().lastPathComponent + (png ? ".png" : ".pdf")) else { return nil }
            try await session.flush()
            let data = try await (png ? SlopRenderer.exportPNGData(session: session) : SlopRenderer.exportPDFData(session: session))
            try data.write(to: target, options: .atomic)
        case .share:
            guard let onShare else { throw SlopPackageError.invalid("Sharing requires the hitSlop app") }
            onShare()
        case .reveal: reveal()
        case .copyPath: copyPath()
        case .openEditor(let app): try await openInApplication(app)
        case .retry:
            if onCommand == nil { updateRuntimeFailure(nil) }
            session.reload()
        case .close:
            try await prepareToClose()
            closePrepared = true
            window?.close()
        }
        return nil
    }
    private func destination(types: [UTType], name: String) async -> URL? {
        let panel = NSSavePanel(); panel.allowedContentTypes = types; panel.nameFieldStringValue = name
        panel.directoryURL = packageURL.deletingLastPathComponent()
        let response = await withCheckedContinuation { continuation in
            if let window { panel.beginSheetModal(for: window) { continuation.resume(returning: $0) } }
            else { panel.begin { continuation.resume(returning: $0) } }
        }
        return response == .OK ? panel.url : nil
    }
    private func reveal() { NSWorkspace.shared.activateFileViewerSelecting([packageURL]) }
    private func copyPath() { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(packageURL.path, forType: .string) }
    private func installedApplications() -> [(String, URL)] {
        // Resolve via Launch Services first so non-/Applications installs work.
        [
            ("Open in Cursor", "com.todesktop.230313mzl4w4u92", "/Applications/Cursor.app"),
            ("Open in Visual Studio Code", "com.microsoft.VSCode", "/Applications/Visual Studio Code.app"),
            ("Open in VS Code Insiders", "com.microsoft.VSCodeInsiders", "/Applications/Visual Studio Code - Insiders.app"),
            ("Open in Terminal", "com.apple.Terminal", "/System/Applications/Utilities/Terminal.app"),
            ("Open in iTerm", "com.googlecode.iterm2", "/Applications/iTerm.app"),
            ("Open in Warp", "dev.warp.Warp-Stable", "/Applications/Warp.app"),
        ].compactMap { title, bundleID, fallbackPath in
            if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) { return (title, url) }
            return FileManager.default.fileExists(atPath: fallbackPath) ? (title, URL(fileURLWithPath: fallbackPath)) : nil
        }
    }
    private func openInApplication(_ app: URL) async throws {
        let directoryURL = URL(fileURLWithPath: packageURL.path, isDirectory: true)
        _ = try await NSWorkspace.shared.open([directoryURL], withApplicationAt: app, configuration: NSWorkspace.OpenConfiguration())
    }

    private func updateRuntimeFailure(_ message: String?) {
        guard presentedRuntimeError != message else { return }
        presentedRuntimeError = message
        failedOverlay?.removeFromSuperview()
        failedOverlay = nil
        guard let message, let content = window?.contentView else { return }
        let overlay = NSHostingView(rootView: FailureOverlay(message: message, retry: { [weak self] in self?.request(.retry) }))
        overlay.frame = content.bounds; overlay.autoresizingMask = [.width, .height]; content.addSubview(overlay); failedOverlay = overlay
    }
    public func windowDidMove(_ notification: Notification) { if let window, let syncPanel { syncPanel.setFrameOrigin(NSPoint(x: window.frame.minX, y: window.frame.minY - syncPanel.frame.height - 24)) }; if toolbar?.isVisible == true { showToolbar() } }
    private var closePrepared = false
    private var preparingClose = false
    public override func close() {
        guard let window, windowShouldClose(window) else { return }
        super.close()
    }
    public func prepareToClose() async throws {
        try await session.flush()
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
        if let onCommand { onCommand(.close); return false }
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
        if let syncPanel { window?.removeChildWindow(syncPanel); syncPanel.close(); self.syncPanel = nil }
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
    let presentation: SlopToolbarPresentation
    let close: () -> Void, minimize: () -> Void, pin: () -> Void, duplicate: () -> Void, png: () -> Void, pdf: () -> Void, share: () -> Void, reveal: () -> Void, copyPath: () -> Void
    let applications: [(String, URL)], openApplication: (URL) -> Void
    var body: some View {
        HStack(spacing: 3) {
            ToolbarDragHandle(onDrag: drag).frame(width: 20, height: 25).help("Drag window")
            Divider().frame(height: 16)
            icon("xmark", "Close", close); icon("minus", "Minimize", minimize); icon(presentation.pinned ? "pin.fill" : "pin", presentation.pinned ? "Unpin" : "Always on Top", pin).disabled(!presentation.commandsEnabled); Divider().frame(height: 16)
            Group {
            icon("doc.on.doc", "Duplicate", duplicate)
            Menu { Button("Export PNG…", action: png); Button("Export PDF…", action: pdf) } label: { Image(systemName: "arrow.down.doc").frame(width: 25, height: 25) }.menuStyle(.borderlessButton).fixedSize().help("Export")
            icon("square.and.arrow.up", "Share", share)
            Menu { ForEach(applications, id: \.1) { application in Button(application.0) { openApplication(application.1) } }; if !applications.isEmpty { Divider() }; Button("Reveal in Finder", action: reveal); Button("Copy Path", action: copyPath) } label: { Image(systemName: "arrow.up.forward.square").frame(width: 25, height: 25) }.menuStyle(.borderlessButton).fixedSize().help("Open in")
            }.disabled(!presentation.commandsEnabled)
        }.padding(.horizontal, 9).padding(.vertical, 6).background(.ultraThinMaterial, in: Capsule()).overlay(Capsule().stroke(.white.opacity(0.25))).padding(2)
    }
    private func icon(_ name: String, _ help: String, _ action: @escaping () -> Void) -> some View { Button(action: action) { Image(systemName: name).frame(width: 25, height: 25).contentShape(Rectangle()) }.buttonStyle(.plain).help(help) }
}

public extension UTType { static let slop = UTType(exportedAs: "com.hitslop.slop", conformingTo: .package) }

private final class ReportButton: NSButton { var report: SlopHostError? }

private final class ReportRow: NSStackView {
    private let label = NSTextField(wrappingLabelWithString: "")
    private let run = ReportButton(), details = ReportButton(), dismiss = ReportButton()
    init(target: AnyObject, run: Selector, details: Selector, dismiss: Selector) {
        super.init(frame: .zero); orientation = .horizontal; spacing = 12
        self.run.target = target; self.run.action = run
        self.details.target = target; self.details.action = details; self.details.title = "Details"
        self.dismiss.target = target; self.dismiss.action = dismiss; self.dismiss.title = "Dismiss"
        for view in [label, self.run, self.details, self.dismiss] { addArrangedSubview(view) }
    }
    required init?(coder: NSCoder) { nil }
    func update(_ report: SlopHostError) {
        label.stringValue = report.message
        run.report = report; run.title = report.action ?? ""; run.isHidden = report.action == nil; run.isEnabled = !report.busy
        details.report = report; details.isHidden = report.details.isEmpty
        dismiss.report = report; dismiss.isHidden = !report.dismissible
    }
}
