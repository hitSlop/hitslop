import Foundation
import CryptoKit
import Testing
import Loro
@testable import HitSlopLoroSpike

@Test func spikeJSONRoundTrip() throws {
    let value = try SpikeJSON(data: Data(#"{"number":1,"flag":true,"empty":null}"#.utf8))
    #expect(try SpikeJSON(data: value.encoded()) == value)
    #expect(try SpikeJSON(loro: value.loro) == value)
}

private func fixture(_ name: String) throws -> SpikeJSON {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
    return try SpikeJSON(data: Data(contentsOf: url))
}
private func replica(_ name: String = "checklist", snapshot: Data? = nil, peer: UInt64 = 1) throws -> SpikeReplica {
    try SpikeReplica(schema: SpikeSchema(fixture("\(name).schema")), initial: fixture("\(name).initial"), snapshot: snapshot, peer: peer)
}
private func mutate(_ replica: SpikeReplica, _ body: (inout SpikeJSON) -> Void) throws {
    var value = try replica.current(); body(&value); try replica.apply(base: replica.revision(), after: value)
}
private func task(_ value: inout SpikeJSON, _ index: Int, _ body: (inout SpikeJSON) -> Void) {
    var items = value["tasks"].array; body(&items[index]); value["tasks"] = .array(items)
}
private func exchange(_ a: SpikeReplica, _ b: SpikeReplica) throws {
    let left = try a.updates(since: b), right = try b.updates(since: a)
    try a.receive(right); try b.receive(left)
}
private func temporary() throws -> URL {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("native-loro-test-\(UUID()).slop")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
}
private func document(_ root: URL) throws -> SpikeDocument {
    try SpikeDocument(root: root, schema: fixture("checklist.schema"), initial: fixture("checklist.initial"))
}

@Test func typeBoxAndNativeValidationAgree() throws {
    for test in try fixture("cases").array {
        let schema = try SpikeSchema(fixture("\(test["schema"].string!).schema"))
        var accepted = true
        do { try schema.validate(test["data"]) } catch { accepted = false }
        #expect(accepted == (test["valid"] == .bool(true)), "\(test["name"].string!)")
    }
}
@Test func bothDynamicSchemasRoundTripAndPreserveUnknownFields() throws {
    for name in ["checklist", "notes"] {
        let doc = try replica(name)
        try mutate(doc) { $0["future"] = .object(["keep": .array([.null, .bool(true), .number(1.5)])]) }
        let reopened = try replica(name, snapshot: doc.snapshot(), peer: 2)
        #expect(try reopened.current() == doc.current())
        #expect(try reopened.current()["future"] != .null)
    }
}
@Test func concurrentCheckboxTextAndMovesConverge() throws {
    let left = try replica(), right = try replica(snapshot: left.snapshot(), peer: 2)
    try mutate(left) { value in task(&value, 1) { $0["done"] = .bool(true) }; var items = value["tasks"].array; items.append(items.removeFirst()); value["tasks"] = .array(items) }
    try mutate(right) { value in task(&value, 1) { $0["text"] = .string("Take a walk today 😀") }; var items = value["tasks"].array; items.insert(items.removeLast(), at: 0); value["tasks"] = .array(items) }
    try exchange(left, right)
    #expect(try left.current() == right.current())
    let tasks = try left.current()["tasks"].array
    #expect(Set(tasks.compactMap { $0["id"].string }).count == 3)
    #expect(tasks.first { $0["id"].string == "walk" }?["done"] == .bool(true))
    #expect(tasks.first { $0["id"].string == "walk" }?["text"] == .string("Take a walk today 😀"))
}
@Test func historicalEditPreservesConcurrentChanges() throws {
    let left = try replica(), right = try replica(snapshot: left.snapshot(), peer: 2)
    let base = left.revision(); var edited = try left.current()
    task(&edited, 1) { $0["text"] = .string("Take a long walk without my phone") }
    edited["title"] = .string("Historical title")
    try mutate(right) { value in
        task(&value, 1) { $0["text"] = .string("Take a walk without my phone tonight"); $0["done"] = .bool(true) }
        value["future"] = .bool(true)
        value["tasks"] = .array(value["tasks"].array.reversed())
    }
    try exchange(left, right); try left.apply(base: base, after: edited); try exchange(left, right)
    #expect(try left.current() == right.current())
    let data = try left.current()
    #expect(data["future"] == .bool(true))
    #expect(data["tasks"].array.first?["id"].string == "weekend")
    let walk = data["tasks"].array.first { $0["id"].string == "walk" }
    #expect(walk?["done"] == .bool(true))
    #expect(walk?["text"].string == "Take a long walk without my phone tonight")
}
@Test func deletionWinsConcurrentItemEdit() throws {
    let a = try replica(), b = try replica(snapshot: a.snapshot(), peer: 2)
    try mutate(a) { $0["tasks"] = .array(Array($0["tasks"].array.dropFirst())) }
    try mutate(b) { task(&$0, 0) { $0["text"] = .string("changed") } }
    try exchange(a, b)
    #expect(try a.current() == b.current())
    #expect(try !a.current()["tasks"].array.contains { $0["id"].string == "first-draft" })
}
@Test func nestedRecordsAndAtomicValuesUseOneAdapter() throws {
    let a = try replica("notes"), b = try replica("notes", snapshot: a.snapshot(), peer: 2)
    try mutate(a) { $0["notes"]["first"]["text"] = .string("hello 👩🏽‍💻 é"); $0["tags"] = .array([.string("two")]) }
    try mutate(b) { $0["notes"]["first"]["done"] = .bool(true); $0["choice"] = .string("chosen") }
    try exchange(a, b)
    #expect(try a.current() == b.current())
    #expect(try a.current()["notes"]["first"]["done"] == .bool(true))
    #expect(try a.current()["notes"]["first"]["text"] == .string("hello 👩🏽‍💻 é"))
}
@Test func invalidLocalAndRemoteChangesLeaveLiveStateUntouched() throws {
    let a = try replica(), b = try replica(snapshot: a.snapshot(), peer: 2)
    let original = try a.current(), version = a.revision()
    var invalid = original; invalid["tasks"] = .array([original["tasks"].array[0], original["tasks"].array[0]])
    #expect(throws: (any Error).self) { try a.apply(base: version, after: invalid) }
    #expect(try a.current() == original)
    #expect(a.revision() == version)
    var item = original["tasks"].array[0]; item["id"] = .string("duplicate")
    try mutate(a) { $0["tasks"] = .array($0["tasks"].array + [item]) }
    try mutate(b) { $0["tasks"] = .array($0["tasks"].array + [item]) }
    let before = try a.current(), prior = a.revision()
    #expect(throws: (any Error).self) { try a.receive(b.updates(since: a)) }
    #expect(try a.current() == before); #expect(a.revision() == prior)
    #expect(throws: (any Error).self) { try a.receive(Data("broken checkpoint".utf8)) }
    #expect(try a.current() == before)
}
@Test func hostOrdersDeduplicatesAndRejectsBadRequests() async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try document(root); try await service.flush()
    let first = try await service.frame(); var after = first.data; after["title"] = .string("First")
    let edit = SpikeEdit(session: "view", sequence: 1, base: first.revision, after: after)
    let ack = try await service.apply(edit)
    #expect(try await service.apply(edit) == ack)
    await #expect(throws: (any Error).self) { try await service.apply(.init(session: "view", sequence: 1, base: first.revision, after: first.data)) }
    await #expect(throws: (any Error).self) { try await service.apply(.init(session: "view", sequence: 3, base: ack.revision, after: after)) }
    await #expect(throws: (any Error).self) { try await service.apply(.init(session: "view", sequence: 2, base: "unknown", after: after)) }
    after["title"] = .string("After rejected request")
    let final = try await service.apply(.init(session: "view", sequence: 3, base: ack.revision, after: after))
    #expect(final.data["title"].string == "After rejected request")
    #expect(final.publication > ack.publication)
    try await service.close()
}
@Test func staleUIRequestMergesRemoteEditAndPublishesMonotonically() async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try document(root); try await service.flush()
    let baseline = try await service.frame()
    let remote = try replica(snapshot: await service.snapshot(), peer: 2)
    try mutate(remote) { task(&$0, 1) { $0["done"] = .bool(true) } }
    let received = try await service.receive(remote.snapshot())
    var after = baseline.data; after["title"] = .string("Local title")
    let ack = try await service.apply(.init(session: "view", sequence: 1, base: baseline.revision, after: after))
    #expect(ack.data["tasks"].array[1]["done"] == .bool(true))
    #expect(ack.publication > received.publication)
    try await service.close()
}
@Test func nativeSnapshotAndCopyNeedNoWebview() async throws {
    let root = try temporary(), copyRoot = try temporary()
    defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: copyRoot) }
    let service = try document(root); let initial = try await service.frame()
    var after = initial.data; after["title"] = .string("Native accepted")
    _ = try await service.apply(.init(session: "view", sequence: 1, base: initial.revision, after: after))
    let copy = try await service.independentCopy(to: copyRoot); try await copy.flush()
    #expect(try await copy.frame().data == after)
    #expect(try await copy.frame().revision != service.frame().revision)
    let bytes = try await service.snapshot()
    #expect(try replica(snapshot: bytes).current() == after)
    try await service.close(); try await copy.close()
    let reopened = try document(root)
    #expect(try await reopened.frame().data == after)
    try await reopened.close()
}
@Test func unchangedMalformedProjectionDoesNotPublishOrCommitAgain() async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try document(root); try await service.flush()
    let file = root.appendingPathComponent("stores/data.json")
    let valid = try Data(contentsOf: file)
    try Data("{unfinished".utf8).write(to: file, options: .atomic)
    _ = try await service.transfer()
    let first = try await service.frame()
    #expect(first.projectionError != nil)
    let metadata = try Data(contentsOf: root.appendingPathComponent("state/materialization.json"))
    for _ in 0..<3 { _ = try await service.transfer() }
    #expect(try await service.frame().publication == first.publication)
    #expect(try Data(contentsOf: root.appendingPathComponent("state/materialization.json")) == metadata)
    var after = first.data; after["title"] = .string("Saved during file error")
    _ = try await service.apply(.init(session: "view", sequence: 1, base: first.revision, after: after))
    _ = try await service.transfer()
    let saved = try await service.frame()
    #expect(!saved.dirty)
    _ = try await service.transfer()
    #expect(try await service.frame().publication == saved.publication)
    #expect(try Data(contentsOf: file) == Data("{unfinished".utf8))
    try valid.write(to: file, options: .atomic); try await service.flush()
    #expect(try SpikeJSON(data: Data(contentsOf: file))["data"]["title"] == after["title"])
    try await service.close()
}
@Test(arguments: ["RabcX", "bcX", "a😀bcX", "REPLACED"])
func draftAncestryPreservesRemoteIntent(_ remoteText: String) async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try document(root)
    let initial = try await service.frame(); var seeded = initial.data
    task(&seeded, 0) { $0["text"] = .string("abc") }
    let base = try await service.apply(.init(session: "setup", sequence: 1, base: initial.revision, after: seeded))
    var local = base.data; task(&local, 0) { $0["text"] = .string("abcX") }
    let first = try await service.apply(.init(session: "view", sequence: 1, base: base.revision, after: local, draft: "typing"))
    var remote = first.data; task(&remote, 0) { $0["text"] = .string(remoteText) }
    _ = try await service.simulateRemote(after: remote)
    task(&local, 0) { $0["text"] = .string("abcXZ") }
    let request = SpikeEdit(session: "view", sequence: 2, base: base.revision, after: local, draft: "typing", parent: 1)
    let reply = try await service.apply(request)
    #expect(try await service.apply(request) == reply)
    let text = reply.data["tasks"].array[0]["text"].string!
    if remoteText == "RabcX" { #expect(text == "RabcXZ") }
    if remoteText == "bcX" { #expect(text == "bcXZ") }
    if remoteText == "a😀bcX" { #expect(text == "a😀bcXZ") }
    if remoteText == "REPLACED" { #expect(text.contains("REPLACED") && text.contains("Z")) }
    await #expect(throws: (any Error).self) {
        try await service.apply(.init(session: "view", sequence: 3, base: base.revision, after: local, draft: "typing", parent: 1))
    }
    await #expect(throws: (any Error).self) {
        try await service.apply(.init(session: "view", sequence: 4, base: base.revision, after: local, draft: "typing", parent: 3))
    }
    try await service.close()
}
@Test func externalJSONPreservesConcurrentEditsAndMalformedBytes() async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try document(root); try await service.flush()
    let file = root.appendingPathComponent("stores/data.json")
    var external = try SpikeJSON(data: Data(contentsOf: file))
    let baseline = try await service.frame(); var after = baseline.data
    task(&after, 1) { $0["done"] = .bool(true) }
    _ = try await service.apply(.init(session: "view", sequence: 1, base: baseline.revision, after: after))
    external["data"]["title"] = .string("External title")
    try external.encoded().write(to: file, options: .atomic)
    try await service.flush()
    let merged = try await service.frame()
    #expect(merged.data["title"].string == "External title")
    #expect(merged.data["tasks"].array[1]["done"] == .bool(true))
    try Data("{unfinished".utf8).write(to: file, options: .atomic)
    var later = merged.data; later["title"] = .string("Durable despite bad projection")
    _ = try await service.apply(.init(session: "view", sequence: 2, base: merged.revision, after: later))
    try await service.flush()
    #expect(try String(contentsOf: file, encoding: .utf8) == "{unfinished")
    #expect(try await service.frame().projectionError != nil)
    try await service.close()
    let reopened = try document(root)
    #expect(try await reopened.frame().data == later)
    try await reopened.close()
}
@Test func sharedCursorOnlyAdvancesWithDurableValidState() async throws {
    let aRoot = try temporary(), bRoot = try temporary()
    defer { try? FileManager.default.removeItem(at: aRoot); try? FileManager.default.removeItem(at: bRoot) }
    let a = try document(aRoot), seed = try await a.transfer()
    let b = try SpikeDocument(root: bRoot, schema: fixture("checklist.schema"), initial: fixture("checklist.initial"), seed: seed)
    func hash(_ transfer: SpikeTransfer) -> String { SHA256.hash(data: Data(base64Encoded: transfer.checkpoint)!).map { String(format: "%02x", $0) }.joined() }
    try await b.receiveShared(seed, sequence: 1, hash: hash(seed))
    let baseline = try await a.frame(); var after = baseline.data; after["title"] = .string("Shared durable")
    _ = try await a.apply(.init(session: "a", sequence: 1, base: baseline.revision, after: after))
    let next = try await a.transfer()
    await #expect(throws: (any Error).self) { try await b.receiveShared(next, sequence: 3, hash: hash(next)) }
    await #expect(throws: (any Error).self) { try await b.receiveShared(next, sequence: 2, hash: "invalid") }
    #expect(await b.deliveryCursor() == 1)
    #expect(try await b.frame().data == baseline.data)
    await b.injectFailure(after: "state/journal/pending.json")
    await #expect(throws: (any Error).self) { try await b.receiveShared(next, sequence: 2, hash: hash(next)) }
    #expect(await b.deliveryCursor() == 1)
    await b.injectFailure(after: nil)
    try await b.receiveShared(next, sequence: 2, hash: hash(next))
    try await b.receiveShared(seed, sequence: 1, hash: hash(seed))
    try await b.close()
    let reopened = try document(bRoot)
    #expect(await reopened.deliveryCursor() == 2)
    #expect(try await reopened.frame().data == after)
    try await reopened.close(); try await a.close()
}
@Test(arguments: ["state/journal/pending.json", "state/identity.json", "state/checkpoint.loro", "state/materialization.json", "stores/data.json"])
func realLoroCheckpointsRecoverAtEveryJournalBoundary(_ path: String) async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try document(root)
    if path != "state/identity.json" { try await service.flush() }
    let baseline = try await service.frame(); var after = baseline.data; after["title"] = .string("Recover \(path)")
    _ = try await service.apply(.init(session: "view", sequence: 1, base: baseline.revision, after: after))
    await service.injectFailure(after: path)
    await #expect(throws: (any Error).self) { try await service.flush() }
    let recovered = try document(root)
    #expect(try await recovered.frame().data == after)
    await service.injectFailure(after: nil)
    try await recovered.close(); try await service.close()
}

