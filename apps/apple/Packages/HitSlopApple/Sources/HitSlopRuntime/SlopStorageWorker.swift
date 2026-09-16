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
    let media: String?
    let theme: String?
}

/// All store access is serialized here, never on the UI actor. Any values cross
/// the queue only in immutable request/result snapshots.
final class SlopStorageWorker: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.hitslop.document-storage", qos: .userInitiated)
    private let package: SlopPackage
    private let media: SlopMediaStore
    private let theme: SlopThemeStore
    private var closed = false

    init(package: SlopPackage) {
        self.package = package
        media = SlopMediaStore(directoryURL: package.mediaStoresURL, rootURL: package.rootURL)
        theme = SlopThemeStore(url: package.themeOverrideURL, rootURL: package.rootURL)
    }
    func close() { queue.sync { closed = true } }
    func revisions() async -> SlopRevisions {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: SlopRevisions(media: try? self.media.directoryRevision(), theme: try? self.theme.revision()))
            }
        }
    }
    func perform(_ data: Data, lease: SlopRequestLease? = nil) async throws -> SlopStorageResult {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                do {
                    try lease?.check()
                    guard !self.closed else { throw SlopBridgeFailure(.closed, "Document is closed") }
                    guard let body = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                        throw SlopBridgeFailure(.invalidRequest, "Expected a request object")
                    }
                    continuation.resume(returning: try self.handle(body))
                } catch { continuation.resume(throwing: error) }
            }
        }
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
