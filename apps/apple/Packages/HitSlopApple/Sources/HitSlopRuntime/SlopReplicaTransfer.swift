import CryptoKit
import Foundation
import HitSlopCore

public struct SlopReplicaTransfer: Codable, Equatable, Sendable {
    public let documentId: String
    public let schema: String
    public let checkpoint: String
    public let version: String
    public init(documentId: String, schema: String, checkpoint: String, version: String) {
        self.documentId = documentId; self.schema = schema; self.checkpoint = checkpoint; self.version = version
    }
    public var arguments: [String: Any] { ["documentId": documentId, "schema": schema, "checkpoint": checkpoint, "version": version] }
}

extension SlopRuntimeSession {
    @MainActor public func sharingSnapshot() async throws -> SlopReplicaTransfer {
        let value = try await documentCall("snapshot")
        return try JSONDecoder().decode(SlopReplicaTransfer.self, from: JSONSerialization.data(withJSONObject: value))
    }
    @MainActor public func receiveShared(_ value: SlopReplicaTransfer) async throws {
        _ = try await documentCall("receive", payload: value.arguments)
    }
    @MainActor private func documentCall(_ method: String, payload: [String: Any] = [:]) async throws -> Any {
        try await waitUntilReady()
        return try await webView.callAsyncJavaScript("return await window.__hitslopDocument[method](payload) ?? true;",
            arguments: ["method": method, "payload": payload], in: nil, contentWorld: .page) ?? true
    }
    /// Writes only to a newly created copy. The live package is never replaced.
    @MainActor public func independentCopy(to destination: URL) async throws -> URL {
        if !FileManager.default.fileExists(atPath: package.rootURL.appendingPathComponent("data.schema.json").path) {
            try await flush()
            return try SlopDuplicator.duplicate(from: package.rootURL, to: destination)
        }
        let value = try await documentCall("copy")
        return try writeNewCopy(to: destination, state: value)
    }
    @MainActor public func sharedCopy(to destination: URL, snapshot: SlopReplicaTransfer) async throws -> URL {
        let value = try await documentCall("seed", payload: snapshot.arguments)
        return try writeNewCopy(to: destination, state: value)
    }
    @MainActor private func writeNewCopy(to destination: URL, state value: Any) throws -> URL {
        guard let state = value as? [String: Any], ["identity", "checkpoint", "metadata", "projection"].allSatisfy({ state[$0] is String }) else {
            throw SlopPackageError.invalid("Invalid document copy state")
        }
        let url = try SlopDuplicator.duplicate(from: package.rootURL, to: destination)
        do {
            let manager = FileManager.default
            for name in ["state", "stores/data.json"] {
                let file = url.appendingPathComponent(name)
                if manager.fileExists(atPath: file.path) { try manager.removeItem(at: file) }
            }
            let storage = SlopSyncStorage(root: url)
            let initial = try storage.open()
            var commit = state
            commit["expectedGeneration"] = initial["generation"]
            commit["expectedExternal"] = NSNull()
            commit["preserveExternal"] = false
            _ = try storage.commit(commit)
            return url
        } catch { try? FileManager.default.removeItem(at: url); throw error }
    }
}

public enum SlopTemplateFingerprint {
    /// Only immutable executable/schema assets identify a template. No owner data is uploaded.
    public static func value(_ root: URL) throws -> String {
        let manager = FileManager.default
        var paths = ["manifest.json", "app.html", "data.schema.json"]
        let assets = root.appendingPathComponent("assets")
        if let files = manager.enumerator(at: assets, includingPropertiesForKeys: [.isRegularFileKey]) {
            for case let url as URL in files where try url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true {
                paths.append(String(url.path.dropFirst(root.path.count + 1)))
            }
        }
        var hash = SHA256()
        for path in paths.sorted() where manager.fileExists(atPath: root.appendingPathComponent(path).path) {
            hash.update(data: Data(path.utf8)); hash.update(data: Data([0]))
            let bytes = try Data(contentsOf: root.appendingPathComponent(path))
            hash.update(data: Data(String(bytes.count).utf8)); hash.update(data: Data([0])); hash.update(data: bytes)
        }
        return hash.finalize().map { String(format: "%02x", $0) }.joined()
    }
}
