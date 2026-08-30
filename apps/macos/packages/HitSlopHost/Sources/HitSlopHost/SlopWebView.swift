import AppKit
import Foundation
import HitSlopCore
import WebKit

private let runtimeScript = #"""
(() => {
  const native = window.webkit.messageHandlers.hitslop;
  let pending = 0, guestReady = false, readySent = false, mutationVersion = 0;
  const call = (method, args = {}) => {
    if (method !== 'log' && method !== 'ready') pending += 1;
    return native.postMessage({ method, ...args }).finally(() => {
      if (method !== 'log' && method !== 'ready') pending -= 1;
      scheduleReady();
    });
  };
  const scheduleReady = () => {
    if (!guestReady || readySent || pending !== 0) return;
    const version = mutationVersion;
    let settled = false;
    const finish = () => {
      if (settled || readySent) return;
      if (pending !== 0 || version !== mutationVersion) { settled = true; return scheduleReady(); }
      settled = true; readySent = true;
      native.postMessage({ method: 'ready' });
      window.dispatchEvent(new Event('slop:ready'));
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 100);
  };
  new MutationObserver(() => { mutationVersion += 1; scheduleReady(); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  const listeners = new Map();
  window.__hitslopEmit = event => (listeners.get(`${event.kind}:${event.store}`) || []).forEach(callback => callback(event));
  const watch = (kind, store, callback) => {
    const key = `${kind}:${store}`, values = listeners.get(key) || [];
    values.push(callback); listeners.set(key, values);
    return () => listeners.set(key, values.filter(value => value !== callback));
  };
  window.addEventListener('error', event => call('log', { message: `JavaScript error: ${event.message}` }));
  window.addEventListener('unhandledrejection', event => call('log', { message: `Unhandled rejection: ${String(event.reason)}` }));
  window.slop = Object.freeze({
    json: Object.freeze({
      read: store => call('json.read', { store }),
      write: (store, value, expectedRevision) => call('json.write', { store, value, expectedRevision }),
      onChange: (store, callback) => watch('json', store, callback)
    }),
    db: Object.freeze({
      query: (store, sql, parameters = []) => call('sqlite.query', { store, sql, parameters }),
      execute: (store, sql, parameters = []) => call('sqlite.execute', { store, sql, parameters }),
      transaction: (store, statements) => call('sqlite.transaction', { store, statements }),
      onChange: (store, callback) => watch('sqlite', store, callback)
    }),
    ready: () => { guestReady = true; document.documentElement.dataset.hitslopReady = 'true'; scheduleReady(); }
  });
})();
"""#

@MainActor public protocol SlopRuntimeSessionDelegate: AnyObject {
    func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession)
    func runtimeSessionDidReloadVisuals(_ session: SlopRuntimeSession)
    func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopStoreKind, storeID: String)
    func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error)
}

public extension SlopRuntimeSessionDelegate {
    func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) {}
    func runtimeSessionDidReloadVisuals(_ session: SlopRuntimeSession) {}
    func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopStoreKind, storeID: String) {}
    func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) {}
}

@MainActor final class SlopBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var session: SlopRuntimeSession?
    private let package: SlopPackage
    private var databases: [String: SlopDatabase] = [:]
    private var jsonStores: [String: SlopJSONStore] = [:]

    init(package: SlopPackage) throws {
        self.package = package
        for store in package.manifest.stores {
            let url = try package.store(id: store.id, kind: store.kind)
            if store.kind == .sqlite { databases[store.id] = try SlopDatabase(url: url) }
            else { jsonStores[store.id] = SlopJSONStore(url: url, maxBytes: store.maxBytes ?? 1_048_576) }
        }
    }
    func close() { databases.values.forEach { $0.close() } }
    func sqliteVersions() -> [String: Int64] { databases.compactMapValues { try? $0.dataVersion() } }
    func jsonRevisions() -> [String: String] { jsonStores.compactMapValues { try? $0.revision() } }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let method = body["method"] as? String else { replyHandler(nil, "Malformed host request"); return }
        do {
            switch method {
            case "log": print("[slop guest] \(body["message"] as? String ?? "Unknown diagnostic")"); replyHandler(["logged": true], nil)
            case "ready": session?.bridgeDidBecomeReady(); replyHandler(["ready": true], nil)
            case "json.read":
                let (id, store) = try json(body); let snapshot = try store.read()
                replyHandler(["store": id, "value": snapshot.value, "revision": snapshot.revision], nil)
            case "json.write":
                let (id, store) = try json(body); guard let value = body["value"] else { throw SlopPackageError.invalid("JSON write needs a value") }
                let revision = try store.write(value, expectedRevision: body["expectedRevision"] as? String)
                session?.bridgeDidCommit(kind: .json, storeID: id, revision: revision); replyHandler(["store": id, "revision": revision], nil)
            case "sqlite.query":
                let (_, database) = try database(body); let statement = try sql(body)
                replyHandler(try database.query(statement.0, parameters: statement.1), nil)
            case "sqlite.execute":
                let (id, database) = try database(body); let statement = try sql(body)
                let changes = try database.transaction([statement]) { try self.enforceSQLiteLimit(id) }
                session?.bridgeDidCommit(kind: .sqlite, storeID: id, revision: nil); replyHandler(changes, nil)
            case "sqlite.transaction":
                let (id, database) = try database(body)
                guard let payloads = body["statements"] as? [[String: Any]], !payloads.isEmpty else { throw SlopPackageError.invalid("transaction needs statements") }
                let changes = try database.transaction(payloads.map(sql)) { try self.enforceSQLiteLimit(id) }
                session?.bridgeDidCommit(kind: .sqlite, storeID: id, revision: nil); replyHandler(changes, nil)
            default: replyHandler(nil, "Unknown host method")
            }
        } catch { replyHandler(nil, error.localizedDescription) }
    }

    private func json(_ body: [String: Any]) throws -> (String, SlopJSONStore) {
        guard let id = body["store"] as? String, let store = jsonStores[id] else { throw SlopPackageError.invalid("unknown JSON store") }
        return (id, store)
    }
    private func database(_ body: [String: Any]) throws -> (String, SlopDatabase) {
        guard let id = body["store"] as? String, let store = databases[id] else { throw SlopPackageError.invalid("unknown SQLite store") }
        return (id, store)
    }
    private func sql(_ body: [String: Any]) throws -> (String, [Any]) {
        guard let sql = body["sql"] as? String, !sql.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw SlopPackageError.invalid("SQL must not be empty") }
        return (sql, body["parameters"] as? [Any] ?? [])
    }
    private func enforceSQLiteLimit(_ id: String) throws {
        guard let record = package.manifest.stores.first(where: { $0.id == id }), let maxBytes = record.maxBytes else { return }
        let url = try package.store(id: id, kind: .sqlite)
        let size = [url.path, url.path + "-wal"].reduce(0) { total, path in
            total + (((try? FileManager.default.attributesOfItem(atPath: path)[.size]) as? NSNumber)?.intValue ?? 0)
        }
        guard size <= maxBytes else { throw SlopPackageError.invalid("SQLite store exceeds maxBytes") }
    }
}

private final class SlopSchemeHandler: NSObject, WKURLSchemeHandler {
    private let package: SlopPackage
    init(package: SlopPackage) { self.package = package }
    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url else { task.didFailWithError(SlopPackageError.invalid("missing resource URL")); return }
        do {
            let resource = try resource(for: url)
            let headers = [
                "Content-Type": resource.mime, "Content-Length": String(resource.data.count), "Cache-Control": "no-store",
                "Cross-Origin-Resource-Policy": "same-origin",
                "Content-Security-Policy": "default-src 'none'; script-src slop: 'unsafe-inline'; style-src slop: 'unsafe-inline'; img-src slop: data: blob: https: http:; media-src slop: data: blob: https: http:; font-src slop: data: https: http:; connect-src https: http: wss: ws:; worker-src blob:"
            ]
            guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) else { throw SlopPackageError.invalid("could not serve resource") }
            task.didReceive(response); task.didReceive(resource.data); task.didFinish()
        } catch { print("[hitSlop scheme] \(error.localizedDescription)"); task.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    private func resource(for url: URL) throws -> (data: Data, mime: String) {
        switch url.path {
        case "", "/", "/index.html": return (try entryHTML(), "text/html; charset=utf-8")
        case "/style.css":
            guard FileManager.default.fileExists(atPath: package.styleURL.path) else { return (Data(), "text/css; charset=utf-8") }
            return (try Data(contentsOf: package.styleURL), "text/css; charset=utf-8")
        default:
            let resource = try package.assetURL(path: url.path)
            guard FileManager.default.fileExists(atPath: resource.path) else { throw SlopPackageError.missing(url.path) }
            return (try Data(contentsOf: resource), Self.mime(resource.pathExtension))
        }
    }
    private func entryHTML() throws -> Data {
        guard var html = String(data: try Data(contentsOf: package.entryURL), encoding: .utf8) else { throw SlopPackageError.invalid("build/index.html must be UTF-8") }
        let stylesheet = "<link id=\"hitslop-document-styles\" rel=\"stylesheet\" href=\"/style.css\">"
        if let close = html.range(of: "</head>", options: .caseInsensitive) { html.insert(contentsOf: "\n\(stylesheet)", at: close.lowerBound) }
        else { html = "<head>\(stylesheet)</head>\n" + html }
        return Data(html.utf8)
    }
    private static func mime(_ ext: String) -> String {
        ["png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "gif":"image/gif", "webp":"image/webp", "svg":"image/svg+xml", "css":"text/css", "json":"application/json", "woff":"font/woff", "woff2":"font/woff2", "mp3":"audio/mpeg", "mp4":"video/mp4"][ext.lowercased()] ?? "application/octet-stream"
    }
}

@MainActor public final class SlopRuntimeSession: NSObject, WKNavigationDelegate {
    public let package: SlopPackage
    public let webView: WKWebView
    public weak var delegate: (any SlopRuntimeSessionDelegate)?
    public private(set) var isReady = false
    private let bridge: SlopBridge
    private let schemeHandler: SlopSchemeHandler
    private var timer: Timer?, sqliteVersions: [String: Int64], jsonRevisions: [String: String]
    private var visualFingerprint: Int?, sequence = 0, retryCount = 0, closed = false, lastError: Error?

    public init(packageURL: URL) throws {
        let package = try SlopPackage(rootURL: packageURL); self.package = package
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .nonPersistent()
        let handler = SlopSchemeHandler(package: package); schemeHandler = handler; configuration.setURLSchemeHandler(handler, forURLScheme: "slop")
        configuration.userContentController.addUserScript(WKUserScript(source: runtimeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        let bridge = try SlopBridge(package: package); self.bridge = bridge
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "hitslop")
        webView = InteractiveWebView(frame: NSRect(x: 0, y: 0, width: package.manifest.window.width, height: package.manifest.window.height), configuration: configuration)
        sqliteVersions = bridge.sqliteVersions(); jsonRevisions = bridge.jsonRevisions()
        super.init()
        bridge.session = self; webView.navigationDelegate = self; webView.setValue(false, forKey: "drawsBackground")
        visualFingerprint = visualFilesFingerprint()
        timer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.poll() } }
    }

    public func load() { isReady = false; webView.load(URLRequest(url: URL(string: "slop://app/")!)) }
    public func reload() { isReady = false; webView.reload() }
    public func close() {
        guard !closed else { return }; closed = true; timer?.invalidate(); timer = nil; bridge.close()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "hitslop", contentWorld: .page)
    }
    public func waitUntilReady(timeout: Duration = .seconds(15)) async throws {
        if isReady { return }
        let clock = ContinuousClock(), deadline = clock.now.advanced(by: timeout)
        while !isReady, !closed, clock.now < deadline { try await Task.sleep(for: .milliseconds(40)) }
        guard isReady else {
            let state = try? await webView.evaluateJavaScript("({url:location.href,bridge:typeof window.slop,ready:document.documentElement.dataset.hitslopReady||null,state:document.readyState,body:document.body?.innerText?.slice(0,120)||null})")
            throw SlopPackageError.invalid(closed ? "runtime closed" : "timed out waiting for slop.ready(); guest state: \(String(describing: state)); navigation error: \(lastError?.localizedDescription ?? "none")")
        }
    }
    fileprivate func bridgeDidBecomeReady() {
        guard !isReady else { return }; isReady = true; retryCount = 0
        delegate?.runtimeSessionDidBecomeReady(self)
    }
    fileprivate func bridgeDidCommit(kind: SlopStoreKind, storeID: String, revision: String?) {
        sqliteVersions = bridge.sqliteVersions(); jsonRevisions = bridge.jsonRevisions(); emit(kind: kind, store: storeID, revision: revision, source: "app")
        delegate?.runtimeSession(self, didCommit: kind, storeID: storeID)
    }

    private func poll() {
        for (id, revision) in bridge.jsonRevisions() where jsonRevisions[id] != revision { jsonRevisions[id] = revision; emit(kind: .json, store: id, revision: revision, source: "external") }
        for (id, version) in bridge.sqliteVersions() where sqliteVersions[id] != version { sqliteVersions[id] = version; emit(kind: .sqlite, store: id, revision: nil, source: "external") }
        let fingerprint = visualFilesFingerprint()
        if fingerprint != visualFingerprint { visualFingerprint = fingerprint; reload(); delegate?.runtimeSessionDidReloadVisuals(self) }
    }
    private func emit(kind: SlopStoreKind, store: String, revision: String?, source: String) {
        sequence += 1
        let event: [String: Any] = ["kind":kind.rawValue, "store":store, "source":source, "sequence":sequence, "revision":revision ?? NSNull()]
        guard let data = try? JSONSerialization.data(withJSONObject: event), let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__hitslopEmit?.(\(json))")
    }
    private func visualFilesFingerprint() -> Int {
        var hasher = Hasher()
        for root in [package.entryURL, package.styleURL, package.rootURL.appendingPathComponent("assets")] {
            if let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey]) {
                for case let url as URL in enumerator { let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey]); hasher.combine(url.path); hasher.combine(values?.contentModificationDate); hasher.combine(values?.fileSize) }
            } else if let values = try? root.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey]) { hasher.combine(root.path); hasher.combine(values.contentModificationDate); hasher.combine(values.fileSize) }
        }
        return hasher.finalize()
    }
    public func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        let scheme = action.request.url?.scheme?.lowercased()
        if scheme == "slop" || scheme == "about" { decisionHandler(.allow) }
        else { if action.navigationType == .linkActivated, let url = action.request.url { NSWorkspace.shared.open(url) }; decisionHandler(.cancel) }
    }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { recover(error) }
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { recover(error) }
    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { recover(SlopPackageError.invalid("slop web process stopped")) }
    private func recover(_ error: Error) { lastError = error; if retryCount == 0 { retryCount = 1; load() } else { delegate?.runtimeSession(self, didFail: error) } }
}

private final class InteractiveWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override var mouseDownCanMoveWindow: Bool { false }
}
