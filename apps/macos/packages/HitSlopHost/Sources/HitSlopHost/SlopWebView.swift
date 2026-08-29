import AppKit
import CryptoKit
import Foundation
import HitSlopCore
import SQLite3
import SwiftUI
import WebKit

private let bridgeScript = #"""
(() => {
  const call = (method, args = {}) => window.webkit.messageHandlers.hitslop.postMessage({ method, ...args });
  const listeners = new Map();
  window.__hitslopEmit = event => (listeners.get(`${event.kind}:${event.store}`) || []).forEach(callback => callback(event));
  const watch = (kind, store, callback) => { const key = `${kind}:${store}`; const values = listeners.get(key) || []; values.push(callback); listeners.set(key, values); return () => listeners.set(key, values.filter(value => value !== callback)); };
  window.slop = {
    json: { read: store => call('json.read', {store}), write: (store, value, expectedRevision) => call('json.write', {store, value, expectedRevision}), onChange: (store, callback) => watch('json', store, callback) },
    db: { query: (store, sql, parameters = []) => call('sqlite.query', {store, sql, parameters}), execute: (store, sql, parameters = []) => call('sqlite.execute', {store, sql, parameters}), transaction: (store, statements) => call('sqlite.transaction', {store, statements}), onChange: (store, callback) => watch('sqlite', store, callback) },
    ready: () => document.documentElement.dataset.hitslopReady = 'true'
  };
})();
"""#

@MainActor public final class SlopBridge: NSObject, WKScriptMessageHandlerWithReply {
    private let package: SlopPackage
    weak var webView: WKWebView?
    public init(package: SlopPackage) { self.package = package }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let method = body["method"] as? String, let store = body["store"] as? String else { replyHandler(nil, "Invalid host request"); return }
        do {
            switch method {
            case "json.read":
                let url = try package.store(id: store, kind: .json); let data = try Data(contentsOf: url); replyHandler(["value": try JSONSerialization.jsonObject(with: data), "revision": Self.hash(data)], nil)
            case "json.write":
                let url = try package.store(id: store, kind: .json); let old = try Data(contentsOf: url); if let expected = body["expectedRevision"] as? String, !expected.isEmpty, expected != Self.hash(old) { throw SlopPackageError.invalid("revision_conflict") }
                let data = try JSONSerialization.data(withJSONObject: body["value"] as Any, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]); try data.write(to: url, options: .atomic); let revision = Self.hash(data); emit(kind: "json", store: store, revision: revision); replyHandler(["revision": revision], nil)
            case "sqlite.query": replyHandler(try sqlite(store: store, body: body, query: true), nil)
            case "sqlite.execute": let changes = try sqlite(store: store, body: body, query: false); emit(kind: "sqlite", store: store, revision: nil); replyHandler(changes, nil)
            case "sqlite.transaction": let changes = try transaction(store: store, body: body); emit(kind: "sqlite", store: store, revision: nil); replyHandler(changes, nil)
            default: replyHandler(nil, "Unknown host method")
            }
        } catch { replyHandler(nil, error.localizedDescription) }
    }

    private static func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private func emit(kind: String, store: String, revision: String?) { let event: [String: Any?] = ["kind": kind, "store": store, "source": "app", "revision": revision]; if let data = try? JSONSerialization.data(withJSONObject: event.compactMapValues { $0 }), let json = String(data: data, encoding: .utf8) { webView?.evaluateJavaScript("window.__hitslopEmit(\(json))") } }
    private func sqlite(store: String, body: [String: Any], query: Bool) throws -> Any {
        let url = try package.store(id: store, kind: .sqlite); var database: OpaquePointer?; guard sqlite3_open(url.path, &database) == SQLITE_OK, let database else { throw SlopPackageError.invalid("could not open SQLite store") }; defer { sqlite3_close(database) }
        return try runStatement(database: database, body: body, query: query)
    }
    private func runStatement(database: OpaquePointer, body: [String: Any], query: Bool) throws -> Any {
        var statement: OpaquePointer?; guard let sql = body["sql"] as? String, sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }; defer { sqlite3_finalize(statement) }
        try bind(body["parameters"] as? [Any] ?? [], to: statement)
        if !query { guard sqlite3_step(statement) == SQLITE_DONE else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }; return Int(sqlite3_changes(database)) }
        var rows: [[String: Any]] = []; while sqlite3_step(statement) == SQLITE_ROW { var row: [String: Any] = [:]; for column in 0..<sqlite3_column_count(statement) { let name = String(cString: sqlite3_column_name(statement, column)); switch sqlite3_column_type(statement, column) { case SQLITE_INTEGER: row[name] = sqlite3_column_int64(statement, column); case SQLITE_FLOAT: row[name] = sqlite3_column_double(statement, column); case SQLITE_TEXT: if let text = sqlite3_column_text(statement, column) { row[name] = String(cString: text) }; case SQLITE_NULL: row[name] = NSNull(); default: if let bytes = sqlite3_column_blob(statement, column) { row[name] = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, column))).base64EncodedString() } else { row[name] = Data().base64EncodedString() } } }; rows.append(row) }; return rows
    }
    private func transaction(store: String, body: [String: Any]) throws -> Int {
        guard let statements = body["statements"] as? [[String: Any]] else { return 0 }
        let url = try package.store(id: store, kind: .sqlite); var database: OpaquePointer?; guard sqlite3_open(url.path, &database) == SQLITE_OK, let database else { throw SlopPackageError.invalid("could not open SQLite store") }; defer { sqlite3_close(database) }
        guard sqlite3_exec(database, "BEGIN IMMEDIATE", nil, nil, nil) == SQLITE_OK else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }
        do { var changes = 0; for statement in statements { changes += try runStatement(database: database, body: statement, query: false) as? Int ?? 0 }; guard sqlite3_exec(database, "COMMIT", nil, nil, nil) == SQLITE_OK else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }; return changes }
        catch { sqlite3_exec(database, "ROLLBACK", nil, nil, nil); throw error }
    }
    private func bind(_ parameters: [Any], to statement: OpaquePointer) throws {
        for (offset, value) in parameters.enumerated() { let index = Int32(offset + 1); let result: Int32
            if value is NSNull { result = sqlite3_bind_null(statement, index) }
            else if let value = value as? Bool { result = sqlite3_bind_int(statement, index, value ? 1 : 0) }
            else if let value = value as? Int { result = sqlite3_bind_int64(statement, index, Int64(value)) }
            else if let value = value as? Double { result = sqlite3_bind_double(statement, index, value) }
            else { result = String(describing: value).withCString { sqlite3_bind_text(statement, index, $0, -1, SQLITE_TRANSIENT) } }
            guard result == SQLITE_OK else { throw SlopPackageError.invalid("could not bind SQLite parameter") }
        }
    }
}

@MainActor public enum SlopWebViewFactory {
    public static func make(packageURL: URL) throws -> (WKWebView, SlopBridge) {
        let package = try SlopPackage(rootURL: packageURL); let controller = WKUserContentController(); controller.addUserScript(WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if let css = try? String(contentsOf: package.styleURL, encoding: .utf8) { let escaped = css.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "`", with: "\\`"); controller.addUserScript(WKUserScript(source: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=`\(escaped)`;document.head.appendChild(s)})", injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        let configuration = WKWebViewConfiguration(); configuration.userContentController = controller; let view = WKWebView(frame: .init(x: 0, y: 0, width: package.metadata.window.width, height: package.metadata.window.height), configuration: configuration); let bridge = SlopBridge(package: package); bridge.webView = view; controller.addScriptMessageHandler(bridge, contentWorld: .page, name: "hitslop"); view.loadFileURL(package.entryURL, allowingReadAccessTo: package.rootURL); return (view, bridge)
    }
}

public struct SlopDocumentView: NSViewRepresentable {
    public let packageURL: URL
    public init(packageURL: URL) { self.packageURL = packageURL }
    public func makeCoordinator() -> Coordinator { Coordinator() }
    public func makeNSView(context: Context) -> WKWebView { do { let (view, bridge) = try SlopWebViewFactory.make(packageURL: packageURL); context.coordinator.bridge = bridge; return view } catch { return WKWebView() } }
    public func updateNSView(_ nsView: WKWebView, context: Context) {}
    public final class Coordinator { var bridge: SlopBridge? }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
