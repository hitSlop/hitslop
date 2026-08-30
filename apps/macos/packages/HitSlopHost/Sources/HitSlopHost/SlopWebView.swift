import AppKit
import CryptoKit
import Darwin
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

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

@MainActor public final class SlopBridge: NSObject, WKScriptMessageHandlerWithReply {
    private let package: SlopPackage
    weak var webView: WKWebView?
    nonisolated(unsafe) private var databases: [String: OpaquePointer] = [:]
    nonisolated(unsafe) private var watchers: [DispatchSourceFileSystemObject] = []
    private var revisions: [String: String] = [:]

    public init(package: SlopPackage) {
        self.package = package
        super.init()
        startWatching()
    }

    deinit {
        watchers.forEach { $0.cancel() }
        databases.values.forEach { sqlite3_close($0) }
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let method = body["method"] as? String, let store = body["store"] as? String else { replyHandler(nil, "Invalid host request"); return }
        do {
            switch method {
            case "json.read":
                let url = try package.store(id: store, kind: .json); let data = try Data(contentsOf: url); replyHandler(["value": try JSONSerialization.jsonObject(with: data), "revision": Self.hash(data)], nil)
            case "json.write":
                let record = try package.storeRecord(id: store, kind: .json); let url = try package.store(id: store, kind: .json)
                let old = try Data(contentsOf: url); if let expected = body["expectedRevision"] as? String, !expected.isEmpty, expected != Self.hash(old) { throw SlopPackageError.invalid("revision_conflict") }
                let data = try JSONSerialization.data(withJSONObject: body["value"] as Any, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
                if let maxBytes = record.maxBytes, data.count > maxBytes { throw SlopPackageError.invalid("store exceeds maxBytes") }
                try data.write(to: url, options: .atomic); let revision = Self.hash(data); revisions["json:\(store)"] = revision; emit(kind: "json", store: store, revision: revision); replyHandler(["revision": revision], nil)
            case "sqlite.query": replyHandler(try sqlite(store: store, body: body, query: true), nil)
            case "sqlite.execute": let changes = try sqlite(store: store, body: body, query: false); emitSqliteIfNeeded(store); replyHandler(changes, nil)
            case "sqlite.transaction": let changes = try transaction(store: store, body: body); emitSqliteIfNeeded(store); replyHandler(changes, nil)
            default: replyHandler(nil, "Unknown host method")
            }
        } catch { replyHandler(nil, error.localizedDescription) }
    }

    private static func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }

    private func emit(kind: String, store: String, revision: String?) {
        var event: [String: Any] = ["kind": kind, "store": store, "source": "package"]
        if let revision { event["revision"] = revision }
        guard let data = try? JSONSerialization.data(withJSONObject: event), let encoded = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.__hitslopEmit(\(encoded))")
    }

    private func emitSqliteIfNeeded(_ store: String) {
        let revision = sqliteRevision(store)
        if revisions["sqlite:\(store)"] != revision {
            revisions["sqlite:\(store)"] = revision
            emit(kind: "sqlite", store: store, revision: revision)
        }
    }

