import AppKit
import SwiftUI
import WebKit
import UniformTypeIdentifiers

@MainActor
private protocol SlopBridgeDelegate: AnyObject {
    func bridgeDidWrite(revision: Int64)
    func bridgeDidBecomeReady()
}

private final class SlopSchemeHandler: NSObject, WKURLSchemeHandler {
    let database: SlopDatabase

    init(database: SlopDatabase) { self.database = database }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        do {
            if url.path == "/slop.js" {
                respond(urlSchemeTask, data: Data(slopRuntimeJavaScript.utf8), mime: "text/javascript")
                return
            }
            if url.path.hasPrefix("/assets/") {
                let assetPath = "/" + String(url.path.dropFirst("/assets/".count)).removingPercentEncoding!
                if let asset = try database.asset(path: assetPath) {
                    respond(urlSchemeTask, data: asset.data, mime: asset.mime)
                    return
                }
            }
            throw SlopError.invalidArgument("Asset not found: \(url.path)")
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respond(_ task: WKURLSchemeTask, data: Data, mime: String) {
        guard let url = task.request.url else { return }
        let response = URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: mime.hasPrefix("text/") ? "utf-8" : nil)
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }
}

@MainActor
private final class SlopBridge: NSObject, WKScriptMessageHandlerWithReply {
    let database: SlopDatabase
    let renderer: SlopCheckedRenderer
    var usesCheckedRenderer = false
    weak var delegate: SlopBridgeDelegate?

    init(database: SlopDatabase, renderer: SlopCheckedRenderer) {
        self.database = database
        self.renderer = renderer
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) async -> (Any?, String?) {
        guard let body = message.body as? [String: Any], let operation = body["op"] as? String else {
            return (["error": "Malformed bridge message."], nil)
        }
        do {
            if usesCheckedRenderer && ["query", "exec", "transaction"].contains(operation) {
                throw SlopError.invalidArgument("Checked views cannot call slop.\(operation)")
            }
            switch operation {
            case "query":
                let sql = body["sql"] as? String ?? ""
                let parameters = body["params"] as? [Any] ?? []
                let rows = try database.query(sql, parameters: parameters)
                return (["rows": database.jsonRows(rows)], nil)
            case "exec":
                let sql = body["sql"] as? String ?? ""
                let parameters = body["params"] as? [Any] ?? []
                let result = try database.execute(sql, parameters: parameters)
                let revision = try database.revision()
                delegate?.bridgeDidWrite(revision: revision)
                return (result, nil)
            case "transaction":
                let statements = body["statements"] as? [[String: Any]] ?? []
                let results = try database.transaction(statements)
                let revision = try database.revision()
                delegate?.bridgeDidWrite(revision: revision)
                return (["results": results, "revision": revision], nil)
            case "action":
                guard usesCheckedRenderer else {
                    throw SlopError.invalidArgument("Named actions are only available in checked views")
                }
                let name = body["name"] as? String ?? ""
                let rawParams = body["params"] as? [String: Any] ?? [:]
                var params: [String: String] = [:]
                for (key, value) in rawParams {
                    if value is NSNull { params[key] = ""; continue }
                    params[key] = String(describing: value)
                }
                let html = try renderer.performAction(name: name, params: params)
                let revision = try database.revision()
                delegate?.bridgeDidWrite(revision: revision)
                return (["html": html, "revision": revision], nil)
            case "meta":
                return (try database.metadata().values, nil)
            case "ready":
                delegate?.bridgeDidBecomeReady()
                return (["ready": true], nil)
            default:
                return (["error": "Unknown bridge operation: \(operation)"], nil)
            }
        } catch {
            return (["error": error.localizedDescription], nil)
        }
    }
}

private final class SlopNavigationDelegate: NSObject, WKNavigationDelegate {
    var didFinish: (() -> Void)?
    var didFail: ((Error?) -> Void)?

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.scheme == "slop" || url.scheme == "about" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        didFinish?()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        didFail?(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        didFail?(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        didFail?(nil)
    }
}

final class FramelessDocumentWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

/// Borderless document windows are often activated by clicking directly on
/// their content. WKWebView's default first-mouse behavior consumes that click
/// for activation, which makes controls feel dead. Let the page receive it.
private final class InteractiveWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override var mouseDownCanMoveWindow: Bool { false }
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