@Test(arguments: [SpikeConfirmation.accepted, .durable])
func confirmationMatchesPersistence(_ policy: SpikeConfirmation) async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try SpikeDocument(root: root, schema: fixture("checklist.schema"), initial: fixture("checklist.initial"), confirmation: policy)
    try await service.flush()
    let base = try await service.frame(); var after = base.data; after["title"] = .string("Confirmed")
    let reply = try await service.apply(.init(session: "view", sequence: 1, base: base.revision, after: after))
    #expect(reply.data == after)
    #expect(reply.dirty == (policy == .accepted))
    let disk = try SpikeJSON(data: Data(contentsOf: root.appendingPathComponent("stores/data.json")))
    #expect(disk["data"] == (policy == .durable ? after : base.data))
    try await service.close()
    let reopened = try document(root)
    #expect(try await reopened.frame().data == after)
    try await reopened.close()
}

@Test(arguments: ["before", "state/journal/pending.json", "state/checkpoint.loro", "state/materialization.json", "stores/data.json"])
func durableFailureKeepsConfirmedFrameAndRecovers(_ boundary: String) async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try SpikeDocument(root: root, schema: fixture("checklist.schema"), initial: fixture("checklist.initial"), confirmation: .durable)
    try await service.flush()
    let base = try await service.frame(); var after = base.data; after["title"] = .string("Recoverable candidate")
    await service.configureStorage(milliseconds: 0, failure: boundary)
    await #expect(throws: (any Error).self) {
        try await service.apply(.init(session: "view", sequence: 1, base: base.revision, after: after))
    }
    let failed = try await service.frame()
    #expect(failed.data == base.data && failed.dirty && failed.error != nil)
    if boundary == "before" {
        var blocked = after; blocked["title"] = .string("Must not be applied")
        await #expect(throws: (any Error).self) {
            try await service.apply(.init(session: "view", sequence: 2, base: base.revision, after: blocked))
        }
        #expect(try await service.frame().data == base.data)
    }
    await service.configureStorage(milliseconds: 0, failure: nil)
    try await service.flush()
    let recovered = try await service.frame()
    #expect(recovered.data == after && !recovered.dirty && recovered.error == nil)
    try await service.close()
    let reopened = try document(root)
    #expect(try await reopened.frame().data == after)
    try await reopened.close()
}

