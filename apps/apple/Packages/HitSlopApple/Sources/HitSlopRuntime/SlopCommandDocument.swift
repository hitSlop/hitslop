import CryptoKit
import Darwin
import Foundation
import HitSlopCore

public enum SlopDocumentMode: String, Codable, Sendable { case local, promoting, shared }

public struct SlopCommandFrame: Codable, Equatable, Sendable {
    public var snapshot: SlopDocumentJSON
    public var connected: Bool
    public var writable: Bool
    public var error: String?
    public var projectionError: String?
    public var proposalPath: String?
    public var handoffFrom: String?
    public var lease: SlopDocumentJSON?
    public var data: SlopDocumentJSON { snapshot["data"] }
    public func jsonValue() throws -> Any {
        var value: [String: Any] = ["snapshot": try snapshot.jsonValue(), "connected": connected, "writable": writable]
        if error != nil { value["error"] = "Document changes need attention in hitSlop" }
        if projectionError != nil { value["projectionError"] = "Document file needs attention in hitSlop" }
        if let handoffFrom { value["handoffFrom"] = handoffFrom }
        if let lease { value["lease"] = try lease.jsonValue() }
        return value
    }
}

/// One serial owner per view. SQLite remains the cross-process commit boundary.
public actor SlopCommandDocument {
    public typealias Sender = @Sendable (SlopDocumentJSON) async throws -> SlopDocumentJSON
    private let root: URL
    private let storage: SlopCommandStorage
    private let schema: SlopDocumentSchema
    private var record: SlopCommandStorage.Record
    private var sender: Sender?
    private var mediaTransport: SlopDocumentMediaTransport?
    private var sharedOpening: SlopDocumentJSON?
    private var closed = false
    private var error: String?
    private var projectionError: String?
    private var projectionTask: Task<Void, Never>?
    private var projectionStarted: ContinuousClock.Instant?
    private var projectionEpoch = 0
    private var published: SlopCommandFrame?
    private var listeners: [UUID: AsyncStream<SlopCommandFrame>.Continuation] = [:]
    private var handoffFrom: String?
    private var activeSharedRequests = 0
    private var connectionId: String?
    public var mode: SlopDocumentMode {
        record.metadata.mode
    }
    public nonisolated static func digest(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }

    public init(
        root: URL, schema source: SlopDocumentJSON, initial: SlopDocumentJSON, schemaFingerprint: String? = nil,
        sharedSeed: SlopDocumentJSON? = nil
    ) throws {
        try SlopLocalDocument.requireLocal(root)
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
        let schema = try SlopDocumentSchema(source)
        self.schema = schema
        let fingerprint = try schemaFingerprint ?? Self.digest(source.encoded())
        storage = try SlopCommandStorage(root: self.root)
        if try storage.load() == nil {
            guard !FileManager.default.fileExists(atPath: root.appendingPathComponent("stores/data.json").path) else {
                throw SlopDocumentError(
                    "JSON exists without its command database; preserve it and create a new document explicitly")
            }
            let snapshot =
                sharedSeed
                ?? .object([
                    "documentId": .string(UUID().uuidString), "schemaHash": .string(fingerprint),
                    "authority": .string(UUID().uuidString), "revision": .number(0), "data": initial,
                ])
            guard snapshot["schemaHash"].string == fingerprint else {
                throw SlopDocumentError("Shared schema mismatch")
            }
            try schema.validate(snapshot["data"])
            try storage.initialize(
                snapshot: snapshot,
                metadata: .init(mode: sharedSeed == nil ? .local : .shared, pendingProjection: true))
        }
        guard let loaded = try storage.load(), loaded.snapshot["schemaHash"].string == fingerprint else {
            throw SlopDocumentError("Document schema changed")
        }
        try schema.validate(loaded.snapshot["data"])
        record = loaded
    }
    public static func open(package: SlopPackage, seed: SlopDocumentJSON? = nil) throws -> SlopCommandDocument? {
        guard FileManager.default.fileExists(atPath: package.dataSchemaURL.path) else { return nil }
        let bytes = try SlopFile.read(package.dataSchemaURL, within: package.rootURL)
        let schema = try SlopDocumentJSON(data: SlopDocumentFormat.applicationSchema(bytes))
        let initial = try SlopDocumentJSON(
            data: SlopFile.read(package.initialURL, within: package.rootURL, maximumBytes: SlopJSONLimits.documentBytes)
        )
        return try Self(
            root: package.rootURL, schema: schema, initial: initial, schemaFingerprint: digest(bytes), sharedSeed: seed)
    }
    private func requireOpen() throws { if closed { throw SlopDocumentError("Document is closed") } }
    private func reload() throws {
        guard let next = try storage.load(), next.snapshot["documentId"] == record.snapshot["documentId"],
            next.snapshot["schemaHash"] == record.snapshot["schemaHash"]
        else { throw SlopDocumentError("Document identity changed") }
        if next.snapshot["authority"] != record.snapshot["authority"] {
            handoffFrom = record.snapshot["authority"].string
        }
        record = next
    }
    private func metadata(_ update: (inout SlopCommandStorage.Metadata) throws -> Void) throws {
        record = try storage.transaction {
            guard var next = try storage.load() else { throw SlopDocumentError("Document is not initialized") }
            try update(&next.metadata)
            try storage.saveMetadata(next.metadata)
            return next
        }
    }
    public func frame() throws -> SlopCommandFrame {
        try requireOpen()
        return .init(
            snapshot: record.snapshot, connected: mode == .local || sender != nil,
            writable: mode == .local
                || (mode == .shared && sender != nil && sharedOpening != nil
                    && record.metadata.outstanding.isEmpty),
            error: error,
            projectionError: projectionError, proposalPath: record.metadata.proposalPath,
            handoffFrom: handoffFrom,
            lease: mode == .local
                ? nil : (sharedOpening?["lease"] ?? .object(["id": .string("disconnected"), "expiresAt": .number(0)])))
    }
    private func publish() throws {
        let frame = try frame()
        guard frame != published else { return }
        published = frame
        for listener in listeners.values { listener.yield(frame) }
    }
    public func events() throws -> AsyncStream<SlopCommandFrame> {
        let id = UUID()
        let initial = try frame()
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            listeners[id] = continuation
            continuation.yield(initial)
            continuation.onTermination = { [weak self] _ in Task { await self?.removeListener(id) } }
        }
    }
    private func removeListener(_ id: UUID) { listeners.removeValue(forKey: id) }
    public func openGuest() async throws -> SlopDocumentJSON {
        try await refreshExternal()
        var open: SlopDocumentJSON
        if mode == .local {
            open = try storage.open()
        } else if let sharedOpening {
            open = .object(["snapshot": record.snapshot, "lease": sharedOpening["lease"]])
        }
        // A disconnected shared document is readable, but this expired lease cannot execute.
        else {
            open = .object([
                "snapshot": record.snapshot,
                "lease": .object(["id": .string("disconnected"), "expiresAt": .number(0)]),
            ])
        }
        let frame = try frame()
        open["status"] = .object(["connected": .bool(frame.connected), "writable": .bool(frame.writable)])
        return open
    }
    public func apply(_ request: SlopDocumentJSON) async throws -> SlopDocumentJSON {
        try requireOpen()
        try reload()
        if mode == .local {
            let outcome = try storage.apply(request, schema: schema)
            record = .init(snapshot: outcome.snapshot, metadata: outcome.metadata)
            error = outcome.result["error"]["message"].string
            try publish()
            scheduleProjection()
            return outcome.result
        }
        guard mode == .shared, let sender, sharedOpening != nil else {
            return Self.failure("offline", "Reconnect before editing this shared document")
        }
        let key = Self.digest(try request.encoded())
        if !record.metadata.outstanding.isEmpty && record.metadata.outstanding[key] == nil {
            return Self.failure("unknown_outcome", "Resolve the outstanding request before another edit")
        }
        guard ["documentId", "schemaHash", "authority"].allSatisfy({ request[$0] == record.snapshot[$0] }) else {
            return Self.failure("authority_changed", "Reopen the current document authority")
        }
        activeSharedRequests += 1
        defer { activeSharedRequests -= 1 }
        if record.metadata.outstanding[key] == nil {
            let hashes = SlopMediaSync.introducedHashes(in: request, schema: schema.source)
            if !hashes.isEmpty {
                let connection = connectionId, authority = record.snapshot["authority"]
                do {
                    guard let mediaTransport else { throw SlopDocumentError("Media transfer is unavailable") }
                    try await mediaTransport.prepare(hashes)
                    try requireOpen(); try reload()
                    guard connectionId == connection, mode == .shared, record.snapshot["authority"] == authority, self.sender != nil else {
                        return Self.failure("authority_changed", "Connection changed while preparing media; retry the edit")
                    }
                    guard record.metadata.outstanding.isEmpty else { return Self.failure("unknown_outcome", "Resolve the outstanding request before another edit") }
                } catch {
                    self.error = error.localizedDescription
                    try? publish()
                    return Self.failure("storage_unavailable", "Attachment upload failed; the document was not changed")
                }
            }
        }
        try metadata { meta in meta.outstanding[key] = request }
        do {
            let result = try await sender(request)
            if result["error"]["code"].string != "unknown_outcome" && result["error"]["code"].string != "offline" {
                try metadata { meta in
                    meta.outstanding.removeValue(forKey: key)
                }
            }
            error = result["error"]["message"].string
            try publish()
            return result
        } catch {
            self.error = "The last command has an unknown outcome. Reconnect to resolve it."
            try? publish()
            return Self.failure("unknown_outcome", "The request is durable locally; reconnect to resolve its outcome")
        }
    }
    private static func failure(_ code: String, _ message: String) -> SlopDocumentJSON {
        .object(["ok": .bool(false), "error": .object(["code": .string(code), "message": .string(message)])])
    }

    public func connect(opening: SlopDocumentJSON, connectionId: String = UUID().uuidString, media: SlopDocumentMediaTransport? = nil, sender: @escaping Sender)
        async throws
    {
        try Task.checkCancellation()
        try requireOpen()
        try reload()
        guard mode == .shared || mode == .promoting else { throw SlopDocumentError("Document has no shared authority") }
        let expected = mode == .promoting ? record.metadata.promotion! : record.snapshot
        let incoming = opening["snapshot"]
        guard let revision = incoming["revision"].number, revision >= 0, revision.rounded() == revision,
            revision <= 9_007_199_254_740_991, opening["lease"]["id"].string?.isEmpty == false,
            let expires = opening["lease"]["expiresAt"].number, expires.isFinite, expires.rounded() == expires
        else { throw SlopDocumentError("Invalid room opening") }
        let preparedData = try incoming["data"].encoded(maximumBytes: SlopJSONLimits.documentBytes, maximumDepth: SlopJSONLimits.maximumDepth)
        guard ["documentId", "schemaHash", "authority"].allSatisfy({ incoming[$0] == expected[$0] }) else {
            throw SlopDocumentError("Room authority mismatch")
        }
        if mode == .promoting {
            let previous = record.snapshot["authority"].string
            record = try storage.transaction {
                guard var next = try storage.load(), next.metadata.mode == .promoting,
                    next.metadata.promotion?["authority"] == incoming["authority"]
                else { throw SlopDocumentError("Promotion changed") }
                next.snapshot = incoming
                next.metadata.mode = .shared
                next.metadata.pendingProjection = true
                next.metadata.promotion = nil
                try storage.save(next, preparedData: preparedData)
                return next
            }
            handoffFrom = previous
        } else {
            try receive(incoming)
        }
        self.sender = sender
        self.mediaTransport = media
        sharedOpening = opening
        self.connectionId = connectionId
        // These were sent while connected. Resolving them is not an offline editing queue.
        for request in record.metadata.outstanding.values {
            try Task.checkCancellation()
            guard self.connectionId == connectionId else { throw CancellationError() }
            let result = try await apply(request)
            try Task.checkCancellation()
            if result["error"]["code"].string == "unknown_outcome" || result["error"]["code"].string == "offline" {
                break
            }
        }
        try publish()
        scheduleProjection()
    }
    public func disconnect(connectionId: String? = nil) throws {
        if let connectionId, self.connectionId != connectionId { return }
        sender = nil
        mediaTransport = nil
        sharedOpening = nil
        self.connectionId = nil
        try publish()
    }
    public func loadMedia(_ hash: String) async throws {
        try requireOpen()
        guard SlopMediaStore.isValidHash(hash) else { throw SlopDocumentError("Invalid media digest") }
        if mode == .shared { try await mediaTransport?.load(hash) }
    }
    public func receive(_ snapshot: SlopDocumentJSON) throws {
        try requireOpen()
        record = try storage.transaction {
            guard var next = try storage.load(), next.metadata.mode == .shared,
                ["documentId", "schemaHash", "authority"].allSatisfy({ snapshot[$0] == next.snapshot[$0] }),
                let revision = snapshot["revision"].number, revision >= 0, revision.rounded() == revision,
                revision <= 9_007_199_254_740_991
            else { throw SlopDocumentError("Foreign or invalid room snapshot") }
            guard revision > (next.snapshot["revision"].number ?? -1) else { return next }
            // The room validates application data. This gateway enforces framing and size.
            let preparedData = try snapshot["data"].encoded(maximumBytes: SlopJSONLimits.documentBytes, maximumDepth: SlopJSONLimits.maximumDepth)
            next.snapshot = snapshot
            next.metadata.pendingProjection = true
            try storage.save(next, preparedData: preparedData)
            return next
        }
        try publish()
        scheduleProjection()
    }
    public func prepareSharing() async throws -> SlopDocumentJSON {
        try await flush()
        guard activeSharedRequests == 0, record.metadata.outstanding.isEmpty else {
            throw SlopDocumentError("Resolve outstanding commands before sharing")
        }
        if mode == .promoting { return record.metadata.promotion! }
        guard mode == .local else { throw SlopDocumentError("Document is already shared") }
        record = try storage.transaction {
            guard var next = try storage.load(), next.metadata.mode == .local else {
                throw SlopDocumentError("Document authority changed")
            }
            var seed = next.snapshot
            seed["authority"] = .string(UUID().uuidString)
            seed["revision"] = .number(0)
            next.metadata.mode = .promoting
            next.metadata.promotion = seed
            try storage.saveMetadata(next.metadata)
            return next
        }
        let seed = record.metadata.promotion!
        try publish()
        return seed
    }
    public func identity() -> (documentId: String, schema: String) {
        (record.snapshot["documentId"].string!, record.snapshot["schemaHash"].string!)
    }
    public func sharingSeed() -> SlopDocumentJSON? { record.metadata.promotion }

    private func externalBytes() throws -> Data? {
        let url = root.appendingPathComponent("stores/data.json")
        return FileManager.default.fileExists(atPath: url.path) ? try SlopFile.read(url, within: root) : nil
    }
    private func preserve(_ bytes: Data, hash: String, reason: String) throws {
        let directory = root.appendingPathComponent("state/proposals", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent(hash + ".json")
        try Self.durableWrite(bytes, to: url)
        try metadata { meta in
            meta.proposalHash = hash
            meta.proposalPath = url.path
            meta.proposalReason = reason
        }
        projectionError = reason
    }
    private func importExternal() async throws {
        guard let bytes = try externalBytes() else { return }
        let hash = Self.digest(bytes)
        if record.metadata.materializedHash == hash { return }
        if bytes == (try Self.projection(record.snapshot)) {
            try metadata { $0.materializedHash = hash }
            return
        }
        if record.metadata.proposalHash == hash {
            projectionError = record.metadata.proposalReason
            return
        }
        do {
            let envelope = try SlopDocumentJSON(data: bytes)
            let base = envelope["$slop"]
            guard Set(envelope.object.keys) == ["$slop", "data"],
                Set(base.object.keys) == ["format", "documentId", "schemaHash", "authority", "baseRevision"],
                base["format"] == .number(2),
                ["documentId", "schemaHash", "authority"].allSatisfy({ base[$0] == record.snapshot[$0] })
            else { throw SlopDocumentError("External file has a foreign or unsupported revision envelope") }
            var opening = record.metadata.externalOpening
            if opening?.authority != record.snapshot["authority"].string
                || (opening?.lease["expiresAt"].number ?? 0) <= Date().timeIntervalSince1970 * 1000
            {
                let opened: SlopDocumentJSON
                if mode == .local {
                    opened = try storage.open()
                } else if let sharedOpening {
                    opened = sharedOpening
                } else {
                    throw SlopDocumentError("Reconnect before applying an external shared edit")
                }
                opening = .init(authority: record.snapshot["authority"].string!, lease: opened["lease"])
                try metadata { $0.externalOpening = opening }
            }
            var request = SlopDocumentJSON.object([:])
            for key in ["documentId", "schemaHash", "authority"] { request[key] = base[key] }
            request["requestId"] = .string("file:" + hash)
            request["leaseId"] = opening!.lease["id"]
            request["replace"] = .object(["baseRevision": base["baseRevision"], "data": envelope["data"]])
            let result = try await apply(request)
            guard result["ok"] == .bool(true) else {
                throw SlopDocumentError(result["error"]["message"].string ?? "External edit was rejected")
            }
            try metadata { meta in
                meta.materializedHash = hash
                meta.proposalHash = nil
                meta.proposalPath = nil
                meta.proposalReason = nil
            }
            projectionError = nil
        } catch { try preserve(bytes, hash: hash, reason: error.localizedDescription) }
    }
    private static func projection(_ snapshot: SlopDocumentJSON) throws -> Data {
        var metadata = snapshot.object
        metadata.removeValue(forKey: "data")
        metadata["baseRevision"] = metadata.removeValue(forKey: "revision")
        metadata["format"] = .number(2)
        return try SlopDocumentJSON.object(["$slop": .object(metadata), "data": snapshot["data"]]).encoded()
    }
    private func materialize() throws {
        record = try storage.transaction {
            guard var next = try storage.load() else { throw SlopDocumentError("Document is not initialized") }
            if next.metadata.proposalHash != nil { return next }
            let external = try externalBytes()
            let bytes = try Self.projection(next.snapshot)
            if external != nil && external != bytes
                && external.map(Self.digest) != next.metadata.materializedHash
            {
                throw SlopDocumentError("External JSON changed; preserve it before projecting")
            }
            if external != bytes { try Self.durableWrite(bytes, to: root.appendingPathComponent("stores/data.json")) }
            next.metadata.materializedHash = Self.digest(bytes)
            next.metadata.pendingProjection = false
            try storage.saveMetadata(next.metadata)
            return next
        }
    }
    private static func durableWrite(_ bytes: Data, to url: URL) throws {
        let directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let info = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard info.isDirectory == true, info.isSymbolicLink != true else {
            throw SlopDocumentError("Unsafe document directory")
        }
        try bytes.write(to: url, options: .atomic)
        let handle = try FileHandle(forWritingTo: url)
        try handle.synchronize()
        try handle.close()
        let descriptor = Darwin.open(directory.path, O_RDONLY)
        guard descriptor >= 0 else { throw POSIXError(.EIO) }
        defer { Darwin.close(descriptor) }
        guard fsync(descriptor) == 0 else { throw POSIXError(.EIO) }
    }
    private func cancelProjection() {
        projectionTask?.cancel()
        projectionTask = nil
        projectionStarted = nil
        projectionEpoch += 1
    }
    private func scheduleProjection() {
        guard !closed, record.metadata.pendingProjection,
            record.metadata.proposalHash == nil
        else { return }
        let now = ContinuousClock.now
        projectionStarted = projectionStarted ?? now
        let deadline = min(now.advanced(by: .milliseconds(250)), projectionStarted!.advanced(by: .seconds(2)))
        projectionTask?.cancel()
        projectionEpoch += 1
        let epoch = projectionEpoch
        projectionTask = Task { [weak self] in
            do { try await Task.sleep(until: deadline, clock: .continuous) } catch { return }
            await self?.finishProjection(epoch)
        }
    }
    private func finishProjection(_ epoch: Int) async {
        guard epoch == projectionEpoch, !closed else { return }
        do { try await flush() } catch {
            projectionError = error.localizedDescription
            try? publish()
        }
    }
    public func refreshExternal() async throws {
        try requireOpen()
        try reload()
        try await importExternal()
        try publish()
        scheduleProjection()
    }
    public func flush() async throws {
        try requireOpen()
        cancelProjection()
        try reload()
        try await importExternal()
        do {
            try materialize()
            if record.metadata.proposalHash == nil { projectionError = nil }
            try publish()
        } catch {
            projectionError = error.localizedDescription
            try? publish()
            throw error
        }
    }
    public func discardExternalProposal() async throws {
        try requireOpen()
        try reload()
        guard let bytes = try externalBytes(), Self.digest(bytes) == record.metadata.proposalHash else {
            try await refreshExternal()
            return
        }
        // Preserved proposal remains in state/proposals; authorize overwriting only these exact bytes.
        try metadata { meta in
            meta.materializedHash = meta.proposalHash
            meta.proposalHash = nil
            meta.proposalPath = nil
            meta.proposalReason = nil
        }
        try await flush()
    }
    public func close() async throws {
        try await flush()
        guard activeSharedRequests == 0 else {
            throw SlopDocumentError("Wait for the outstanding command before closing")
        }
        // Unknown shared attempts are already durable and will be resolved on reopen.
        shutDown()
    }
    public func start() async throws { try await flush() }
    func guestRequest(_ method: SlopBridgeMethod, body: Data, lease: SlopRequestLease) async throws -> SlopDocumentJSON
    {
        try lease.check()
        switch method {
        case .documentOpen: return try await openGuest()
        case .documentExecute: return try await apply(SlopDocumentJSON(data: body)["request"])
        case .documentFlush:
            try await flush()
            return .null
        default: throw SlopBridgeFailure(.invalidRequest, "Not a document method")
        }
    }
    public func sharingBundle(_ bytes: Data) throws -> Data {
        try requireOpen()
        let url = root.appendingPathComponent("state/share-bootstrap.zip")
        if (try? FileManager.default.attributesOfItem(atPath: url.path)) != nil {
            return try SlopFile.read(url, within: root)
        }
        guard bytes.count <= SlopFile.maximumBytes else { throw SlopDocumentError("Shared app exceeds 25 MiB") }
        try Self.durableWrite(bytes, to: url)
        return bytes
    }
    public func independentCopy(to destination: URL) async throws -> SlopCommandDocument {
        try SlopLocalDocument.requireLocal(destination)
        guard destination.standardizedFileURL.resolvingSymlinksInPath() != root else {
            throw SlopDocumentError("A duplicate needs a new path")
        }
        try await flush()
        guard record.metadata.proposalHash == nil else {
            throw SlopDocumentError("Review the preserved external proposal before duplicating")
        }
        let package = try SlopPackage(rootURL: destination)
        for url in [package.stateURL, package.jsonStoreURL] where FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
        return try Self(
            root: destination, schema: schema.source, initial: record.snapshot["data"],
            schemaFingerprint: record.snapshot["schemaHash"].string)
    }
    public func shutDown() {
        cancelProjection()
        closed = true
        sender = nil
        mediaTransport = nil
        for listener in listeners.values { listener.finish() }
        listeners.removeAll()
    }
    public func backupDatabase(to destination: URL) async throws {
        try await flush()
        try storage.backup(to: destination)
    }
}