    override var mouseDownCanMoveWindow: Bool { false }

    override func mouseEntered(with event: NSEvent) { hoverChanged?(true) }
    override func mouseExited(with event: NSEvent) { hoverChanged?(false) }
}

private final class DragHandleView: NSView {
    override var mouseDownCanMoveWindow: Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? {
        bounds.contains(point) ? self : nil
    }
}

private final class HoverToolbarPanel: NSPanel {
    var hoverChanged: ((Bool) -> Void)?

    init(contentRect: NSRect) {
        super.init(
            contentRect: contentRect,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        isMovableByWindowBackground = false
        isReleasedWhenClosed = false
        level = .floating
        ignoresMouseEvents = false
        acceptsMouseMovedEvents = true

        let tracker = ToolbarTrackingView(frame: NSRect(origin: .zero, size: contentRect.size))
        tracker.autoresizingMask = [.width, .height]
        tracker.panel = self
        contentView = tracker
    }
}

private final class ToolbarTrackingView: NSView {
    weak var panel: HoverToolbarPanel?
    private var tracking: NSTrackingArea?

    override func updateTrackingAreas() {
        if let tracking { removeTrackingArea(tracking) }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self
        )
        addTrackingArea(area)
        tracking = area
        super.updateTrackingAreas()
    }

    override func mouseEntered(with event: NSEvent) { panel?.hoverChanged?(true) }
    override func mouseExited(with event: NSEvent) { panel?.hoverChanged?(false) }
}

@MainActor
final class SlopDocumentWindowController: NSWindowController, NSWindowDelegate, SlopBridgeDelegate {
    let packageURL: URL
    let database: SlopDatabase
    let webView: WKWebView
    var onClose: (() -> Void)?
    var onOpenDocument: ((URL) -> Void)?

    private let renderer: SlopCheckedRenderer
    private let bridge: SlopBridge
    private let schemeHandler: SlopSchemeHandler
    private let navigationDelegate = SlopNavigationDelegate()
    private var toolbarPanel: HoverToolbarPanel?
    private var toolbarHostingView: NSHostingView<SlopToolbarView>?
    private var hideToolbarWork: DispatchWorkItem?
    private var previewWork: DispatchWorkItem?
    private var changeTimer: Timer?
    private var lastKnownRevision: Int64 = 0
    private var lastKnownDataVersion: Int64 = 0
    private var securityScoped = false
    private var recoveryAttempts = 0
    private var loadErrorView: NSView?

