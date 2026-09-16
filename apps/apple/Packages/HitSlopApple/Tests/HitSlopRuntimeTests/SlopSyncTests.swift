import Foundation
import Testing
import HitSlopCore
@testable import HitSlopRuntime

private let syncSchema = try! SlopDocumentJSON(data: Data(#"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"left":{"type":"integer"},"right":{"type":"integer"}},"required":["left","right"],"additionalProperties":false}"#.utf8))
private let syncInitial = SlopDocumentJSON.object(["left": .number(0), "right": .number(0)])
private func temporarySyncRoot() throws -> URL {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-sync-test-\(UUID()).slop")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
}
private func edit(_ document: SlopLoroDocument, _ key: String, _ value: Double) async throws {
    let frame = try await document.frame()
    var data = frame.data; data[key] = .number(value)
    _ = try await document.apply(.init(session: UUID().uuidString, sequence: 1, base: frame.revision, after: data))
}

@Suite @MainActor struct SlopSyncTests {
    @Test func offlineMergeSurvivesReopenAndLostAcknowledgement() async throws {
        let aRoot = try temporarySyncRoot(), bRoot = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: aRoot); try? FileManager.default.removeItem(at: bRoot) }
        let a = try SlopLoroDocument(root: aRoot, schema: syncSchema, initial: syncInitial)
        let seed = try await a.convertToIncremental()
        let b = try SlopLoroDocument(root: bRoot, schema: syncSchema, initial: syncInitial, seed: seed, transport: .incremental)
        try await b.flush()
        try await edit(a, "left", 1); try await edit(b, "right", 2)
        let aBatch = try #require(await a.nextBatch()), bBatch = try #require(await b.nextBatch())
        // The bootstrap must not change when sharing is retried after offline edits.
        #expect(try await a.convertToIncremental().checkpoint == seed.checkpoint)
        try await a.close(); try await b.close()
        let reopened = try SlopLoroDocument(root: aRoot, schema: syncSchema, initial: syncInitial, transport: .incremental)
        let peer = try SlopLoroDocument(root: bRoot, schema: syncSchema, initial: syncInitial, transport: .incremental)
        #expect(try await reopened.nextBatch() == aBatch)
        #expect(try await reopened.convertToIncremental().checkpoint == seed.checkpoint)
        for doc in [reopened, peer] {
            try await doc.receiveBatch(aBatch, documentId: seed.documentId, schema: seed.schema, sequence: 2)
            try await doc.receiveBatch(bBatch, documentId: seed.documentId, schema: seed.schema, sequence: 3)
        }
        #expect(try await reopened.frame().data == peer.frame().data)
        #expect(try await reopened.frame().data == .object(["left": .number(1), "right": .number(2)]))
        try await reopened.acknowledgeBatch(id: aBatch.id, hash: aBatch.hash, sequence: 2)
        #expect(await reopened.deliveryCursor() == 3)
        #expect(try await reopened.nextBatch() == nil)
        try await reopened.close(); try await peer.close()
    }

    @Test func duplicateHasNewIdentityAndNoSharedHistory() async throws {
        let root = try temporarySyncRoot(), parent = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: parent) }
        try Data(#"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","slug":"sync-test","title":"Sync test","description":"Sync fixture","categories":["utilities"],"author":{"name":"Tests"},"presentation":{"width":320,"height":240}}"#.utf8).write(to: root.appendingPathComponent("manifest.json"))
        try Data("<!doctype html><title>Fixture</title>".utf8).write(to: root.appendingPathComponent("app.html"))
        let source = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        let seed = try await source.convertToIncremental()
        try await edit(source, "left", 8)
        let destination = try SlopDuplicator.duplicate(from: root, to: parent.appendingPathComponent("copy.slop"))
        let copy = try await source.independentCopy(to: destination)
        try await copy.flush()
        #expect(await copy.identity().documentId != seed.documentId)
        #expect(await copy.deliveryCursor() == 0)
        #expect(try await copy.nextBatch() == nil)
        #expect(try await copy.frame().data == source.frame().data)
        try await edit(copy, "right", 9)
        #expect(try await source.frame().data["right"] == .number(0))
        try await source.close(); try await copy.close()
    }

    @Test func rejectedTransactionNeverReappearsOnFlush() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        _ = try await doc.convertToIncremental()
        await doc.configureStorage(milliseconds: 0, failure: "before")
        await #expect(throws: (any Error).self) { try await edit(doc, "left", 10) }
        #expect(try await doc.frame().data == syncInitial)
        await doc.configureStorage(milliseconds: 0, failure: nil)
        try await doc.flush()
        #expect(try await doc.frame().data == syncInitial)
        #expect(try await doc.nextBatch() == nil)
        try await edit(doc, "left", 11)
        #expect(try await doc.frame().data["left"] == .number(11))
        try await doc.close()
    }

    @Test func sessionWaitsForReadyAndSendsOnlyOneOutstandingBatch() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        let seed = try await doc.convertToIncremental()
        try await edit(doc, "left", 1)
        let first = try #require(await doc.nextBatch())
        let socket = TestRoomSocket()
        let session = makeSession(doc, seed, sockets: [socket])
        defer { session.stop() }
        session.start()
        socket.deliver(["type": "welcome", "protocol": 1, "bootId": "test-boot", "peers": []])
        try await eventually { socket.frames("hello").count == 1 }
        #expect(socket.frames("append").isEmpty)
        socket.deliver(["type": "ready", "head": 1, "bootId": "test-boot", "peers": []])
        try await eventually { socket.frames("append").count == 1 }
        try await edit(doc, "right", 2)
        try await Task.sleep(for: .milliseconds(350))
        #expect(socket.frames("append").count == 1)
        socket.deliver(["type": "ack", "id": first.id, "hash": first.hash, "sequence": 2])
        try await eventually { socket.frames("append").count == 2 }
        #expect(session.status == .live)
        session.stop(); try await doc.close()
    }

    @Test func lostAckReconnectsWithFreshCredentialsAndSameBatch() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        let seed = try await doc.convertToIncremental()
        try await edit(doc, "left", 3)
        let first = TestRoomSocket(), second = TestRoomSocket(), tokens = TestCounter()
        let session = makeSession(doc, seed, sockets: [first, second], tokens: tokens, timeout: .milliseconds(100))
        defer { session.stop() }
        session.start(); first.deliver(["type": "welcome", "protocol": 1, "bootId": "test-boot", "peers": []])
        try await eventually { first.frames("hello").count == 1 }
        first.deliver(["type": "ready", "head": 1, "bootId": "test-boot", "peers": []])
        try await eventually { first.frames("append").count == 1 }
        try await eventually { tokens.value >= 2 }
        second.deliver(["type": "welcome", "protocol": 1, "bootId": "test-boot", "peers": []])
        try await eventually { second.frames("hello").count == 1 }
        #expect(second.frames("hello")[0]["after"] == .number(1))
        second.deliver(["type": "ready", "head": 1, "bootId": "test-boot", "peers": []])
        try await eventually { second.frames("append").count == 1 }
        #expect(first.frames("append")[0]["batch"] == second.frames("append")[0]["batch"])
        session.stop(); try await doc.close()
    }

    @Test func replayAcknowledgesWholeWindowAndRejectsTamperedHash() async throws {
        let root = try temporarySyncRoot(), peerRoot = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: peerRoot) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        let seed = try await doc.convertToIncremental()
        let peer = try SlopLoroDocument(root: peerRoot, schema: syncSchema, initial: syncInitial, seed: seed, transport: .incremental)
        try await peer.flush()
        try await edit(peer, "left", 1); try await edit(peer, "right", 2)
        let batches = try await peer.queuedBatches()
        let socket = TestRoomSocket(), session = makeSession(doc, seed, sockets: [socket])
        defer { session.stop() }
        session.start(); socket.deliver(["type": "welcome", "protocol": 1, "bootId": "test-boot", "peers": []])
        try await eventually { socket.frames("hello").count == 1 }
        let batchObjects = try batches.map { try JSONSerialization.jsonObject(with: JSONEncoder().encode($0)) }
        socket.deliver(["type": "updates", "documentId": seed.documentId, "schema": seed.schema,
                        "updates": [["sequence": 2, "batch": batchObjects[0]], ["sequence": 3, "batch": batchObjects[1]]]])
        try await eventually { socket.frames("applied").count == 1 }
        #expect(socket.frames("applied")[0]["sequence"] == .number(3))
        #expect(await doc.deliveryCursor() == 3)
        socket.deliver(["type": "updates", "documentId": seed.documentId, "schema": seed.schema,
                        "updates": [["sequence": 4, "batch": ["id": UUID().uuidString, "hash": String(repeating: "0", count: 64), "bytes": batches[0].bytes]]]])
        try await eventually { session.status == .paused }
        #expect(await doc.deliveryCursor() == 3)
        #expect(socket.frames("applied").count == 1)
        session.stop(); try await doc.close(); try await peer.close()
    }

    @Test func anotherOwnerPublishesItsCommittedGeneration() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let a = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        try await a.flush()
        let b = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        try await edit(a, "left", 3)
        try await b.flush()
        #expect(try await b.frame().data["left"] == .number(3))
        try await edit(b, "right", 7)
        try await a.flush()
        #expect(try await a.frame().data == b.frame().data)
        try await a.close(); try await b.close()
    }

    @Test func interruptedProjectionRecoversWithoutLosingCommittedChanges() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        try await doc.flush()
        await doc.injectFailure(after: "projection")
        try await edit(doc, "left", 6)
        try await doc.flush()
        #expect(try await doc.frame().projectionError != nil)
        let reopened = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        try await reopened.flush()
        #expect(try await reopened.frame().data["left"] == .number(6))
        #expect(try await reopened.frame().projectionError == nil)
        await doc.injectFailure(after: nil)
        try await doc.close(); try await reopened.close()
    }

    @Test func acknowledgementsDoNotRewriteProjectionOrCheckpoint() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        _ = try await doc.convertToIncremental(); try await edit(doc, "left", 2)
        // Isolate acknowledgement behavior from the independently scheduled projection.
        try await doc.flush()
        let batch = try #require(await doc.nextBatch())
        let storage = try SlopSyncStorage(root: root), before = try #require(try storage.load())
        let url = root.appendingPathComponent("stores/data.json"), bytes = try Data(contentsOf: url)
        let date = try url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        try await doc.acknowledgeBatch(id: batch.id, hash: batch.hash, sequence: 2)
        let after = try #require(try storage.load())
        #expect(before.checkpoint == after.checkpoint && before.updates == after.updates)
        #expect(before.metadata.generation == after.metadata.generation)
        #expect(try Data(contentsOf: url) == bytes)
        #expect(try url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate == date)
        try await doc.close()
        await #expect(throws: (any Error).self) { try await doc.receiveBatch(batch, documentId: before.metadata.documentId, schema: before.metadata.schema, sequence: 2) }
    }

    @Test func thousandEditsUsePeriodicFullHistoryCheckpoints() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        try await doc.flush()
        let storage = try SlopSyncStorage(root: root)
        var checkpoint = try #require(try storage.load()).checkpoint, checkpoints = 0
        let start = ContinuousClock.now
        for index in 1...1000 {
            let frame = try await doc.frame()
            var after = frame.data; after["left"] = .number(Double(index))
            _ = try await doc.apply(.init(session: "benchmark", sequence: index, base: frame.revision, after: after))
            let saved = try #require(try storage.load())
            if saved.checkpoint != checkpoint { checkpoints += 1; checkpoint = saved.checkpoint }
        }
        #expect(checkpoints == 10)
        let elapsed = start.duration(to: .now)
        let bytes = try Data(contentsOf: root.appendingPathComponent("state/document.sqlite")).count
        print("[sync benchmark] 1000 edits: \(elapsed), \(checkpoints) checkpoints, \(bytes) database bytes")
        try await doc.close()
        let reopened = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        #expect(try await reopened.frame().data["left"] == .number(1000))
        try await reopened.close()
    }

    @Test func revokedRoomPausesWithoutRenewingCredentialsForever() async throws {
        let root = try temporarySyncRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SlopLoroDocument(root: root, schema: syncSchema, initial: syncInitial)
        let seed = try await doc.convertToIncremental(), socket = TestRoomSocket(), tokens = TestCounter()
        let session = makeSession(doc, seed, sockets: [socket], tokens: tokens)
        session.start()
        socket.deliver(["type": "welcome", "protocol": 1, "bootId": "test", "peers": []])
        try await eventually { socket.frames("hello").count == 1 }
        socket.deliver(["type": "error", "status": 403, "message": "Access revoked"])
        try await eventually { session.status == .paused }
        #expect(tokens.value == 1)
        await session.stopAndWait(); try await doc.close()
    }

    private func makeSession(_ doc: SlopLoroDocument, _ seed: SlopLoroTransfer, sockets: [TestRoomSocket], tokens: TestCounter = TestCounter(), timeout: Duration = .seconds(30)) -> SlopRoomSession {
        let connections = TestCounter()
        return SlopRoomSession(origin: URL(string: "https://example.com")!, documentId: seed.documentId, schema: seed.schema, document: doc,
            credentials: { let n = tokens.next(); return SlopRoomSessionToken(token: "token-\(n)", documentId: seed.documentId, schema: seed.schema) },
            connect: { _ in sockets[min(connections.next() - 1, sockets.count - 1)] }, retryDelay: .milliseconds(10), acknowledgementTimeout: timeout)
    }
    private func eventually(_ condition: () async throws -> Bool) async throws {
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while try await !condition() {
            guard ContinuousClock.now < deadline else { throw SlopDocumentError("Timed out waiting for sync") }
            try await Task.sleep(for: .milliseconds(5))
        }
    }
}

private final class TestCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    var value: Int { lock.withLock { count } }
    func next() -> Int { lock.withLock { count += 1; return count } }
}
private final class TestRoomSocket: SlopRoomSocket, @unchecked Sendable {
    let stream: AsyncThrowingStream<Data, any Error>
    let continuation: AsyncThrowingStream<Data, any Error>.Continuation
    private let lock = NSLock()
    private var sent: [Data] = []
    init() { (stream, continuation) = AsyncThrowingStream.makeStream() }
    func receive() async throws -> Data {
        for try await data in stream { return data }
        throw URLError(.networkConnectionLost)
    }
    func send(_ data: Data) async throws { lock.withLock { sent.append(data) } }
    func cancel() { continuation.finish(throwing: URLError(.cancelled)) }
    func deliver(_ value: [String: Any]) { continuation.yield(try! JSONSerialization.data(withJSONObject: value)) }
    func frames(_ type: String) -> [SlopDocumentJSON] {
        lock.withLock { sent.compactMap { try? SlopDocumentJSON(data: $0) }.filter { $0["type"].string == type } }
    }
}