    private func sqliteRevision(_ store: String) -> String {
        guard let url = try? package.store(id: store, kind: .sqlite) else { return "" }
        let values = [url, URL(fileURLWithPath: url.path + "-wal"), URL(fileURLWithPath: url.path + "-shm")].compactMap { url -> String? in
            guard let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]) else { return nil }
            return "\(values.fileSize ?? 0):\(values.contentModificationDate?.timeIntervalSince1970 ?? 0)"
        }
        return values.joined(separator: "|")
    }

    private func database(for store: String) throws -> OpaquePointer {
        if let existing = databases[store] { return existing }
        let record = try package.storeRecord(id: store, kind: .sqlite)
        let url = try package.store(id: store, kind: .sqlite)
        var database: OpaquePointer?
        guard sqlite3_open_v2(url.path, &database, SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK, let database else { throw SlopPackageError.invalid("could not open SQLite store") }
        sqlite3_limit(database, SQLITE_LIMIT_ATTACHED, 0)
        sqlite3_set_authorizer(database, { _, action, _, _, _, _ in
            switch action {
            case SQLITE_ATTACH, SQLITE_DETACH: return SQLITE_DENY
            default: return SQLITE_OK
            }
        }, nil)
        sqlite3_busy_timeout(database, 5000)
        sqlite3_exec(database, "PRAGMA trusted_schema=OFF", nil, nil, nil)
        sqlite3_exec(database, "PRAGMA journal_mode=WAL", nil, nil, nil)
        sqlite3_exec(database, "PRAGMA foreign_keys=ON", nil, nil, nil)
        if let maxBytes = record.maxBytes { _ = maxBytes }
        databases[store] = database
        return database
    }

    private func sqlite(store: String, body: [String: Any], query: Bool) throws -> Any {
        let database = try database(for: store)
        if query { return try runStatement(database: database, body: body, query: true) }
        guard sqlite3_exec(database, "BEGIN IMMEDIATE", nil, nil, nil) == SQLITE_OK else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }
        do {
            let changes = try runStatement(database: database, body: body, query: false)
            try enforceMaxBytes(store: store, database: database)
            guard sqlite3_exec(database, "COMMIT", nil, nil, nil) == SQLITE_OK else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }
            return changes
        } catch {
            sqlite3_exec(database, "ROLLBACK", nil, nil, nil)
            throw error
        }
    }

    private func runStatement(database: OpaquePointer, body: [String: Any], query: Bool) throws -> Any {
        var statement: OpaquePointer?
        guard let sql = body["sql"] as? String, sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }
        defer { sqlite3_finalize(statement) }
        try bind(body["parameters"] as? [Any] ?? [], to: statement)
        if !query { guard sqlite3_step(statement) == SQLITE_DONE else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }; return Int(sqlite3_changes(database)) }
        var rows: [[String: Any]] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            var row: [String: Any] = [:]
            for column in 0..<sqlite3_column_count(statement) {
                let name = String(cString: sqlite3_column_name(statement, column))
                switch sqlite3_column_type(statement, column) {
                case SQLITE_INTEGER: row[name] = sqlite3_column_int64(statement, column)
                case SQLITE_FLOAT: row[name] = sqlite3_column_double(statement, column)
                case SQLITE_TEXT: if let text = sqlite3_column_text(statement, column) { row[name] = String(cString: text) }
                case SQLITE_NULL: row[name] = NSNull()
                default:
                    if let bytes = sqlite3_column_blob(statement, column) { row[name] = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, column))).base64EncodedString() }
                    else { row[name] = Data().base64EncodedString() }
                }
            }
            rows.append(row)
        }
        return rows
    }

    private func transaction(store: String, body: [String: Any]) throws -> Int {
        guard let statements = body["statements"] as? [[String: Any]] else { return 0 }
        let database = try database(for: store)
        guard sqlite3_exec(database, "BEGIN IMMEDIATE", nil, nil, nil) == SQLITE_OK else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }
        do {
            var changes = 0
            for statement in statements { changes += try runStatement(database: database, body: statement, query: false) as? Int ?? 0 }
            try enforceMaxBytes(store: store, database: database)
            guard sqlite3_exec(database, "COMMIT", nil, nil, nil) == SQLITE_OK else { throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(database))) }
            return changes
        } catch {
            sqlite3_exec(database, "ROLLBACK", nil, nil, nil)
            throw error
        }
    }

    private func enforceMaxBytes(store: String, database: OpaquePointer) throws {
        guard let maxBytes = try package.storeRecord(id: store, kind: .sqlite).maxBytes else { return }
        sqlite3_exec(database, "PRAGMA wal_checkpoint(PASSIVE)", nil, nil, nil)
        let url = try package.store(id: store, kind: .sqlite)
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        let wal = (try? URL(fileURLWithPath: url.path + "-wal").resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        if size + wal > maxBytes { throw SlopPackageError.invalid("store exceeds maxBytes") }
    }

    private func bind(_ parameters: [Any], to statement: OpaquePointer) throws {
        for (offset, value) in parameters.enumerated() {
            let index = Int32(offset + 1)
            let result: Int32
            if value is NSNull { result = sqlite3_bind_null(statement, index) }
            else if let value = value as? Bool { result = sqlite3_bind_int(statement, index, value ? 1 : 0) }
            else if let value = value as? Int { result = sqlite3_bind_int64(statement, index, Int64(value)) }
            else if let value = value as? Double { result = sqlite3_bind_double(statement, index, value) }
            else { result = String(describing: value).withCString { sqlite3_bind_text(statement, index, $0, -1, SQLITE_TRANSIENT) } }
            guard result == SQLITE_OK else { throw SlopPackageError.invalid("could not bind SQLite parameter") }
        }
    }

    private func startWatching() {
        var directories = Set<URL>([package.rootURL])
        for store in package.manifest.stores {
            if let url = try? package.store(id: store.id, kind: store.kind) {
                directories.insert(url.deletingLastPathComponent())
                if store.kind == .json { revisions["json:\(store.id)"] = (try? Self.hash(Data(contentsOf: url))) ?? "" }
                else { revisions["sqlite:\(store.id)"] = sqliteRevision(store.id) }
            }
        }
        for directory in directories { watch(directory: directory) }
    }

    private func watch(directory: URL) {
        let fd = open(directory.path, O_EVTONLY)
        guard fd >= 0 else { return }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: [.write, .extend, .attrib, .rename, .delete, .link], queue: .main)
        source.setCancelHandler { Darwin.close(fd) }
        source.setEventHandler { [weak self] in self?.packageChanged() }
        source.resume()
        watchers.append(source)
    }

    private func packageChanged() {
        for store in package.manifest.stores {
            if store.kind == .json, let url = try? package.store(id: store.id, kind: .json), let data = try? Data(contentsOf: url) {
                let revision = Self.hash(data)
                if revisions["json:\(store.id)"] != revision { revisions["json:\(store.id)"] = revision; emit(kind: "json", store: store.id, revision: revision) }
            } else if store.kind == .sqlite {
                let revision = sqliteRevision(store.id)
                if revisions["sqlite:\(store.id)"] != revision { revisions["sqlite:\(store.id)"] = revision; emit(kind: "sqlite", store: store.id, revision: revision) }
            }
        }
    }
}