    init(packageURL: URL) throws {
        self.packageURL = SlopPackage.packageURL(for: packageURL).standardizedFileURL
        securityScoped = self.packageURL.startAccessingSecurityScopedResource()
        database = try SlopDatabase(packageURL: self.packageURL, restricted: true)
        renderer = SlopCheckedRenderer(database: database)
        let metadata = try database.metadata()
        lastKnownRevision = metadata.revision
        lastKnownDataVersion = try database.dataVersion()

        let configuration = WKWebViewConfiguration()
        schemeHandler = SlopSchemeHandler(database: database)
        bridge = SlopBridge(database: database, renderer: renderer)
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "slop")
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "slop")
        configuration.userContentController.addUserScript(
            WKUserScript(source: slopRuntimeJavaScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        configuration.userContentController.addUserScript(
            WKUserScript(source: slopIdiomorphJavaScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        configuration.userContentController.addUserScript(
            WKUserScript(source: slopCheckedRuntimeJavaScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        configuration.userContentController.addUserScript(
            WKUserScript(source: slopHostStyleJavaScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        configuration.websiteDataStore = .nonPersistent()
        configuration.preferences.isElementFullscreenEnabled = false
        webView = InteractiveWebView(frame: .zero, configuration: configuration)

        let frame = NSRect(x: 0, y: 0, width: metadata.width, height: metadata.height)
        let window = FramelessDocumentWindow(
            contentRect: frame,
            styleMask: [.borderless, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = metadata.title
        window.minSize = NSSize(width: metadata.minimumWidth, height: metadata.minimumHeight)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.isReleasedWhenClosed = false
        window.isRestorable = false
        window.tabbingMode = .disallowed
        window.acceptsMouseMovedEvents = true
        window.ignoresMouseEvents = false
        window.isMovableByWindowBackground = false
        window.level = metadata.alwaysOnTop ? .floating : .normal
        window.center()

        let container = HoverTrackingView(frame: frame)
        container.wantsLayer = true
        container.layer?.cornerRadius = metadata.cornerRadius
        container.layer?.cornerCurve = .continuous
        container.layer?.masksToBounds = true
        webView.frame = container.bounds
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        container.addSubview(webView)
        let dragHandle = DragHandleView(frame: NSRect(x: 0, y: frame.height - 13, width: frame.width, height: 13))
        dragHandle.autoresizingMask = [.width, .minYMargin]
        container.addSubview(dragHandle)
        window.contentView = container
        window.makeFirstResponder(webView)

        super.init(window: window)
        bridge.delegate = self
        webView.navigationDelegate = navigationDelegate
        navigationDelegate.didFinish = { [weak self] in self?.webViewDidFinishLoading() }
        navigationDelegate.didFail = { [weak self] error in self?.webViewDidFail(error) }
        window.delegate = self
        container.hoverChanged = { [weak self] inside in inside ? self?.showToolbar() : self?.scheduleToolbarHide() }
        setupToolbar()
        try loadDocument()
        startWatchingPackage()
    }

    required init?(coder: NSCoder) { nil }

    private func loadDocument() throws {
        let html = try database.mainHTML()
        let checked = SlopCheckedRenderer.isChecked(html)
        bridge.usesCheckedRenderer = checked
        if checked {
            webView.loadHTMLString(try renderer.render(source: html), baseURL: URL(string: "slop://document/")!)
        } else {
            webView.loadHTMLString(html, baseURL: URL(string: "slop://document/")!)
        }
    }

    private func webViewDidFinishLoading() {
        recoveryAttempts = 0
        loadErrorView?.removeFromSuperview()
        loadErrorView = nil
    }

    private func webViewDidFail(_ error: Error?) {
        guard recoveryAttempts < 1 else {
            showLoadFailure(error)
            return
        }
        recoveryAttempts += 1
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            do { try self?.loadDocument() }
            catch { self?.showLoadFailure(error) }
        }
    }

    private func showLoadFailure(_ error: Error?) {
        guard loadErrorView == nil, let container = window?.contentView else { return }
        let message = error?.localizedDescription ?? "The WebKit content process stopped unexpectedly."
        let view = NSHostingView(rootView: SlopLoadFailureView(message: message) { [weak self] in
            guard let self else { return }
            self.loadErrorView?.removeFromSuperview()
            self.loadErrorView = nil
            self.recoveryAttempts = 0
            do { try self.loadDocument() }
            catch { self.showLoadFailure(error) }
        })
        view.frame = container.bounds
        view.autoresizingMask = [.width, .height]
        container.addSubview(view)
        loadErrorView = view
    }

    func bridgeDidWrite(revision: Int64) {
        lastKnownRevision = revision
        lastKnownDataVersion = (try? database.dataVersion()) ?? lastKnownDataVersion
        if !bridge.usesCheckedRenderer {
            notifyWebView(revision: revision)
        }
        schedulePreview()
    }

    func bridgeDidBecomeReady() { schedulePreview(delay: 0.2) }

    private func notifyWebView(revision: Int64) {
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('slop:change',{detail:{revision:\(revision)}}))")
    }

    private func setupToolbar() {
        let frame = NSRect(x: 0, y: 0, width: 244, height: 42)
        let panel = HoverToolbarPanel(contentRect: frame)
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.hoverChanged = { [weak self] inside in
            inside ? self?.showToolbar() : self?.scheduleToolbarHide()
        }
        let hosting = NSHostingView(rootView: toolbarView())
        hosting.frame = panel.contentView?.bounds ?? frame
        hosting.autoresizingMask = [.width, .height]
        panel.contentView?.addSubview(hosting)
        window?.addChildWindow(panel, ordered: .above)
        panel.orderOut(nil)
        toolbarHostingView = hosting
        toolbarPanel = panel
    }

    private func toolbarView() -> SlopToolbarView {
        SlopToolbarView(
            pinned: window?.level == .floating,
            close: { [weak self] in self?.close() },
            togglePin: { [weak self] in self?.togglePin() },
            duplicate: { [weak self] in self?.duplicateDocument() },
            exportPNG: { [weak self] in self?.chooseExport(.png) },
            exportPDF: { [weak self] in self?.chooseExport(.pdf) },
            share: { [weak self] in self?.shareDocument() },
            hover: { [weak self] inside in
                inside ? self?.showToolbar() : self?.scheduleToolbarHide()
            }
        )
    }

    private func refreshToolbar() {
        toolbarHostingView?.rootView = toolbarView()
    }

    private func showToolbar() {
        hideToolbarWork?.cancel()
        guard let panel = toolbarPanel, let window else { return }
        let frame = window.frame
        var x = frame.midX - panel.frame.width / 2
        var y = frame.maxY + 8
        if let visible = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame {
            x = min(max(x, visible.minX + 8), visible.maxX - panel.frame.width - 8)
            if y + panel.frame.height > visible.maxY {
                y = frame.maxY - panel.frame.height - 10
            }
        }
        panel.setFrameOrigin(NSPoint(x: x, y: y))
        if !panel.isVisible {
            panel.alphaValue = 0
            panel.orderFront(nil)
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.12
                panel.animator().alphaValue = 1
            }
        }
    }

    private func scheduleToolbarHide() {
        hideToolbarWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.toolbarPanel?.orderOut(nil) }
        hideToolbarWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75, execute: work)
    }

    private func togglePin() {
        guard let window else { return }
        let pinned = window.level != .floating
        window.level = pinned ? .floating : .normal
        try? database.setMeta("always_on_top", value: pinned ? "1" : "0")
        refreshToolbar()
    }

    private func duplicateDocument() {
        do {
            try database.checkpoint()
            let destination = SlopPackage.nextDuplicateURL(for: packageURL)
            let newURL = try SlopPackage.clone(from: packageURL, to: destination, title: destination.deletingPathExtension().lastPathComponent)
            onOpenDocument?(newURL)
        } catch {
            showError("Could not duplicate document", error)
        }
    }

    private enum ExportKind { case png, pdf }

    private func chooseExport(_ kind: ExportKind) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [kind == .png ? .png : .pdf]
        panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + (kind == .png ? ".png" : ".pdf")
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task {
            do {
                switch kind {
                case .png: try await exportPNG(to: url)
                case .pdf: try await exportPDF(to: url)
                }
            } catch { showError("Export failed", error) }
        }
    }

    private func exportPNG(to url: URL) async throws {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = webView.bounds
        let image = try await webView.takeSnapshot(configuration: configuration)
        guard let data = image.pngData else { throw SlopError.invalidArgument("Could not encode PNG.") }
        try data.write(to: url, options: .atomic)
    }

    private func exportPDF(to url: URL) async throws {
        let configuration = WKPDFConfiguration()
        configuration.rect = webView.bounds
        let data = try await webView.pdf(configuration: configuration)
        try data.write(to: url, options: .atomic)
    }

    private func shareDocument() {
        guard let view = toolbarPanel?.contentView else { return }
        NSSharingServicePicker(items: [packageURL]).show(relativeTo: view.bounds, of: view, preferredEdge: .minY)
    }

    private func schedulePreview(delay: TimeInterval = 0.45) {
        previewWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            Task { @MainActor in await self.renderPreview() }
        }
        previewWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    private func renderPreview() async {
        do {
            let configuration = WKSnapshotConfiguration()
            configuration.rect = webView.bounds
            configuration.snapshotWidth = 430
            let image = try await webView.takeSnapshot(configuration: configuration)
            guard let png = image.pngData else { return }
            try database.storePreview(png, forRevision: lastKnownRevision)
            let radius = (try? database.metadata().cornerRadius) ?? 22
            try SlopPreviewIcon.install(png, into: packageURL, cornerRadius: radius)
            lastKnownDataVersion = try database.dataVersion()
        } catch {
            // Preview generation is derived state; document writes remain successful.
        }
    }

    private func startWatchingPackage() {
        changeTimer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.packageDidChangeOnDisk() }
        }
    }

    private func packageDidChangeOnDisk() {
        guard let dataVersion = try? database.dataVersion(), dataVersion != lastKnownDataVersion else { return }
        lastKnownDataVersion = dataVersion
        if bridge.usesCheckedRenderer || ((try? database.mainHTML()).map(SlopCheckedRenderer.isChecked) == true) {
            refreshCheckedView()
            return
        }
        guard let revision = try? database.revision(), revision != lastKnownRevision else { return }
        lastKnownRevision = revision
        notifyWebView(revision: revision)
        schedulePreview()
    }

    private func refreshCheckedView() {
        do {
            let html = try database.mainHTML()
            bridge.usesCheckedRenderer = SlopCheckedRenderer.isChecked(html)
            guard bridge.usesCheckedRenderer else {
                try loadDocument()
                return
            }
            lastKnownRevision = (try? database.revision()) ?? lastKnownRevision
            if renderer.cachedSource != html {
                webView.loadHTMLString(try renderer.render(source: html), baseURL: URL(string: "slop://document/")!)
            } else {
                let snapshot = try renderer.render(source: html)
                Task { @MainActor [weak self] in
                    await self?.applySnapshot(snapshot)
                }
            }
            loadErrorView?.removeFromSuperview()
            loadErrorView = nil
            schedulePreview()
        } catch {
            showLoadFailure(error)
        }
    }

    private func applySnapshot(_ html: String) async {
        do {
            _ = try await webView.callAsyncJavaScript(
                "window.__slopApplySnapshot(html)",
                arguments: ["html": html],
                in: nil,
                in: .page
            )
        } catch {
            showLoadFailure(error)
        }
    }

    func windowDidMove(_ notification: Notification) { if toolbarPanel?.isVisible == true { showToolbar() } }
    func windowDidResize(_ notification: Notification) { if toolbarPanel?.isVisible == true { showToolbar() } }

    func windowWillClose(_ notification: Notification) {
        previewWork?.cancel()
        changeTimer?.invalidate()
        changeTimer = nil
        database.close()
        if securityScoped { packageURL.stopAccessingSecurityScopedResource() }
        toolbarPanel?.orderOut(nil)
        if let toolbarPanel { window?.removeChildWindow(toolbarPanel) }
        toolbarPanel?.close()
        toolbarHostingView = nil
        toolbarPanel = nil
        onClose?()
    }

    private func showError(_ title: String, _ error: Error) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = error.localizedDescription
        alert.runModal()
    }
}

