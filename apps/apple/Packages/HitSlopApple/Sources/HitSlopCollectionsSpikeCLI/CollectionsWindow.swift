import AppKit
import WebKit
import HitSlopCollectionsSpike
import HitSlopSQLiteArchive

@MainActor final class CollectionsWindow: NSObject, WKURLSchemeHandler, WKScriptMessageHandlerWithReply, NSWindowDelegate {
    let document: CollectionsDocument
    let archive: SQLiteArchive
    var window: NSWindow!
    var web: WKWebView!
    var observations: Task<Void, Never>?
    private static var retained: CollectionsWindow?
    init(document: CollectionsDocument, url: URL) throws { self.document = document; archive = try SQLiteArchive(url: url); super.init() }
    static func open(document: CollectionsDocument, url: URL) {
        do {
            let app = NSApplication.shared; app.setActivationPolicy(.regular)
            let host = try CollectionsWindow(document: document, url: url); retained = host; host.show()
            app.activate(ignoringOtherApps: true); app.run()
        } catch { print(error.localizedDescription) }
    }
    static func verify(document: CollectionsDocument, url: URL, png: URL) async throws {
        NSApplication.shared.setActivationPolicy(.accessory)
        let host = try CollectionsWindow(document: document, url: url); host.show()
        defer { host.observations?.cancel(); host.window.orderOut(nil) }
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            if (try? await host.web.evaluateJavaScript("document.querySelector('h1')?.textContent")) as? String == "Tasks, in order." { break }
            try await Task.sleep(for: .milliseconds(50))
        }
        guard (try? await host.web.evaluateJavaScript("document.querySelector('h1')?.textContent")) as? String == "Tasks, in order." else { throw SQLiteFailure("Svelte did not mount from SQLite") }
        _ = try await host.web.evaluateJavaScript("const input=document.querySelector('input');input.value='A task from the native window';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form').requestSubmit();")
        var found = false
        for _ in 0..<100 {
            if (try? await host.web.evaluateJavaScript("document.querySelector('tbody')?.textContent.includes('A task from the native window')")) as? Bool == true { found = true; break }
            try await Task.sleep(for: .milliseconds(50))
        }
        guard found else { throw SQLiteFailure("Svelte insert did not reach durable storage") }
        _ = try await host.web.evaluateJavaScript("document.querySelector('[role=checkbox]').click()")
        for _ in 0..<100 {
            if (try? await host.web.evaluateJavaScript("document.querySelector('[role=checkbox]')?.getAttribute('aria-checked')")) as? String == "true" { break }
            try await Task.sleep(for: .milliseconds(50))
        }
        guard (try await host.web.evaluateJavaScript("document.querySelector('[role=checkbox]')?.getAttribute('aria-checked')")) as? String == "true" else { throw SQLiteFailure("Svelte update did not refresh the query") }
        var confirmed = false
        for _ in 0..<100 {
            let data = try await document.request(Data("{\"collection\":\"todos\",\"operation\":\"count\",\"args\":{\"where\":{\"completed\":true}}}".utf8))
            if String(decoding: data, as: UTF8.self) == "1", (try? await host.web.evaluateJavaScript("getComputedStyle(document.querySelector('tbody tr td:last-child')).textDecorationLine")) as? String == "line-through" { confirmed = true; break }
            try await Task.sleep(for: .milliseconds(50))
        }
        guard confirmed else { throw SQLiteFailure("Checkbox did not reach confirmed state") }
        try await Task.sleep(for: .milliseconds(100))
        let image = try await host.web.takeSnapshot(configuration: nil)
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let bytes = bitmap.representation(using: .png, properties: [:]) else { throw SQLiteFailure("Cannot capture UI") }
        try bytes.write(to: png)
        print("{\"mountedFromSQLite\":true,\"inserted\":true,\"updated\":true}")
    }
    func show() {
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        config.setURLSchemeHandler(self, forURLScheme: "slopcollections")
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "collections")
        config.userContentController.addUserScript(WKUserScript(source: "window.__slopCollections={request:r=>window.webkit.messageHandlers.collections.postMessage(r)};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 560, height: 640), configuration: config)
        window = NSWindow(contentRect: web.frame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Collection Tasks · Experimental"; window.contentView = web; window.delegate = self
        window.isReleasedWhenClosed = false; window.center(); window.makeKeyAndOrderFront(nil)
        web.load(URLRequest(url: URL(string: "slopcollections://document/app.html")!))
        observations = Task { for await _ in await document.changes() { _ = try? await web.evaluateJavaScript("window.dispatchEvent(new Event('slop-collections-change'))") } }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "slopcollections", let body = message.body as? [String: Any], body["method"] == nil || body["method"] as? String == "call" else { replyHandler(nil, "Invalid collection call"); return }
        Task {
            do { let bytes = try JSONSerialization.data(withJSONObject: body); let result = try await document.request(bytes); replyHandler(try JSONSerialization.jsonObject(with: result, options: [.fragmentsAllowed]), nil) }
            catch { replyHandler(nil, error.localizedDescription); let alert = NSAlert(); alert.messageText = "Change could not be saved"; alert.informativeText = error.localizedDescription; await alert.beginSheetModal(for: window) }
        }
    }
    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        do {
            guard let url = urlSchemeTask.request.url, url.host == "document" else { throw SQLiteFailure("Invalid resource") }
            let path = String(url.path.dropFirst()), bytes = try archive.asset(path)
            let mime = path.hasSuffix(".html") ? "text/html" : path.hasSuffix(".js") ? "text/javascript" : path.hasSuffix(".css") ? "text/css" : "application/octet-stream"
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": mime, "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'"])!
            urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(bytes); urlSchemeTask.didFinish()
        } catch { urlSchemeTask.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}
    func windowWillClose(_ notification: Notification) { observations?.cancel(); NSApplication.shared.stop(nil); NSApplication.shared.postEvent(NSEvent.otherEvent(with: .applicationDefined, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, subtype: 0, data1: 0, data2: 0)!, atStart: false) }
}
