import Foundation
import CryptoKit
import HitSlopCore
#if os(macOS)
import Darwin
#endif

private final class SyncPathLocks: @unchecked Sendable {
    static let shared = SyncPathLocks()
    private let lock = NSLock()
    private var locks: [String: NSRecursiveLock] = [:]
    func forPath(_ path: String) -> NSRecursiveLock {
        lock.lock(); defer { lock.unlock() }
        if let existing = locks[path] { return existing }
        let value = NSRecursiveLock(); locks[path] = value; return value
    }
}

/// Byte-only recoverable transactions. Loro and JSON reconciliation stay in JS.
final class SlopSyncStorage {
    private let root: URL
    private let lock: NSRecursiveLock
    private let stateFiles = ["state/identity.json", "state/checkpoint.loro", "state/materialization.json"]
    private let projection = "stores/data.json"
    private let pendingPath = "state/journal/pending.json"
    var afterReplace: ((String) throws -> Void)?
    init(root: URL) {
        self.root = root.resolvingSymlinksInPath().standardizedFileURL
        lock = SyncPathLocks.shared.forPath(self.root.path)
    }
    private func bytes(_ path: String) throws -> Data? {
        let url = root.appendingPathComponent(path)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try Data(contentsOf: url)
    }
    private func hash(_ data: Data?) -> String? {
        data.map { SHA256.hash(data: $0).map { String(format: "%02x", $0) }.joined() }
    }
    private func syncDirectory(_ url: URL) throws {
        #if os(macOS)
        let descriptor = Darwin.open(url.path, O_RDONLY)
        guard descriptor >= 0 else { throw SlopBridgeFailure(.storageError, "Cannot open directory for sync") }
        defer { Darwin.close(descriptor) }
        guard fsync(descriptor) == 0 else { throw SlopBridgeFailure(.storageError, "Cannot sync directory") }
        #endif
    }
    private func replace(_ path: String, _ data: Data) throws {
        let destination = root.appendingPathComponent(path)
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        let temporary = root.appendingPathComponent("state/journal/\(UUID().uuidString).tmp")
        guard FileManager.default.createFile(atPath: temporary.path, contents: nil) else { throw SlopBridgeFailure(.storageError, "Cannot create transaction file") }
        let handle = try FileHandle(forWritingTo: temporary)
        do { try handle.write(contentsOf: data); try handle.synchronize(); try handle.close() }
        catch { try? handle.close(); throw error }
        #if os(macOS)
        guard rename(temporary.path, destination.path) == 0 else { throw SlopBridgeFailure(.storageError, "Cannot replace transaction file") }
        #else
        try data.write(to: destination, options: .atomic)
        try FileManager.default.removeItem(at: temporary)
        #endif
        try syncDirectory(destination.deletingLastPathComponent())
        try afterReplace?(path)
    }
    private func snapshot() throws -> [String: Any] {
        let state = try stateFiles.map { try bytes($0) }
        let external = try bytes(projection)
        let generation = hash(Data(state.map { hash($0) ?? "-" }.joined(separator: "\n").utf8))!
        return ["identity": state[0]?.base64EncodedString() as Any? ?? NSNull(),
                "checkpoint": state[1]?.base64EncodedString() as Any? ?? NSNull(),
                "metadata": state[2]?.base64EncodedString() as Any? ?? NSNull(),
                "external": external?.base64EncodedString() as Any? ?? NSNull(),
                "generation": generation, "externalHash": hash(external) as Any? ?? NSNull()]
    }
    func open() throws -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        try recover()
        return try snapshot()
    }
    private struct Entry: Codable { let path: String; let before: String?; let after: String }
    private struct Pending: Codable { let format: Int; let files: [Entry] }
    private func recover() throws {
        guard let data = try bytes(pendingPath) else { return }
        let pending = try JSONDecoder().decode(Pending.self, from: data)
        let allowed = Set(stateFiles + [projection])
        guard pending.format == 2, pending.files.count >= 3,
              Set(pending.files.map(\.path)).count == pending.files.count,
              Set(stateFiles).isSubset(of: Set(pending.files.map(\.path))) else {
            throw SlopBridgeFailure(.storageError, "Unsupported pending sync transaction")
        }
        // Check every participant before replacing any; unexpected bytes survive recovery.
        for entry in pending.files {
            guard allowed.contains(entry.path), let after = Data(base64Encoded: entry.after) else { throw SlopBridgeFailure(.storageError, "Invalid pending sync transaction") }
            let actual = hash(try bytes(entry.path))
            guard actual == entry.before || actual == hash(after) else { throw SlopBridgeFailure(.revisionConflict, "External changes block journal recovery; files were preserved") }
        }
        for entry in pending.files {
            let after = Data(base64Encoded: entry.after)!
            if hash(try bytes(entry.path)) != hash(after) { try replace(entry.path, after) }
        }
        try FileManager.default.removeItem(at: root.appendingPathComponent(pendingPath))
        try syncDirectory(root.appendingPathComponent("state/journal"))
    }
    func commit(_ body: [String: Any]) throws -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        guard try bytes(pendingPath) == nil else { throw SlopBridgeFailure(.storageError, "Recover pending transaction before saving") }
        let before = try snapshot()
        guard before["generation"] as? String == body["expectedGeneration"] as? String,
              before["externalHash"] as? String == body["expectedExternal"] as? String else {
            throw SlopBridgeFailure(.revisionConflict, "Document changed on disk; retry with current file contents")
        }
        var paths = stateFiles
        var encoded: [String] = []
        for key in ["identity", "checkpoint", "metadata"] {
            guard let value = body[key] as? String, Data(base64Encoded: value) != nil else { throw SlopBridgeFailure(.invalidRequest, "Invalid sync bytes") }
            encoded.append(value)
        }
        if let value = body["projection"] as? String {
            guard Data(base64Encoded: value) != nil else { throw SlopBridgeFailure(.invalidRequest, "Invalid projection bytes") }
            paths.append(projection); encoded.append(value)
        }
        try FileManager.default.createDirectory(at: root.appendingPathComponent("state/journal"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appendingPathComponent("stores"), withIntermediateDirectories: true)
        try syncDirectory(root); try syncDirectory(root.appendingPathComponent("state"))
        if body["preserveExternal"] as? Bool == true, body["projection"] != nil, let externalString = before["external"] as? String, let external = Data(base64Encoded: externalString) {
            try replace("state/journal/recovery-\(UUID().uuidString).json", external)
        }
        let observed = ["identity", "checkpoint", "metadata", "external"].map { (before[$0] as? String).flatMap { Data(base64Encoded: $0) } }
        let entries = paths.enumerated().map { index, path in Entry(path: path, before: hash(observed[index]), after: encoded[index]) }
        try replace(pendingPath, JSONEncoder().encode(Pending(format: 2, files: entries)))
        try recover()
        return try snapshot()
    }
}
