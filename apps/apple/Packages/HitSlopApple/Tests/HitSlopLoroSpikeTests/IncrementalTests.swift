import Foundation
import Testing
import Loro
@testable import HitSlopLoroSpike

private func input(_ name: String) throws -> SpikeJSON {
    try SpikeJSON(data: Data(contentsOf: #require(Bundle.module.url(forResource: "checklist.\(name)", withExtension: "json", subdirectory: "Fixtures"))))
}
private func seed() throws -> SpikeTransfer {
    let schema = try SpikeSchema(input("schema")), replica = try SpikeReplica(schema: schema, initial: input("initial"), peer: 1)
    return SpikeTransfer(documentId: UUID().uuidString, schema: SpikeBatch.digest(try schema.source.encoded()), checkpoint: try replica.snapshot().base64EncodedString(), version: replica.revision())
}
private func folder() throws -> URL {
    let path = FileManager.default.temporaryDirectory.appendingPathComponent("incremental-test-\(UUID()).slop")
    try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true); return path
}
private func owner(_ root: URL, _ initial: SpikeTransfer? = nil) throws -> SpikeDocument {
    try SpikeDocument(root: root, schema: input("schema"), initial: input("initial"), seed: initial, confirmation: .durable, transport: .incremental)
}
private func title(_ document: SpikeDocument, _ text: String, sequence: Int = 1) async throws {
    let frame = try await document.frame(); var after = frame.data; after["title"] = .string(text)
    _ = try await document.apply(.init(session: "test", sequence: sequence, base: frame.revision, after: after))
}

@Test func incrementalOutboxIsDurableAndRemoteImportsDoNotEcho() async throws {
    let aRoot = try folder(), bRoot = try folder(); defer { try? FileManager.default.removeItem(at: aRoot); try? FileManager.default.removeItem(at: bRoot) }
    let initial = try seed(), a = try owner(aRoot, initial), b = try owner(bRoot, initial)
    try await a.flush(); try await b.flush()
    try await title(a, "Local delta")
    let batch = try #require(await a.nextBatch())
    let reopened = try owner(aRoot)
    #expect(try await reopened.nextBatch() == batch)
    await #expect(throws: (any Error).self) { try await a.acknowledgeBatch(id: UUID().uuidString, hash: batch.hash, sequence: 2) }
    await #expect(throws: (any Error).self) { try await a.acknowledgeBatch(id: batch.id, hash: String(repeating: "0", count: 64), sequence: 2) }
    #expect(try await a.nextBatch() == batch)
    try await b.receiveBatch(batch, documentId: initial.documentId, schema: initial.schema, sequence: 2)
    #expect(try await b.frame().data["title"] == .string("Local delta"))
    #expect(try await b.queuedBatches().isEmpty)
    try await b.receiveBatch(batch, documentId: initial.documentId, schema: initial.schema, sequence: 2)
    #expect(await b.deliveryCursor() == 2)
    try await a.acknowledgeBatch(id: batch.id, hash: batch.hash, sequence: 2)
    #expect(await a.deliveryCursor() == 1)
    #expect(try await a.queuedBatches().isEmpty)
    try await a.close(); try await b.close()
}

@Test(arguments: ["before", "state/journal/pending.json", "state/checkpoint.loro", "state/materialization.json", "stores/data.json"])
func incrementalReceiveCommitsCursorWithCheckpoint(_ boundary: String) async throws {
    let aRoot = try folder(), bRoot = try folder(); defer { try? FileManager.default.removeItem(at: aRoot); try? FileManager.default.removeItem(at: bRoot) }
    let initial = try seed(), a = try owner(aRoot, initial), b = try owner(bRoot, initial)
    try await a.flush(); try await b.flush(); try await title(a, "Incoming durable delta")
    let batch = try #require(await a.nextBatch()), before = try await b.frame()
    await b.configureStorage(milliseconds: 0, failure: boundary)
    await #expect(throws: (any Error).self) { try await b.receiveBatch(batch, documentId: initial.documentId, schema: initial.schema, sequence: 2) }
    #expect(try await b.frame().data == before.data)
    #expect(await b.deliveryCursor() == 1)
    let reopened = try owner(bRoot)
    #expect(await reopened.deliveryCursor() == (boundary == "before" ? 1 : 2))
    #expect(try await reopened.frame().data["title"] == (boundary == "before" ? before.data["title"] : .string("Incoming durable delta")))
    #expect(try await reopened.queuedBatches().isEmpty)
    // Simulate process restart: use only the recovered owner from here.
    try await reopened.receiveBatch(batch, documentId: initial.documentId, schema: initial.schema, sequence: 2)
    #expect(await reopened.deliveryCursor() == 2)
    #expect(try await reopened.queuedBatches().isEmpty)
    try await a.close(); try await reopened.close()
}

@Test func incrementalExternalJSONCreatesAnOutgoingUpdate() async throws {
    let root = try folder(); defer { try? FileManager.default.removeItem(at: root) }
    let document = try owner(root, seed()); try await document.flush()
    let path = root.appendingPathComponent("stores/data.json")
    var envelope = try SpikeJSON(data: Data(contentsOf: path)); var data = envelope["data"]; data["title"] = .string("From disk"); envelope["data"] = data
    try envelope.encoded().write(to: path, options: .atomic); try await document.flush()
    #expect(try await document.queuedBatches().count == 1)
    try await document.flush(); #expect(try await document.queuedBatches().count == 1)
    try await document.close()
}

@Test func missingDependenciesDoNotMutateOrAdvanceCursor() async throws {
    let root = try folder(); defer { try? FileManager.default.removeItem(at: root) }
    let initial = try seed(), receiver = try owner(root, initial); try await receiver.flush()
    let r = try SpikeReplica(schema: SpikeSchema(input("schema")), initial: input("initial"), snapshot: Data(base64Encoded: initial.checkpoint))
    var value = try r.current(); let v0 = r.versionVector(); value["title"] = .string("First")
    try r.apply(base: r.revision(), after: value); let first = SpikeBatch(data: try r.updates(since: v0))
    let v1 = r.versionVector(); value["title"] = .string("Second"); try r.apply(base: r.revision(), after: value)
    let second = SpikeBatch(data: try r.updates(since: v1)), baseline = try await receiver.frame()
    await #expect(throws: (any Error).self) { try await receiver.receiveBatch(second, documentId: initial.documentId, schema: initial.schema, sequence: 2) }
    #expect(try await receiver.frame().data == baseline.data)
    #expect(await receiver.deliveryCursor() == 1)
    try await receiver.receiveBatch(first, documentId: initial.documentId, schema: initial.schema, sequence: 2)
    try await receiver.receiveBatch(second, documentId: initial.documentId, schema: initial.schema, sequence: 3)
    #expect(try await receiver.frame().data["title"] == .string("Second"))
    try await receiver.close()
}

@Test func invalidIncrementalBytesPreserveStateAndCursor() async throws {
    let root = try folder(); defer { try? FileManager.default.removeItem(at: root) }
    let initial = try seed(), receiver = try owner(root, initial); try await receiver.flush()
    let baseline = try await receiver.frame()
    let r = try SpikeReplica(schema: SpikeSchema(input("schema")), initial: input("initial"), snapshot: Data(base64Encoded: initial.checkpoint))
    let before = r.versionVector(); try r.doc.getMap(id: "data").insert(key: "title", v: SpikeJSON.bool(true).loro); r.doc.commit()
    for batch in [SpikeBatch(data: Data("invalid".utf8)), SpikeBatch(data: try r.updates(since: before))] {
        await #expect(throws: (any Error).self) { try await receiver.receiveBatch(batch, documentId: initial.documentId, schema: initial.schema, sequence: 2) }
        #expect(try await receiver.frame().data == baseline.data)
        #expect(await receiver.deliveryCursor() == 1)
    }
    try await receiver.close()
}

@Test(arguments: ["before", "state/journal/pending.json", "state/checkpoint.loro", "state/materialization.json", "stores/data.json"])
func incrementalJournalKeepsDataAndOutboxTogether(_ boundary: String) async throws {
    let root = try folder(); defer { try? FileManager.default.removeItem(at: root) }
    let initial = try seed(), document = try owner(root, initial); try await document.flush()
    await document.configureStorage(milliseconds: 0, failure: boundary)
    await #expect(throws: (any Error).self) { try await title(document, "Recover update") }
    if boundary != "before" {
        let recovered = try owner(root)
        #expect(try await recovered.frame().data["title"] == .string("Recover update"))
        #expect(try await recovered.queuedBatches().count == 1)
    }
    await document.configureStorage(milliseconds: 0, failure: nil); try await document.flush()
    let batch = try #require(await document.nextBatch())
    await document.configureStorage(milliseconds: 0, failure: boundary)
    if boundary == "state/checkpoint.loro" {
        // An ACK changes metadata only: the journal skips the identical checkpoint.
        try await document.acknowledgeBatch(id: batch.id, hash: batch.hash, sequence: 2)
    } else {
        await #expect(throws: (any Error).self) { try await document.acknowledgeBatch(id: batch.id, hash: batch.hash, sequence: 2) }
    }
    await document.configureStorage(milliseconds: 0, failure: nil); try await document.flush()
    #expect(try await document.queuedBatches().isEmpty)
    #expect(await document.deliveryCursor() == 1)
    try await document.close()
    let reopened = try owner(root)
    #expect(try await reopened.frame().data["title"] == .string("Recover update"))
    #expect(try await reopened.queuedBatches().isEmpty)
}