@MainActor public enum SlopWebViewFactory {
    public static func make(packageURL: URL) throws -> (WKWebView, SlopBridge) {
        let package = try SlopPackage(rootURL: packageURL)
        let controller = WKUserContentController()
        controller.addUserScript(WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if let css = try? String(contentsOf: package.styleURL, encoding: .utf8),
           let encoded = try? JSONSerialization.data(withJSONObject: css, options: [.fragmentsAllowed]),
           let json = String(data: encoded, encoding: .utf8) {
            controller.addUserScript(WKUserScript(source: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=\(json);document.head.appendChild(s)})", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        let view = WKWebView(frame: .init(x: 0, y: 0, width: package.manifest.window.width, height: package.manifest.window.height), configuration: configuration)
        let bridge = SlopBridge(package: package)
        bridge.webView = view
        controller.addScriptMessageHandler(bridge, contentWorld: .page, name: "hitslop")
        view.setValue(false, forKey: "drawsBackground")
        view.loadFileURL(package.entryURL, allowingReadAccessTo: package.rootURL)
        return (view, bridge)
    }
}

public struct SlopDocumentView: NSViewRepresentable {
    public let packageURL: URL
    public init(packageURL: URL) { self.packageURL = packageURL }
    public func makeCoordinator() -> Coordinator { Coordinator() }
    public func makeNSView(context: Context) -> WKWebView {
        do { let (view, bridge) = try SlopWebViewFactory.make(packageURL: packageURL); context.coordinator.bridge = bridge; return view }
        catch { return WKWebView() }
    }
    public func updateNSView(_ nsView: WKWebView, context: Context) {}
    public final class Coordinator { var bridge: SlopBridge? }
}
