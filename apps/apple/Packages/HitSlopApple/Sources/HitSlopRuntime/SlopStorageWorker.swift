import Foundation
import DynamicJSON
import HitSlopCore

struct SlopStorageResult: @unchecked Sendable {
    let value: Any
    var kind: SlopStoreKind? = nil
    var revision: String? = nil
    var name: String? = nil
}
struct SlopRevisions: Sendable {
    let json: String?
    let sqlite: Int64?
    let media: String?
    let theme: String?
}

/// All store access is serialized here, never on the UI actor. Any values cross
/// the queue only in immutable request/result snapshots.
final class SlopStorageWorker: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.hitslop.document-storage", qos: .userInitiated)
    private let package: SlopPackage
    private let json: SlopJSONStore
    private let media: SlopMediaStore
    private let theme: SlopThemeStore
    private var sqlite: SlopDatabase?
    private var closed = false

    init(package: SlopPackage) {
        self.package = package
        json = SlopJSONStore(url: package.jsonStoreURL, schemaURL: package.rootURL.appendingPathComponent("data.schema.json"))
        media = SlopMediaStore(directoryURL: package.mediaStoresURL)
        theme = SlopThemeStore(url: package.themeOverrideURL)
    }
    func close() { queue.sync { closed = true; sqlite?.close() } }
    func checkpoint() { queue.sync { sqlite?.checkpoint() } }
    func revisions() async -> SlopRevisions {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: SlopRevisions(json: try? self.json.revision(), sqlite: try? self.sqlite?.dataVersion(), media: try? self.media.directoryRevision(), theme: try? self.theme.revision()))
            }
        }
    }
    func perform(_ data: Data) async throws -> SlopStorageResult {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                do {
                    guard !self.closed else { throw SlopBridgeFailure(.closed, "Document is closed") }
                    guard let body = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                        throw SlopBridgeFailure(.invalidRequest, "Expected a request object")
                    }
                    continuation.resume(returning: try self.handle(body))
                } catch { continuation.resume(throwing: error) }
            }
        }
    }
    private func database() throws -> SlopDatabase {
        if let sqlite { return sqlite }
        let database = try SlopDatabase(url: package.sqliteStoreURL)
        sqlite = database
        return database
    }
    private func statement(_ body: [String: Any]) throws -> (String, [Any]) {
        guard let sql = body["sql"] as? String else { throw SlopBridgeFailure(.invalidRequest, "Missing SQL") }
        return (sql, body["parameters"] as? [Any] ?? [])
    }
    private func field<T>(_ name: String, in body: [String: Any], as type: T.Type = T.self) throws -> T {
        guard let raw = body[name], let value = raw as? T else { throw SlopBridgeFailure(.invalidRequest, "Missing or invalid \(name)") }
        return value
    }
    private func handle(_ body: [String: Any]) throws -> SlopStorageResult {
        guard let raw = body["method"] as? String, let method = SlopBridgeMethod(rawValue: raw) else {
            throw SlopBridgeFailure(.invalidRequest, "Missing or unknown method")
        }
        switch method {
        case .jsonOpen:
            let missing = !FileManager.default.fileExists(atPath: package.jsonStoreURL.path)
            let snapshot = try json.open(field("value", in: body, as: Any.self))
            return .init(value: ["value": snapshot.value, "revision": snapshot.revision], kind: missing ? .json : nil, revision: snapshot.revision)
        case .jsonRead:
            let snapshot = try json.read()
            return .init(value: ["value": snapshot.value, "revision": snapshot.revision])
        case .jsonWrite:
            let revision = try json.write(field("value", in: body, as: Any.self), expectedRevision: body["expectedRevision"] as? String)
            return .init(value: ["revision": revision], kind: .json, revision: revision)
        case .sqliteQuery:
            let sql = try statement(body)
            return .init(value: try database().query(sql.0, parameters: sql.1))
        case .sqliteExecute:
            return .init(value: try database().transaction([statement(body)]), kind: .sqlite)
        case .sqliteTransaction:
            let statements: [[String: Any]] = try field("statements", in: body)
            return .init(value: try database().transaction(statements.map(statement)), kind: .sqlite)
        case .mediaOpen:
            let snapshot = try media.open(field("name", in: body))
            return .init(value: ["exists": snapshot.exists, "revision": snapshot.revision as Any? ?? NSNull()])
        case .mediaWrite:
            let name: String = try field("name", in: body)
            let revision = try media.write(name, base64: field("data", in: body))
            return .init(value: ["revision": revision], kind: .media, revision: revision, name: name)
        case .mediaRemove:
            let name: String = try field("name", in: body)
            try media.remove(name)
            return .init(value: ["revision": NSNull()], kind: .media, name: name)
        default: throw SlopBridgeFailure(.unsupported, "Unsupported storage method")
        }
    }
}