@Test func generatedBridgeContractRejectsMalformedRequests() throws {
    for text in [#"{"method":"open"}"#, #"{"method":"delay","milliseconds":20,"phase":"accept"}"#,
                 #"{"method":"apply","session":"v","sequence":1,"base":"r","after":{"nested":[true,null,1]}}"#] {
        try SpikeContract.validate(Data(text.utf8))
    }
    for text in [#"{"method":"open","extra":true}"#, #"{"method":"delay","milliseconds":-1}"#,
                 #"{"method":"apply","session":"v","sequence":0,"base":"r","after":{}}"#,
                 #"{"method":"apply","session":"v","sequence":1,"base":"r","after":{},"parent":1.5}"#] {
        #expect(throws: (any Error).self) { try SpikeContract.validate(Data(text.utf8)) }
    }
}

@Test(arguments: [SpikeConfirmation.accepted, .durable])
func failedCloseRemainsRecoverable(_ policy: SpikeConfirmation) async throws {
    let root = try temporary(); defer { try? FileManager.default.removeItem(at: root) }
    let service = try SpikeDocument(root: root, schema: fixture("checklist.schema"), initial: fixture("checklist.initial"), confirmation: policy)
    try await service.flush()
    let base = try await service.frame(); var after = base.data; after["title"] = .string("Close recovery")
    await service.configureStorage(milliseconds: 0, failure: "before")
    let edit = SpikeEdit(session: "view", sequence: 1, base: base.revision, after: after)
    if policy == .durable { await #expect(throws: (any Error).self) { try await service.apply(edit) } }
    else { _ = try await service.apply(edit) }
    await #expect(throws: (any Error).self) { try await service.close() }
    await service.configureStorage(milliseconds: 0, failure: nil)
    try await service.close()
    let reopened = try document(root)
    #expect(try await reopened.frame().data == after)
    try await reopened.close()
}