private struct SlopLoadFailureView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 26, weight: .medium))
            Text("Could not render this slop")
                .font(.headline)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
            Button("Retry", action: retry)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(32)
        .background(.regularMaterial)
    }
}

private struct SlopToolbarView: View {
    let pinned: Bool
    let close: () -> Void
    let togglePin: () -> Void
    let duplicate: () -> Void
    let exportPNG: () -> Void
    let exportPDF: () -> Void
    let share: () -> Void
    let hover: (Bool) -> Void

    var body: some View {
        HStack(spacing: 4) {
            toolbarButton("xmark", help: "Close", action: close)
            toolbarButton(pinned ? "pin.fill" : "pin", help: pinned ? "Unpin" : "Always on Top", action: togglePin)
            divider
            toolbarButton("doc.on.doc", help: "Duplicate", action: duplicate)
            Menu {
                Button("Export PNG", action: exportPNG)
                Button("Export PDF", action: exportPDF)
            } label: {
                Image(systemName: "arrow.down.doc")
                    .frame(width: 25, height: 25)
                    .contentShape(Rectangle())
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            toolbarButton("square.and.arrow.up", help: "Share", action: share)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.18)))
        .padding(2)
        .onHover(perform: hover)
    }

    private var divider: some View {
        Rectangle().fill(.primary.opacity(0.16)).frame(width: 1, height: 16).padding(.horizontal, 3)
    }

    private func toolbarButton(_ icon: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).frame(width: 25, height: 25).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

private extension NSImage {
    var pngData: Data? {
        guard let tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffRepresentation) else { return nil }
        return bitmap.representation(using: .png, properties: [:])
    }
}
