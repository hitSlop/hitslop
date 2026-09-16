import Foundation
import Darwin
import HitSlopCore

public struct SlopLoroTransfer: Codable, Sendable {
    public let documentId: String
    public let schema: String
    public let checkpoint: String
    public let version: String
    public init(documentId: String, schema: String, checkpoint: String, version: String) {
        self.documentId = documentId; self.schema = schema; self.checkpoint = checkpoint; self.version = version
    }
}

/// One native owner per view; SQLite serializes owners in other windows/processes.
/// Candidate replicas become visible only after their database transaction commits.
public actor SlopLoroDocument {
    private let root: URL
    private let storage: SlopSyncStorage
    private var replica: SlopDocumentReplica
    private var metadata: SlopSyncStorage.Metadata
    private var publication = 0
    private var projectionError: String?
    private var error: String?
    private var closed = false
    private var projectionFailure = false
    private var projectionTask: Task<Void, Never>?
    private var projectionStarted: ContinuousClock.Instant?
    private var projectionEpoch = 0
    private var projectionWrites = 0
    private var projectionQuietPeriod: Duration = .milliseconds(250)
    private var projectionMaximumDelay: Duration = .seconds(2)
    private struct PublicationState: Equatable {
        let revision: String
        let dirty: Bool
        let error: String?
        let projectionError: String?
    }
    private var publishedState: PublicationState?
    private var listeners: [UUID: AsyncStream<SlopDocumentFrame>.Continuation] = [:]
    private struct Reply { let sequence: Int; let digest: String; let result: Result<SlopDocumentFrame, SlopDocumentError> }
    private var replies: [String: Reply] = [:]
    private struct Draft { let base: String; let sequence: Int; let authored: String; var failed = false }
    private var drafts: [String: Draft] = [:]
    public var transport: SlopLoroTransport { metadata.transport }

    public static func open(package: SlopPackage) throws -> SlopLoroDocument? {
        guard FileManager.default.fileExists(atPath: package.dataSchemaURL.path) else { return nil }
        let schemaBytes = try SlopFile.read(package.dataSchemaURL, within: package.rootURL)
        let schema = try SlopDocumentJSON(data: SlopDocumentFormat.applicationSchema(schemaBytes))
        let initial = try SlopDocumentJSON(data: SlopFile.read(package.initialURL, within: package.rootURL, maximumBytes: SlopJSONLimits.documentBytes))
        return try SlopLoroDocument(root: package.rootURL, schema: schema, initial: initial, schemaFingerprint: SlopLoroBatch.digest(schemaBytes))
    }
    public static func open(package: SlopPackage, seed: SlopLoroTransfer) throws -> SlopLoroDocument? {
        guard FileManager.default.fileExists(atPath: package.dataSchemaURL.path) else { return nil }
        let schemaBytes = try SlopFile.read(package.dataSchemaURL, within: package.rootURL)
        let schema = try SlopDocumentJSON(data: SlopDocumentFormat.applicationSchema(schemaBytes))
        return try SlopLoroDocument(root: package.rootURL, schema: schema, initial: .object([:]), seed: seed, transport: .incremental, schemaFingerprint: SlopLoroBatch.digest(schemaBytes))
    }
    public init(root: URL, schema: SlopDocumentJSON, initial: SlopDocumentJSON, seed: SlopLoroTransfer? = nil, transport: SlopLoroTransport = .local, schemaFingerprint: String? = nil) throws {
        try SlopLocalDocument.requireLocal(root)
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
        let mapping = try SlopDocumentSchema(schema)
        let fingerprint = try schemaFingerprint ?? SlopLoroBatch.digest(mapping.source.encoded())
        let database = try SlopSyncStorage(root: self.root)
        let loaded = try database.transaction { () -> (SlopSyncStorage.Metadata, SlopDocumentReplica) in
            if let disk = try database.load() {
                guard seed == nil, disk.metadata.schema == fingerprint else { throw SlopDocumentError("Document schema or seed mismatch") }
                let replica = try SlopDocumentReplica(schema: mapping, initial: initial, snapshot: disk.checkpoint)
                for update in disk.updates { try replica.receive(update) }
                return (disk.metadata, replica)
            }
            if FileManager.default.fileExists(atPath: root.appendingPathComponent("stores/data.json").path) {
                throw SlopDocumentError("JSON exists without its document database; preserve it and create a new document explicitly")
            }
            if let seed {
                guard seed.schema == fingerprint, UUID(uuidString: seed.documentId) != nil,
                      Data(base64Encoded: seed.checkpoint) != nil else { throw SlopDocumentError("Invalid shared seed") }
            }
            guard transport != .incremental || seed != nil else { throw SlopDocumentError("A shared document requires its room seed") }
            let replica = try SlopDocumentReplica(schema: mapping, initial: initial, snapshot: seed.flatMap { Data(base64Encoded: $0.checkpoint) })
            var meta = SlopSyncStorage.Metadata(documentId: seed?.documentId ?? UUID().uuidString, schema: fingerprint, transport: transport)
            meta.cursor = seed == nil ? 0 : 1
            meta.pendingProjection = try Self.projection(replica, meta)
            try database.initialize(meta, checkpoint: replica.snapshot())
            return (meta, replica)
        }
        storage = database; metadata = loaded.0; replica = loaded.1
    }
    private func requireOpen() throws { if closed { throw SlopDocumentError("Document is closed") } }
    private static func revision(_ replica: SlopDocumentReplica, _ meta: SlopSyncStorage.Metadata) throws -> String {
        try SlopDocumentJSON.object(["documentId": .string(meta.documentId), "schema": .string(meta.schema), "frontiers": .string(replica.revision())]).encoded().base64EncodedString()
    }
    private static func projection(_ replica: SlopDocumentReplica, _ meta: SlopSyncStorage.Metadata) throws -> Data {
        try SlopDocumentJSON.object(["$slop": .object(["format": .number(1), "baseRevision": .string(revision(replica, meta))]), "data": replica.current()]).encoded()
    }
    private func frontiers(_ token: String) throws -> String {
        guard let bytes = Data(base64Encoded: token) else { throw SlopDocumentError("Invalid base revision") }
        let value = try SlopDocumentJSON(data: bytes)
        guard value["documentId"].string == metadata.documentId, value["schema"].string == metadata.schema,
              let frontiers = value["frontiers"].string else { throw SlopDocumentError("Foreign base revision") }
        return frontiers
    }
    public func frame() throws -> SlopDocumentFrame {
        try requireOpen()
        return try SlopDocumentFrame(publication: publication, revision: Self.revision(replica, metadata), data: replica.current(),
                                     dirty: metadata.pendingProjection != nil, error: error, projectionError: projectionError)
    }
    private func publish() throws {
        let state = PublicationState(revision: replica.revision(), dirty: metadata.pendingProjection != nil,
                                     error: error, projectionError: projectionError)
        guard state != publishedState else { return }
        publication += 1
        let value = try frame()
        publishedState = state
        for listener in listeners.values { listener.yield(value) }
    }
    public func events() throws -> AsyncStream<SlopDocumentFrame> {
        let id = UUID(), initial = try frame()
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            listeners[id] = continuation; continuation.yield(initial)
            continuation.onTermination = { [weak self] _ in Task { await self?.removeListener(id) } }
        }
    }
    private func removeListener(_ id: UUID) { listeners.removeValue(forKey: id) }
    public func start() throws { try flush() }

    /// Called with the database write lock. Never publish a partially loaded state.
    private func refresh() throws {
        guard try storage.generation() != metadata.generation else { return }
        guard let disk = try storage.load(), disk.metadata.documentId == metadata.documentId,
              disk.metadata.schema == metadata.schema else { throw SlopDocumentError("Document identity changed") }
        let next = try SlopDocumentReplica(schema: replica.schema, initial: .object([:]), snapshot: disk.checkpoint)
        for bytes in disk.updates { try next.receive(bytes) }
        replica = next; metadata = disk.metadata
    }
    /// Database bytes are committed before swapping the candidate into memory.
    private func commit(local: Bool, _ change: (SlopDocumentReplica, inout SlopSyncStorage.Metadata) throws -> Void) throws {
        try requireOpen()
        let result = try storage.transaction { () -> (SlopDocumentReplica, SlopSyncStorage.Metadata) in
            try refresh()
            let candidate = replica.fork()
            var next = metadata
            let version = candidate.versionVector(), before = candidate.revision()
            try change(candidate, &next)
            let changed = candidate.revision() != before
            let update = changed ? try candidate.updates(since: version) : nil
            if let update, local, next.transport == .incremental { try storage.enqueue(SlopLoroBatch(data: update)) }
            if changed { next.pendingProjection = try Self.projection(candidate, next) }
            next.generation += 1
            let checkpoint = try update.flatMap { try storage.needsCheckpoint(adding: $0.count) ? candidate.snapshot() : nil }
            try storage.save(next, update: update, checkpoint: checkpoint)
            return (candidate, next)
        }
        replica = result.0; metadata = result.1; error = nil
    }
    private func externalBytes() throws -> Data? {
        let url = root.appendingPathComponent("stores/data.json")
        return FileManager.default.fileExists(atPath: url.path) ? try SlopFile.read(url, within: root, maximumBytes: SlopJSONLimits.documentBytes + 64 * 1024) : nil
    }
    /// Reconcile human/agent edits using the revision carried in the JSON envelope.
    private func importExternal() throws {
        try storage.transaction {
            try refresh()
            guard let bytes = try externalBytes() else { return }
            let hash = SlopLoroBatch.digest(bytes)
            if hash == metadata.materializedHash || bytes == metadata.pendingProjection { projectionError = nil; return }
            let envelope = try SlopDocumentJSON(data: bytes)
            guard envelope["$slop"]["format"] == .number(1), let token = envelope["$slop"]["baseRevision"].string else { throw SlopDocumentError("Invalid document envelope") }
            let base = try frontiers(token)
            if metadata.receipts[token] == hash { return }
            if metadata.receipts[token] != nil { throw SlopDocumentError("External revision was already used for different content") }
            let candidate = replica.fork(), version = replica.versionVector()
            _ = try candidate.apply(base: base, after: envelope["data"])
            let changed = candidate.revision() != replica.revision()
            var next = metadata
            next.receipts[token] = hash
            next.materializedHash = hash
            next.pendingProjection = try Self.projection(candidate, next)
            next.generation += 1
            let update = changed ? try candidate.updates(since: version) : nil
            if let update, next.transport == .incremental { try storage.enqueue(SlopLoroBatch(data: update)) }
            let checkpoint = try update.flatMap { try storage.needsCheckpoint(adding: $0.count) ? candidate.snapshot() : nil }
            try storage.save(next, update: update, checkpoint: checkpoint)
            // Assign only after COMMIT below, by reloading the durable generation.
        }
        try storage.transaction { try refresh() }
        projectionError = nil
    }
    private func materialize() throws {
        var next = metadata
        try storage.transaction {
            try refresh(); next = metadata
            let external = try externalBytes()
            if external == nil, next.pendingProjection == nil { next.pendingProjection = try Self.projection(replica, next) }
            guard let bytes = next.pendingProjection else { return }
            guard external == nil || external == bytes || external.map(SlopLoroBatch.digest) == next.materializedHash else {
                throw SlopDocumentError("External JSON changed; its bytes were preserved for review")
            }
            if external != bytes {
                if projectionFailure { throw SlopDocumentError("Injected projection interruption") }
                let directory = root.appendingPathComponent("stores", isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try bytes.write(to: directory.appendingPathComponent("data.json"), options: .atomic)
                let handle = try FileHandle(forWritingTo: directory.appendingPathComponent("data.json"))
                try handle.synchronize(); try handle.close()
                try Self.syncDirectory(directory)
                projectionWrites += 1
            }
            next.materializedHash = SlopLoroBatch.digest(bytes); next.pendingProjection = nil
            next.generation += 1
            try storage.save(next)
        }
        metadata = next
    }
    private func cancelProjection() {
        projectionTask?.cancel(); projectionTask = nil
        projectionStarted = nil
        projectionEpoch += 1
    }
    private func scheduleProjection() {
        guard !closed, metadata.pendingProjection != nil, projectionError == nil else {
            cancelProjection()
            return
        }
        let now = ContinuousClock.now
        projectionStarted = projectionStarted ?? now
        let deadline = min(now.advanced(by: projectionQuietPeriod), projectionStarted!.advanced(by: projectionMaximumDelay))
        projectionTask?.cancel()
        projectionEpoch += 1
        let epoch = projectionEpoch
        projectionTask = Task { [weak self] in
            do { try await Task.sleep(until: deadline, clock: .continuous) }
            catch { return }
            await self?.finishProjection(epoch: epoch)
        }
    }
    private func finishProjection(epoch: Int) {
        guard epoch == projectionEpoch, !closed else { return }
        do { try flush() }
        catch { /* flush publishes the error; durable pending bytes remain retryable. */ }
    }
    /// Refresh another owner's commits or external JSON without forcing a projection
    /// write for every filesystem event generated by our own database commits.
    public func refreshExternal() throws {
        try requireOpen()
        do {
            try importExternal()
            projectionError = nil
        } catch { projectionError = error.localizedDescription }
        // Recreate a deleted projection, even if there is no new document edit.
        if projectionError == nil, metadata.pendingProjection == nil, try externalBytes() == nil {
            try flush()
            return
        }
        try publish()
        scheduleProjection()
    }
    public func flush() throws {
        try requireOpen()
        cancelProjection()
        do {
            do { try importExternal() } catch { projectionError = error.localizedDescription }
            if projectionError == nil {
                do { try materialize() } catch { projectionError = error.localizedDescription }
            }
            error = nil
            try publish()
        } catch { self.error = error.localizedDescription; try? publish(); throw error }
    }
    public func apply(_ request: SlopDocumentEdit) throws -> SlopDocumentFrame {
        try requireOpen()
        guard !request.session.isEmpty, request.sequence > 0 else { throw SlopDocumentError("Invalid edit session") }
        guard replies[request.session] != nil || replies.count < 16 else { throw SlopLimitError("Document exceeds 16 edit sessions") }
        if let draft = request.draft, drafts[request.session + ":" + draft] == nil, drafts.count >= 128 {
            throw SlopLimitError("Document exceeds 128 active drafts")
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let digest = SlopLoroBatch.digest(try encoder.encode(request))
        if let previous = replies[request.session], previous.sequence == request.sequence {
            guard previous.digest == digest else { throw SlopDocumentError("Sequence reused for a different edit") }
            return try previous.result.get()
        }
        guard request.sequence == (replies[request.session]?.sequence ?? 0) + 1 else { throw SlopDocumentError("Out-of-order edit") }
        let key = request.draft.map { request.session + ":" + $0 }
        let result: Result<SlopDocumentFrame, SlopDocumentError>
        do {
            try refreshExternal()
            var authored = ""
            try commit(local: true) { candidate, _ in
                var base = try frontiers(request.base)
                if let key {
                    guard request.draft?.isEmpty == false else { throw SlopDocumentError("Empty draft") }
                    if let previous = drafts[key] {
                        guard !previous.failed, previous.base == request.base, request.parent == previous.sequence else { throw SlopDocumentError("Invalid draft ancestry") }
                        base = previous.authored
                    } else if request.parent != nil { throw SlopDocumentError("Unknown draft parent") }
                } else if request.parent != nil { throw SlopDocumentError("Parent requires draft") }
                authored = try candidate.apply(base: base, after: request.after)
            }
            if let key { drafts[key] = Draft(base: request.base, sequence: request.sequence, authored: authored) }
            try publish()
            scheduleProjection()
            result = .success(try frame())
        } catch {
            if let key { drafts[key] = Draft(base: request.base, sequence: request.sequence, authored: "", failed: true) }
            // Admitted failures consume and cache the sequence. Preserve a safe
            // limit explanation without turning this into an admission rejection.
            result = .failure((error as? SlopLimitError).map { SlopDocumentError(limit: $0) }
                ?? SlopDocumentError(error.localizedDescription))
        }
        replies[request.session] = Reply(sequence: request.sequence, digest: digest, result: result)
        return try result.get()
    }
    func guestRequest(_ method: SlopBridgeMethod, body: Data, lease: SlopRequestLease) throws -> SlopDocumentFrame {
        try lease.check()
        switch method {
        case .documentOpen, .documentFlush: try flush()
        case .documentApply: return try apply(JSONDecoder().decode(SlopDocumentEdit.self, from: body))
        case .documentReleaseDraft:
            struct Release: Decodable { let session: String; let draft: String }
            let value = try JSONDecoder().decode(Release.self, from: body)
            releaseDraft(session: value.session, draft: value.draft)
        default: throw SlopBridgeFailure(.invalidRequest, "Not a document method")
        }
        return try frame()
    }
    func resetGuestSessions() { replies.removeAll(); drafts.removeAll() }
    func shutDown() {
        cancelProjection()
        closed = true
        replies.removeAll(); drafts.removeAll()
        for listener in listeners.values { listener.finish() }
        listeners.removeAll()
    }
    public func releaseDraft(session: String, draft: String) { drafts.removeValue(forKey: session + ":" + draft) }
    public func nextBatch() throws -> SlopLoroBatch? { try requireOpen(); return try storage.nextBatch() }
    public func queuedBatches() throws -> [SlopLoroBatch] { try requireOpen(); return try storage.outbox() }
    public func queuedBatchCount() -> Int { (try? storage.queuedBatchCount()) ?? 0 }
    public func acknowledgeBatch(id: String, hash: String, sequence: Int) throws {
        try requireOpen()
        guard transport == .incremental, (2...10000).contains(sequence) else { throw SlopDocumentError("Invalid upload acknowledgement") }
        try storage.transaction { try storage.acknowledge(id: id, hash: hash) }
    }
    public func receiveBatch(_ batch: SlopLoroBatch, documentId: String, schema: String, sequence: Int) throws {
        try requireOpen()
        guard transport == .incremental, documentId == metadata.documentId, schema == metadata.schema,
              (2...10000).contains(sequence) else { throw SlopDocumentError("Invalid incremental delivery") }
        let bytes = try batch.decoded()
        try commit(local: false) { candidate, meta in
            if sequence <= meta.cursor { return }
            guard sequence == meta.cursor + 1 else { throw SlopDocumentError("Noncontiguous incremental delivery") }
            try candidate.receive(bytes); meta.cursor = sequence
        }
        try refreshExternal()
    }
    public func snapshot() throws -> Data { try flush(); return try replica.snapshot() }
    public func transfer() throws -> SlopLoroTransfer {
        try flush()
        return SlopLoroTransfer(documentId: metadata.documentId, schema: metadata.schema, checkpoint: try replica.snapshot().base64EncodedString(), version: replica.revision())
    }
    public func deliveryCursor() -> Int { metadata.cursor }
    private static func syncDirectory(_ url: URL) throws {
        let descriptor = Darwin.open(url.path, O_RDONLY)
        guard descriptor >= 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
        defer { Darwin.close(descriptor) }
        guard fsync(descriptor) == 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
    }
    public func sharingBundle(_ bytes: Data) throws -> Data {
        try requireOpen()
        return try storage.transaction {
            let url = root.appendingPathComponent("state/share-bootstrap.zip")
            // lstat also detects dangling links, which must fail rather than be replaced.
            var info = stat()
            if lstat(url.path, &info) == 0 { return try SlopFile.read(url, within: root) }
            guard errno == ENOENT else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
            guard bytes.count <= SlopFile.maximumBytes else { throw SlopLimitError("Shared app exceeds 25 MiB") }
            try bytes.write(to: url, options: .atomic)
            let handle = try FileHandle(forWritingTo: url)
            try handle.synchronize(); try handle.close()
            try Self.syncDirectory(url.deletingLastPathComponent())
            return bytes
        }
    }
    public func sharingSeed() -> SlopLoroTransfer? { metadata.shareSeed }
    public func identity() -> (documentId: String, schema: String) { (metadata.documentId, metadata.schema) }
    public func convertToIncremental() throws -> SlopLoroTransfer {
        try flush()
        if transport != .incremental {
            let seed = try transfer()
            try commit(local: false) { _, meta in meta.shareSeed = seed; meta.transport = .incremental; meta.cursor = 1 }
            try publish()
        }
        guard let seed = metadata.shareSeed else { throw SlopDocumentError("Only the originating owner can initialize the room") }
        return seed
    }
    public func independentCopy(to root: URL) throws -> SlopLoroDocument {
        try SlopLocalDocument.requireLocal(root)
        guard root.standardizedFileURL.resolvingSymlinksInPath() != self.root else { throw SlopDocumentError("A duplicate needs a new path") }
        try flush()
        guard projectionError == nil else { throw SlopDocumentError("External JSON needs review") }
        let package = try SlopPackage(rootURL: root)
        for url in [package.stateURL, package.jsonStoreURL] where FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        return try SlopLoroDocument(root: root, schema: replica.schema.source, initial: replica.current(), schemaFingerprint: metadata.schema)
    }
    public func backupDatabase(to destination: URL) throws { try flush(); try storage.backup(to: destination) }
    func injectFailure(after path: String?) { projectionFailure = path != nil }
    func configureStorage(milliseconds: Double, failure: String?) {
        storage.beforeCommit = failure == "before" ? { throw SlopDocumentError("Injected failure before database commit") } : nil
        projectionFailure = failure != nil && failure != "before"
    }
    public func close() throws {
        try flush()
        guard projectionError == nil else { throw SlopDocumentError(projectionError!) }
        closed = true
        for listener in listeners.values { listener.finish() }
        listeners.removeAll(); replies.removeAll(); drafts.removeAll()
    }

    struct Diagnostics: Sendable {
        let materializations: Int
        let listSearches: Int
        let listMoves: Int
        let publications: Int
        let projectionWrites: Int
    }
    func diagnostics() -> Diagnostics {
        Diagnostics(materializations: replica.work.materializations, listSearches: replica.work.listSearches,
                    listMoves: replica.work.listMoves, publications: publication, projectionWrites: projectionWrites)
    }
    func configureProjectionTiming(quiet: Duration, maximum: Duration) {
        projectionQuietPeriod = quiet
        projectionMaximumDelay = maximum
    }
}
