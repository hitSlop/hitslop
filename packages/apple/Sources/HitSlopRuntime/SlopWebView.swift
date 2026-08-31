#if os(macOS)
import AppKit
#else
import UIKit
#endif
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
  const listeners = { json: [], sqlite: [] };
  window.__hitslopEmit = event => listeners[event.kind].forEach(callback => callback(event));
  const watch = (kind, callback) => { listeners[kind].push(callback); return () => { listeners[kind] = listeners[kind].filter(value => value !== callback); }; };
  window.addEventListener('error', event => call('log', { message: `JavaScript error: ${event.message}` }));
  window.addEventListener('unhandledrejection', event => call('log', { message: `Unhandled rejection: ${String(event.reason)}` }));
  window.slop = Object.freeze({
    json: Object.freeze({
      open: value => call('json.open', { value }),
      read: () => call('json.read'),
      write: (value, expectedRevision) => call('json.write', { value, expectedRevision }),
      onChange: callback => watch('json', callback)
    }),
    db: Object.freeze({
      query: (sql, parameters = []) => call('sqlite.query', { sql, parameters }),
      execute: (sql, parameters = []) => call('sqlite.execute', { sql, parameters }),
      transaction: statements => call('sqlite.transaction', { statements }),
      onChange: callback => watch('sqlite', callback)
    }),
    ready: () => { guestReady = true; document.documentElement.dataset.hitslopReady = 'true'; scheduleReady(); }
  });
})();
"""#

@MainActor public protocol SlopRuntimeSessionDelegate: AnyObject {
    func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession)
    func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopStoreKind)
    func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error)
}

public extension SlopRuntimeSessionDelegate {
    func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) {}
    func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopStoreKind) {}
    func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) {}
}

@MainActor final class SlopBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var session: SlopRuntimeSession?
    private let package: SlopPackage
    private let jsonStore: SlopJSONStore
    private var sqliteStore: SlopDatabase?

    init(package: SlopPackage) { self.package = package; jsonStore = SlopJSONStore(url: package.jsonStoreURL) }
    func close() { sqliteStore?.close() }
    func checkpoint() { sqliteStore?.checkpoint() }
    func sqliteVersion() -> Int64? { try? sqliteStore?.dataVersion() }
    func jsonRevision() -> String? { try? jsonStore.revision() }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let method = body["method"] as? String else { replyHandler(nil, "Malformed host request"); return }
        do {
            switch method {
            case "log": print("[slop guest] \(body["message"] as? String ?? "Unknown diagnostic")"); replyHandler(["logged": true], nil)
            case "ready": session?.bridgeDidBecomeReady(); replyHandler(["ready": true], nil)
            case "json.open":
                guard let value = body["value"] else { throw SlopPackageError.invalid("JSON open needs an initial value") }
                let wasMissing = jsonRevision() == nil, snapshot = try jsonStore.open(value)
                if wasMissing { session?.bridgeDidCommit(kind: .json, revision: snapshot.revision) }
                replyHandler(["value": snapshot.value, "revision": snapshot.revision], nil)
            case "json.read":
                let snapshot = try jsonStore.read(); replyHandler(["value": snapshot.value, "revision": snapshot.revision], nil)
            case "json.write":
                guard let value = body["value"] else { throw SlopPackageError.invalid("JSON write needs a value") }
                let revision = try jsonStore.write(value, expectedRevision: body["expectedRevision"] as? String)
                session?.bridgeDidCommit(kind: .json, revision: revision); replyHandler(["revision": revision], nil)
            case "sqlite.query":
                let statement = try sql(body); replyHandler(try database().query(statement.0, parameters: statement.1), nil)
            case "sqlite.execute":
                let statement = try sql(body), changes = try database().transaction([statement])
                session?.bridgeDidCommit(kind: .sqlite, revision: nil); replyHandler(changes, nil)
            case "sqlite.transaction":
                guard let payloads = body["statements"] as? [[String: Any]], !payloads.isEmpty else { throw SlopPackageError.invalid("transaction needs statements") }
                let changes = try database().transaction(payloads.map(sql)); session?.bridgeDidCommit(kind: .sqlite, revision: nil); replyHandler(changes, nil)
            default: replyHandler(nil, "Unknown host method")
            }
        } catch { replyHandler(nil, error.localizedDescription) }
    }

    private func database() throws -> SlopDatabase {
        if let sqliteStore { return sqliteStore }
        let store = try SlopDatabase(url: package.sqliteStoreURL); sqliteStore = store; return store
    }
    private func sql(_ body: [String: Any]) throws -> (String, [Any]) {
        guard let sql = body["sql"] as? String, !sql.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw SlopPackageError.invalid("SQL must not be empty") }
        return (sql, body["parameters"] as? [Any] ?? [])
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
        if ["", "/", "/index.html"].contains(url.path) { return (try Data(contentsOf: package.entryURL), "text/html; charset=utf-8") }
        let resource = try package.assetURL(path: url.path)
        guard FileManager.default.fileExists(atPath: resource.path) else { throw SlopPackageError.missing(url.path) }
        return (try Data(contentsOf: resource), Self.mime(resource.pathExtension))
    }
    private static func mime(_ ext: String) -> String {
        ["png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "gif":"image/gif", "webp":"image/webp", "svg":"image/svg+xml", "css":"text/css", "json":"application/json", "woff":"font/woff", "woff2":"font/woff2", "mp3":"audio/mpeg", "mp4":"video/mp4"][ext.lowercased()] ?? "application/octet-stream"
    }
}

@MainActor public final class SlopRuntimeSession: NSObject, WKNavigationDelegate {
    public let package: SlopPackage
    public let webView: WKWebView
    let usesTransparentBackground: Bool
    public weak var delegate: (any SlopRuntimeSessionDelegate)?
    public var onStoreCommit: (() -> Void)?
    public private(set) var isReady = false
    private let bridge: SlopBridge
    private let schemeHandler: SlopSchemeHandler
    private var timer: Timer?, sqliteVersion: Int64?, jsonRevision: String?, sequence = 0, retryCount = 0, closed = false, lastError: Error?

    public init(packageURL: URL) throws {
        let package = try SlopPackage(rootURL: packageURL); self.package = package
        usesTransparentBackground = package.isSkinned
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .nonPersistent()
        let handler = SlopSchemeHandler(package: package); schemeHandler = handler; configuration.setURLSchemeHandler(handler, forURLScheme: "slop")
        configuration.userContentController.addUserScript(WKUserScript(source: runtimeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        let bridge = SlopBridge(package: package); self.bridge = bridge
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "hitslop")
        let frame = CGRect(x: 0, y: 0, width: package.manifest.presentation.width, height: package.manifest.presentation.height)
        #if os(macOS)
        webView = InteractiveWebView(frame: frame, configuration: configuration)
        webView.setValue(!usesTransparentBackground, forKey: "drawsBackground")
        #else
        webView = WKWebView(frame: frame, configuration: configuration)
        webView.isOpaque = !usesTransparentBackground
        webView.backgroundColor = usesTransparentBackground ? .clear : .systemBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        sqliteVersion = bridge.sqliteVersion(); jsonRevision = bridge.jsonRevision()
        super.init(); bridge.session = self; webView.navigationDelegate = self
        timer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.poll() } }
    }

    public func load() { isReady = false; webView.load(URLRequest(url: URL(string: "slop://app/")!)) }
    public func reload() { isReady = false; webView.reload() }
    public func checkpoint() { bridge.checkpoint() }
    public func close() { guard !closed else { return }; closed = true; timer?.invalidate(); timer = nil; bridge.close(); webView.configuration.userContentController.removeScriptMessageHandler(forName: "hitslop", contentWorld: .page) }
    public func waitUntilReady(timeout: Duration = .seconds(15)) async throws {
        if isReady { return }
        let clock = ContinuousClock(), deadline = clock.now.advanced(by: timeout)
        while !isReady, !closed, clock.now < deadline { try await Task.sleep(for: .milliseconds(40)) }
        guard isReady else {
            let state = try? await webView.evaluateJavaScript("({url:location.href,bridge:typeof window.slop,ready:document.documentElement.dataset.hitslopReady||null,state:document.readyState,body:document.body?.innerText?.slice(0,120)||null})")
            throw SlopPackageError.invalid(closed ? "runtime closed" : "timed out waiting for slop.ready(); guest state: \(String(describing: state)); navigation error: \(lastError?.localizedDescription ?? "none")")
        }
    }
    fileprivate func bridgeDidBecomeReady() { guard !isReady else { return }; isReady = true; retryCount = 0; delegate?.runtimeSessionDidBecomeReady(self) }
    fileprivate func bridgeDidCommit(kind: SlopStoreKind, revision: String?) {
        sqliteVersion = bridge.sqliteVersion(); jsonRevision = bridge.jsonRevision(); emit(kind: kind, revision: revision, source: "app"); onStoreCommit?(); delegate?.runtimeSession(self, didCommit: kind)
    }
    private func poll() {
        let nextJSON = bridge.jsonRevision(); if nextJSON != jsonRevision { jsonRevision = nextJSON; if nextJSON != nil { emit(kind: .json, revision: nextJSON, source: "external") } }
        let nextSQLite = bridge.sqliteVersion(); if nextSQLite != sqliteVersion { sqliteVersion = nextSQLite; if nextSQLite != nil { emit(kind: .sqlite, revision: nil, source: "external") } }
    }
    private func emit(kind: SlopStoreKind, revision: String?, source: String) {
        sequence += 1; let event: [String: Any] = ["kind":kind.rawValue, "source":source, "sequence":sequence, "revision":revision ?? NSNull()]
        guard let data = try? JSONSerialization.data(withJSONObject: event), let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__hitslopEmit?.(\(json))")
    }
    public func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        let scheme = action.request.url?.scheme?.lowercased()
        if scheme == "slop" || scheme == "about" { decisionHandler(.allow) }
        else { if action.navigationType == .linkActivated, let url = action.request.url {
            #if os(macOS)
            NSWorkspace.shared.open(url)
            #else
            UIApplication.shared.open(url)
            #endif
        }; decisionHandler(.cancel) }
    }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { recover(error) }
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { recover(error) }
    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { recover(SlopPackageError.invalid("slop web process stopped")) }
    private func recover(_ error: Error) { lastError = error; if retryCount == 0 { retryCount = 1; load() } else { delegate?.runtimeSession(self, didFail: error) } }
}

#if os(macOS)
private final class InteractiveWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override var mouseDownCanMoveWindow: Bool { false }
}
#endif
