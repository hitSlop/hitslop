import Foundation
import SlopCore
import WebKit

@MainActor
protocol SlopBridgeDelegate: AnyObject {
    func slopBridgeDidCommit(kind: SlopManifest.StoreKind, storeID: String, revision: String?)
    func slopBridgeDidBecomeReady()
}

@MainActor
final class SlopBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var delegate: SlopBridgeDelegate?
    private let package: SlopPackage
    private var databases: [String: SlopDatabase] = [:]
    private var jsonStores: [String: SlopJSONStore] = [:]

    init(package: SlopPackage) throws {
        self.package = package
        for store in package.manifest.stores {
            let url = try package.storeURL(id: store.id, kind: store.kind)
            switch store.kind {
            case .sqlite: databases[store.id] = try SlopDatabase(url: url)
            case .json:
                jsonStores[store.id] = SlopJSONStore(
                    url: url,
                    maxBytes: store.maxBytes ?? SlopJSONStore.defaultMaxBytes
                )
            }
        }
    }

    func sqliteVersions() -> [String: Int64] { databases.compactMapValues { try? $0.dataVersion() } }
    func jsonRevisions() -> [String: String] { jsonStores.compactMapValues { try? $0.revision() } }
    func close() { databases.values.forEach { $0.close() } }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        do {
            guard let body = message.body as? [String: Any], let operation = body["op"] as? String else {
                throw SlopHostError.invalidBridgeValue("Malformed storage request")
            }
            switch operation {
            case "log":
                print("[slop guest] \(body["message"] as? String ?? "Unknown guest diagnostic")")
                replyHandler(["logged": true], nil)
            case "query":
                let (id, database) = try database(from: body)
                let (sql, parameters) = try statement(from: body)
                replyHandler(["store": id, "rows": try database.query(sql, parameters: parameters).map(Self.jsonRow)], nil)
            case "execute":
                let (id, database) = try database(from: body)
                let (sql, parameters) = try statement(from: body)
                replyHandler(["changes": try database.execute(sql, parameters: parameters)], nil)
                notify(kind: .sqlite, id: id, revision: nil)
            case "transaction":
                let (id, database) = try database(from: body)
                guard let payloads = body["statements"] as? [[String: Any]], !payloads.isEmpty else {
                    throw SlopHostError.invalidBridgeValue("A transaction needs at least one statement")
                }
                replyHandler(["changes": try database.transaction(payloads.map { try statement(from: $0) })], nil)
                notify(kind: .sqlite, id: id, revision: nil)
            case "jsonRead":
                let (id, store) = try jsonStore(from: body)
                let snapshot = try store.read()
                replyHandler(["store": id, "value": snapshot.value, "revision": snapshot.revision], nil)
            case "jsonWrite":
                let (id, store) = try jsonStore(from: body)
                guard let value = body["value"] else {
                    throw SlopHostError.invalidBridgeValue("A JSON write needs a value")
                }
                let snapshot = try store.write(value, expectedRevision: body["expectedRevision"] as? String)
                replyHandler(["store": id, "revision": snapshot.revision], nil)
                notify(kind: .json, id: id, revision: snapshot.revision)
            case "ready":
                delegate?.slopBridgeDidBecomeReady()
                replyHandler(["ready": true], nil)
            default:
                throw SlopHostError.invalidBridgeValue("Unknown storage operation: \(operation)")
            }
        } catch {
            replyHandler(nil, error.localizedDescription)
        }
    }

    private func notify(kind: SlopManifest.StoreKind, id: String, revision: String?) {
        DispatchQueue.main.async { [weak self] in
            self?.delegate?.slopBridgeDidCommit(kind: kind, storeID: id, revision: revision)
        }
    }

    private func database(from body: [String: Any]) throws -> (String, SlopDatabase) {
        let id = body["store"] as? String ?? package.defaultSQLiteStoreID
        guard let id, let value = databases[id] else {
            throw SlopHostError.invalidBridgeValue("Unknown SQLite store: \(id ?? "none")")
        }
        return (id, value)
    }

    private func jsonStore(from body: [String: Any]) throws -> (String, SlopJSONStore) {
        let id = body["store"] as? String ?? package.defaultJSONStoreID
        guard let id, let value = jsonStores[id] else {
            throw SlopHostError.invalidBridgeValue("Unknown JSON store: \(id ?? "none")")
        }
        return (id, value)
    }

    private func statement(from body: [String: Any]) throws -> (sql: String, parameters: [Any]) {
        guard let sql = body["sql"] as? String, !sql.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw SlopHostError.invalidBridgeValue("SQL must be a non-empty string")
        }
        return (sql, body["parameters"] as? [Any] ?? [])
    }

    private static func jsonRow(_ row: [String: Any]) -> [String: Any] {
        row.mapValues { value in
            if let data = value as? Data { return ["$blob": data.base64EncodedString()] }
            return value
        }
    }
}
