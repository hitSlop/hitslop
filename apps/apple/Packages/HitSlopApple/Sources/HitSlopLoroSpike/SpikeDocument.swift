import Foundation
import CryptoKit
import HitSlopRuntime

package struct SpikeTransfer: Codable, Sendable {
    package let documentId: String
    package let schema: String
    package let checkpoint: String
    package let version: String
}

/// An experimental native document owner. All Loro and disk work stays on this actor;
/// none of its transactions suspend between validation, import, and publication.
package actor SpikeDocument {
    private let replica: SpikeReplica
    private let storage: SlopSyncStorage
    private let fingerprint: String
    private let id: String
    package let transport: SpikeTransport
    private var outbox: [SpikeBatch] = []
    private var stagedBatches: [SpikeBatch] = []
    private var stagedAcknowledgements = Set<String>()
    private let confirmation: SpikeConfirmation
    private var confirmedData: SpikeJSON
    private var confirmedFrontiers: String
    private var recoveryRequired = false
    private var storageDelay = 0.0
    private var failBeforeCommit = false
    private var publication = 0
    private var dirty = true
    private var error: String?
    private var projectionError: String?
    private var materializedHash: String?
    private var generation: String?
    private var receipts: [String: String] = [:]
    private var relayCursor = 0
    private var listeners: [UUID: AsyncStream<SpikeFrame>.Continuation] = [:]
    private var idleSave: Task<Void, Never>?
    private var maxSave: Task<Void, Never>?
    private var watcher: Task<Void, Never>?
    private var closed = false
    private struct Reply { let sequence: Int; let digest: String; let result: Result<SpikeFrame, SpikeFailure> }
    private var replies: [String: Reply] = [:]
    private struct Draft { let base: String; let sequence: Int; let authored: String; var failed = false }
    private var drafts: [String: Draft] = [:]

    package init(root: URL, schema: SpikeJSON, initial: SpikeJSON, seed: SpikeTransfer? = nil, confirmation: SpikeConfirmation = .accepted, transport: SpikeTransport = .snapshot) throws {
        self.confirmation = confirmation; self.transport = transport
        guard transport != .incremental || confirmation == .durable else { throw SpikeFailure("Incremental mode requires durable confirmation") }
        let schema = try SpikeSchema(schema)
        fingerprint = Self.hash(try schema.source.encoded())
        storage = SlopSyncStorage(root: root)
        let disk = try storage.open()
        let checkpoint = Self.bytes(disk, "checkpoint")
        if let identity = Self.bytes(disk, "identity") {
            let value = try SpikeJSON(data: identity)
            guard value["format"].string == "native-loro-spike-1", let identity = value["documentId"].string,
                  checkpoint != nil, let metadata = Self.bytes(disk, "metadata") else { throw SpikeFailure("Incomplete native spike state") }
            id = identity
            let meta = try SpikeJSON(data: metadata)
            guard meta["schema"].string == fingerprint else { throw SpikeFailure("Schema mismatch") }
            guard (meta["transport"].string ?? "snapshot") == transport.rawValue else { throw SpikeFailure("Transport mismatch; incremental mode requires fresh seeded documents") }
            outbox = try meta["outbox"].array.map { try JSONDecoder().decode(SpikeBatch.self, from: $0.encoded()) }
            for batch in outbox { _ = try batch.decoded() }
            materializedHash = meta["materializedHash"].string
            receipts = meta["receipts"].object.compactMapValues(\.string)
            relayCursor = Int(meta["relayCursor"].number ?? 0)
            guard seed == nil else { throw SpikeFailure("Cannot seed an existing document") }
        } else {
            guard checkpoint == nil, Self.bytes(disk, "metadata") == nil, Self.bytes(disk, "external") == nil else { throw SpikeFailure("Incomplete native spike state") }
            if let seed {
                guard seed.schema == fingerprint, UUID(uuidString: seed.documentId) != nil,
                      Data(base64Encoded: seed.checkpoint) != nil else { throw SpikeFailure("Invalid shared seed") }
            }
            guard transport != .incremental || seed != nil else { throw SpikeFailure("Incremental documents require the room seed") }
            id = seed?.documentId ?? UUID().uuidString
            // The immutable seed is log entry 1; start() journals it before UI open.
            if transport == .incremental { relayCursor = 1 }
        }
        replica = try SpikeReplica(schema: schema, initial: initial, snapshot: checkpoint ?? seed.flatMap { Data(base64Encoded: $0.checkpoint) })
        confirmedData = try replica.current()
        confirmedFrontiers = replica.revision()
        generation = disk["generation"] as? String
        dirty = checkpoint == nil
    }

    private static func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private static func bytes(_ disk: [String: Any], _ key: String) -> Data? { (disk[key] as? String).flatMap { Data(base64Encoded: $0) } }
    private func revision(_ authored: String? = nil) throws -> String {
        try SpikeJSON.object(["documentId": .string(id), "schema": .string(fingerprint), "frontiers": .string(authored ?? replica.revision()), "nonce": .string(UUID().uuidString)]).encoded().base64EncodedString()
    }
    private func frontiers(_ token: String) throws -> String {
        guard let bytes = Data(base64Encoded: token) else { throw SpikeFailure("Invalid base revision") }
        let value = try SpikeJSON(data: bytes)
        guard value["documentId"].string == id, value["schema"].string == fingerprint,
              let frontier = value["frontiers"].string else { throw SpikeFailure("Foreign base revision") }
        return frontier
    }
    package func frame() throws -> SpikeFrame {
        try SpikeFrame(publication: publication, revision: revision(confirmation == .durable ? confirmedFrontiers : nil),
                       data: confirmation == .durable ? confirmedData : replica.current(), dirty: dirty, error: error, projectionError: projectionError)
    }
    private func publish() throws {
        publication += 1
        let next = try frame()
        for continuation in listeners.values { continuation.yield(next) }
    }
    package func events() throws -> AsyncStream<SpikeFrame> {
        let key = UUID(), initial = try frame()
        return AsyncStream { continuation in
            listeners[key] = continuation
            continuation.yield(initial)
            continuation.onTermination = { [weak self] _ in Task { await self?.removeListener(key) } }
        }
    }
    private func removeListener(_ key: UUID) { listeners.removeValue(forKey: key) }
    package func start() throws {
        try flush()
        if watcher != nil { return }
        watcher = Task { [weak self] in
            while !Task.isCancelled {
                do { try await Task.sleep(for: .milliseconds(200)) } catch { return }
                await self?.poll()
            }
        }
    }
    private func poll() {
        guard !closed else { return }
        do {
            let disk = try storage.open()
            if disk["externalHash"] as? String != materializedHash || disk["generation"] as? String != generation {
                // Do not repeatedly rewrite a checkpoint while an external error is unchanged.
                if Self.bytes(disk, "external").map(Self.hash) != observedExternalHash || disk["generation"] as? String != generation { try flush() }
            }
        } catch { self.error = error.localizedDescription; try? publish() }
    }
    private var observedExternalHash: String?

    package func apply(_ request: SpikeEdit) throws -> SpikeFrame {
        guard !closed, !request.session.isEmpty, request.sequence > 0 else { throw SpikeFailure("Closed document or invalid session") }
        let digest = Self.hash(try SpikeJSON(data: JSONEncoder().encode(request)).encoded())
        if let previous = replies[request.session], previous.sequence == request.sequence {
            guard previous.digest == digest else { throw SpikeFailure("Sequence reused for a different edit") }
            return try previous.result.get()
        }
        guard request.sequence == (replies[request.session]?.sequence ?? 0) + 1 else { throw SpikeFailure("Out-of-order edit") }
        let result: Result<SpikeFrame, SpikeFailure>
        let draftKey = request.draft.map { request.session + ":" + $0 }
        do {
            // A failed commit may have a recoverable journal. Resolve it before
            // adding any further operations; the published frame stays confirmed.
            if recoveryRequired { try flush() }
            var base = try frontiers(request.base)
            if let key = draftKey {
                guard request.draft?.isEmpty == false else { throw SpikeFailure("Empty draft identity") }
                if let previous = drafts[key] {
                    guard !previous.failed, previous.base == request.base, request.parent == previous.sequence else { throw SpikeFailure("Invalid or failed draft ancestry") }
                    base = previous.authored
                } else if request.parent != nil { throw SpikeFailure("Unknown draft parent") }
            } else if request.parent != nil { throw SpikeFailure("Parent requires a draft") }
            let authored = try applyLocal(base: base, after: request.after)
            if let key = draftKey { drafts[key] = Draft(base: request.base, sequence: request.sequence, authored: authored) }
            dirty = true
            if confirmation == .durable { recoveryRequired = true; try flush() }
            else { try publish(); scheduleSave() }
            result = .success(try frame())
        } catch {
            if let key = draftKey { drafts[key] = Draft(base: request.base, sequence: request.sequence, authored: "", failed: true) }
            result = .failure(SpikeFailure(error.localizedDescription))
        }
        replies[request.session] = Reply(sequence: request.sequence, digest: digest, result: result)
        return try result.get()
    }
    @discardableResult private func applyLocal(base: String, after: SpikeJSON) throws -> String {
        let before = replica.versionVector(), revision = replica.revision()
        let authored = try replica.apply(base: base, after: after)
        if transport == .incremental, revision != replica.revision() {
            stagedBatches.append(SpikeBatch(data: try replica.updates(since: before)))
        }
        return authored
    }
    package func nextBatch() throws -> SpikeBatch? { try flush(); return outbox.first }
    package func queuedBatches() throws -> [SpikeBatch] { try flush(); return outbox }
    package func queuedBatchCount() -> Int { outbox.count }
    package func acknowledgeBatch(id: String, hash: String, sequence: Int) throws {
        guard transport == .incremental, sequence > 1, sequence <= 10000,
              let first = outbox.first, first.id == id, first.hash == hash else { throw SpikeFailure("Invalid upload acknowledgement") }
        stagedAcknowledgements.insert(id); dirty = true
        // Do not advance relayCursor here: other entries may precede this upload.
        try flush()
    }
    package func receiveBatch(_ batch: SpikeBatch, documentId: String, schema: String, sequence: Int) throws {
        guard transport == .incremental, documentId == id, schema == fingerprint, sequence > 1, sequence <= 10000 else { throw SpikeFailure("Invalid incremental delivery") }
        if recoveryRequired { try flush() }
        let bytes = try batch.decoded()
        if sequence <= relayCursor { return }
        guard sequence == relayCursor + 1 else { throw SpikeFailure("Noncontiguous incremental delivery") }
        try replica.receive(bytes) // Staged import rejects missing dependencies or invalid data.
        let previous = relayCursor; relayCursor = sequence; dirty = true
        do { try flush() } catch { relayCursor = previous; throw error }
    }
    package func releaseDraft(session: String, draft: String) { drafts.removeValue(forKey: session + ":" + draft) }
    private func scheduleSave() {
        idleSave?.cancel()
        idleSave = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(250)); try await self?.flush() } catch { /* flush publishes storage errors */ }
        }
        if maxSave == nil {
            maxSave = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(1)); try await self?.flush() } catch { }
            }
        }
    }
    private func importExternal(_ disk: [String: Any]) {
        observedExternalHash = disk["externalHash"] as? String
        let previousError = projectionError
        defer { if previousError != nil, projectionError == nil { dirty = true } }
        projectionError = nil
        guard let bytes = Self.bytes(disk, "external"), Self.hash(bytes) != materializedHash else { return }
        do {
            let envelope = try SpikeJSON(data: bytes)
            guard envelope["$slop"]["format"] == .number(1), let token = envelope["$slop"]["baseRevision"].string else { throw SpikeFailure("Invalid document envelope") }
            let digest = Self.hash(bytes)
            if let prior = receipts[token] {
                guard prior == digest else { throw SpikeFailure("External revision was already used for different content") }
                return
            }
            try applyLocal(base: frontiers(token), after: envelope["data"])
            receipts[token] = digest; dirty = true
        } catch { projectionError = error.localizedDescription }
    }
    package func flush() throws {
        idleSave?.cancel(); maxSave?.cancel(); idleSave = nil; maxSave = nil
        guard !closed else { throw SpikeFailure("Document is closed") }
        do {
            let disk = try storage.open()
            if disk["generation"] as? String != generation, let checkpoint = Self.bytes(disk, "checkpoint") {
                guard let bytes = Self.bytes(disk, "identity"), try SpikeJSON(data: bytes)["documentId"].string == id,
                      let metadata = Self.bytes(disk, "metadata") else { throw SpikeFailure("Document identity changed") }
                let meta = try SpikeJSON(data: metadata)
                guard meta["schema"].string == fingerprint else { throw SpikeFailure("Schema changed") }
                try replica.receive(checkpoint)
                guard (meta["transport"].string ?? "snapshot") == transport.rawValue else { throw SpikeFailure("Transport changed") }
                outbox = try meta["outbox"].array.map { try JSONDecoder().decode(SpikeBatch.self, from: $0.encoded()) }
                for batch in outbox { _ = try batch.decoded() }
                materializedHash = meta["materializedHash"].string
                receipts.merge(meta["receipts"].object.compactMapValues(\.string)) { current, _ in current }
                relayCursor = max(relayCursor, Int(meta["relayCursor"].number ?? 0))
            }
            let previousProjectionError = projectionError
            importExternal(disk)
            let checkpoint = try replica.snapshot()
            if !dirty, projectionError != nil || disk["externalHash"] as? String == materializedHash {
                let changed = error != nil || previousProjectionError != projectionError
                error = nil
                if changed { try publish() }
                return
            }
            var body: [String: Any] = [
                "expectedGeneration": disk["generation"]!, "expectedExternal": disk["externalHash"]!, "preserveExternal": false,
                "identity": try SpikeJSON.object(["format": .string("native-loro-spike-1"), "documentId": .string(id)]).encoded().base64EncodedString(),
                "checkpoint": checkpoint.base64EncodedString(),
            ]
            var nextHash = materializedHash
            if projectionError == nil {
                let projection = try SpikeJSON.object(["$slop": .object(["format": .number(1), "baseRevision": .string(revision())]), "data": replica.current()]).encoded()
                body["projection"] = projection.base64EncodedString(); nextHash = Self.hash(projection)
            }
            var nextOutbox = outbox
            for batch in stagedBatches where !nextOutbox.contains(where: { $0.id == batch.id }) { nextOutbox.append(batch) }
            nextOutbox.removeAll { stagedAcknowledgements.contains($0.id) }
            body["metadata"] = try SpikeJSON.object(["schema": .string(fingerprint), "materializedHash": nextHash.map(SpikeJSON.string) ?? .null,
                "receipts": .object(receipts.mapValues(SpikeJSON.string)), "relayCursor": .number(Double(relayCursor)),
                "transport": .string(transport.rawValue), "outbox": try SpikeJSON(data: JSONEncoder().encode(nextOutbox))]).encoded().base64EncodedString()
            if storageDelay > 0 { Thread.sleep(forTimeInterval: storageDelay / 1000) }
            if failBeforeCommit { throw SpikeFailure("Injected failure before journal commit") }
            let committed = try storage.commit(body)
            materializedHash = nextHash; generation = committed["generation"] as? String
            observedExternalHash = committed["externalHash"] as? String
            outbox = nextOutbox; stagedBatches.removeAll(); stagedAcknowledgements.removeAll()
            confirmedData = try replica.current(); confirmedFrontiers = replica.revision()
            recoveryRequired = false; dirty = false; error = nil; try publish()
        } catch {
            if confirmation == .durable { recoveryRequired = true }
            self.error = error.localizedDescription; try? publish(); throw error
        }
    }
    package func snapshot() throws -> Data { try flush(); return try replica.snapshot() }
    package func transfer() throws -> SpikeTransfer {
        try flush()
        return SpikeTransfer(documentId: id, schema: fingerprint, checkpoint: try replica.snapshot().base64EncodedString(), version: replica.revision())
    }
    package func deliveryCursor() -> Int { relayCursor }
    // Fault fixtures for the isolated harness; never exposed through the renderer bridge.
    package func invalidBatchFixture(_ kind: String) throws -> SpikeBatch {
        let r = try SpikeReplica(schema: replica.schema, initial: replica.current(), snapshot: replica.snapshot())
        var after = try r.current()
        if kind == "missing" {
            after["title"] = .string("Required predecessor")
            try r.apply(base: r.revision(), after: after)
            let before = r.versionVector()
            after["title"] = .string("Missing dependency")
            try r.apply(base: r.revision(), after: after)
            return SpikeBatch(data: try r.updates(since: before))
        }
        guard kind == "schema" else { throw SpikeFailure("Unknown fault fixture") }
        let before = r.versionVector()
        try r.doc.getMap(id: "data").insert(key: "title", v: SpikeJSON.bool(true).loro)
        r.doc.commit()
        return SpikeBatch(data: try r.updates(since: before))
    }
    package func receiveShared(_ transfer: SpikeTransfer, sequence: Int, hash: String) throws {
        guard !closed, transfer.documentId == id, transfer.schema == fingerprint,
              let bytes = Data(base64Encoded: transfer.checkpoint), Self.hash(bytes) == hash else { throw SpikeFailure("Invalid shared document or snapshot") }
        if sequence <= relayCursor { return }
        guard sequence == relayCursor + 1 else { throw SpikeFailure("Noncontiguous relay update") }
        try replica.receive(bytes)
        let previous = relayCursor
        relayCursor = sequence; dirty = true
        do { try flush() } catch { relayCursor = previous; throw error }
    }
    package func receive(_ bytes: Data) throws -> SpikeFrame {
        guard !closed else { throw SpikeFailure("Document is closed") }
        if recoveryRequired { try flush() }
        try replica.receive(bytes); dirty = true
        if confirmation == .durable { recoveryRequired = true; try flush() }
        else { try publish(); scheduleSave() }
        return try frame()
    }
    package func simulateRemote(after: SpikeJSON, base: String? = nil) throws -> SpikeFrame {
        let remote = try SpikeReplica(schema: replica.schema, initial: replica.current(), snapshot: replica.snapshot())
        try remote.apply(base: base.map(frontiers) ?? remote.revision(), after: after)
        return try receive(remote.updates(since: replica))
    }
    package func independentCopy(to root: URL) throws -> SpikeDocument {
        try flush()
        guard projectionError == nil else { throw SpikeFailure("External JSON needs review") }
        return try SpikeDocument(root: root, schema: replica.schema.source, initial: replica.current(), confirmation: confirmation)
    }
    package func injectFailure(after path: String?) {
        storage.afterReplace = path.map { target in { changed in if target == changed { throw SpikeFailure("Injected journal interruption at \(target)") } } }
    }
    package func configureStorage(milliseconds: Double, failure: String?) {
        storageDelay = max(0, min(1000, milliseconds))
        failBeforeCommit = failure == "before"
        injectFailure(after: failure == "before" ? nil : failure)
    }
    package func close() throws {
        try flush(); closed = true; watcher?.cancel(); watcher = nil
        for continuation in listeners.values { continuation.finish() }; listeners.removeAll(); replies.removeAll(); drafts.removeAll()
    }
}
