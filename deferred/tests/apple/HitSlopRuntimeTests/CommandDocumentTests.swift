import Foundation
import Testing

@testable import HitSlopRuntime

struct CommandDocumentTests {
  private let schema = try! FixtureJSON(
    data: Data(
      #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"count":{"type":"integer","minimum":0}},"required":["count"]}"#
        .utf8))
  private func directory() throws -> URL {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
  }
  private func command(_ open: FixtureJSON) -> FixtureJSON {
    var request = open["snapshot"].object
    request.removeValue(forKey: "revision")
    request.removeValue(forKey: "data")
    request["leaseId"] = open["lease"]["id"]
    request["requestId"] = .string(UUID().uuidString)
    request["ops"] = .array([
      .object([
        "op": .string("increment"), "path": .array([.object(["key": .string("count")])]),
        "amount": .number(1),
      ])
    ])
    return .object(request)
  }
  @Test func suspendedProposalDoesNotBlockCommandsOrClose() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let open = try await document.fixtureOpening()
    try await document.flush()
    let file = root.appendingPathComponent("stores/data.json")
    var stale = try FixtureJSON(data: Data(contentsOf: file))
    stale["data"]["count"] = .number(99)
    #expect(try await document.apply(command(open))["ok"] == .bool(true))
    let proposed = try stale.encoded()
    try proposed.write(to: file, options: .atomic)
    try await document.refreshExternal()
    let frame = try await document.frame()
    #expect(frame.snapshot["data"]["count"] == .number(1))
    #expect(frame.proposalPath != nil)
    #expect(try Data(contentsOf: URL(fileURLWithPath: frame.proposalPath!)) == proposed)
    #expect(try await document.apply(command(open))["ok"] == .bool(true))
    try await document.close()
    #expect(try Data(contentsOf: file) == proposed)
    let reopened = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    #expect(try await reopened.frame().data["count"] == .number(2))
    try await reopened.discardExternalProposal()
    #expect(try FixtureJSON(data: Data(contentsOf: file))["data"]["count"] == .number(2))
    try await reopened.close()
  }
  @Test func realProjectionFailureBlocksCloseWithoutRejectingCommittedCommand() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let open = try await document.fixtureOpening()
    try await document.flush()
    let file = root.appendingPathComponent("stores/data.json")
    try FileManager.default.removeItem(at: file)
    try FileManager.default.createDirectory(at: file, withIntermediateDirectories: false)
    #expect(try await document.apply(command(open))["ok"] == .bool(true))
    do {
      try await document.close()
      Issue.record("Close must fail when the projection cannot be written")
    } catch {}
    #expect(try await document.frame().data["count"] == .number(1))
    try FileManager.default.removeItem(at: file)
    try await document.close()
    #expect(try FixtureJSON(data: Data(contentsOf: file))["data"]["count"] == .number(1))
  }
  @Test func sharedModeSurvivesRestartAndCannotBecomeLocallyWritable() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    _ = try await document.fixtureOpening()
    let seed = try await document.fixtureSeed()
    #expect(try await document.frame().writable == false)
    let opening = FixtureJSON.object([
      "snapshot": seed,
      "lease": .object(["id": .string("room-lease"), "expiresAt": .number(9_999_999_999_999)]),
    ])
    try await document.connect(opening: opening) { _ in
      .object(["ok": .bool(true), "revision": .number(1)])
    }
    try await document.disconnect()
    try await document.close()
    let reopened = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let open = try await reopened.fixtureOpening()
    #expect(try await reopened.frame().writable == false)
    #expect(try await reopened.apply(command(open))["error"]["code"].string == "offline")
    try await reopened.close()
  }
  @Test func pendingSharedAttemptSurvivesAnOwnerRestart() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let seed = try await document.fixtureSeed()
    var opening = FixtureJSON.object([
      "snapshot": seed,
      "lease": .object(["id": .string("first-lease"), "expiresAt": .number(9_999_999_999_999)]),
    ])
    try await document.connect(opening: opening) { _ in throw URLError(.networkConnectionLost) }
    let original = command(try await document.fixtureOpening())
    #expect(try await document.apply(original)["error"]["code"].string == "unknown_outcome")
    await document.shutDown()
    let reopened = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    #expect(try await reopened.frame().writable == false)
    opening["snapshot"]["revision"] = .number(1)
    opening["snapshot"]["data"]["count"] = .number(1)
    opening["lease"]["id"] = .string("second-lease")
    let observed = AttemptLog()
    try await reopened.connect(opening: opening) { request in
      await observed.append(request)
      return .object(["ok": .bool(true), "revision": .number(1)])
    }
    #expect(await observed.values == [original])
    #expect(try await reopened.frame().data["count"] == .number(1))
    #expect(try await reopened.frame().writable)
    try await reopened.close()
  }
  @Test func promotionResumesWithTheSameFrozenSeedAfterRestart() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let seed = try await document.fixtureSeed()
    try await document.close()
    let reopened = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    #expect(await reopened.mode == .promoting)
    #expect(try await reopened.fixtureSeed() == seed)
    #expect(try await reopened.frame().writable == false)
    try await reopened.close()
  }
  @Test func anotherWindowCannotProjectAnOlderCommittedDocument() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let a = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let b = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let first = try await a.fixtureOpening()
    let second = try await b.fixtureOpening()
    #expect(try await a.apply(command(first))["ok"] == .bool(true))
    #expect(try await b.apply(command(second))["ok"] == .bool(true))
    try await a.flush()
    #expect(try await a.frame().data["count"] == .number(2))
    #expect(
      try FixtureJSON(data: Data(contentsOf: root.appendingPathComponent("stores/data.json")))[
        "data"][
          "count"] == .number(2))
    try await a.close()
    try await b.close()
  }

  @Test func committedExternalImportReplaysAfterInterruptedBookkeeping() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    _ = try await document.fixtureOpening()
    try await document.flush()
    await document.shutDown()
    let file = root.appendingPathComponent("stores/data.json")
    var envelope = try FixtureJSON(data: Data(contentsOf: file))
    envelope["data"]["count"] = .number(42)
    let bytes = try envelope.encoded()
    let hash = SlopCommandDocument.digest(bytes)
    try bytes.write(to: file, options: .atomic)
    let storage = try SlopCommandStorage(root: root)
    let opening = try storage.open()
    var record = try #require(try storage.load())
    record.metadata.externalOpening = .init(
      authority: opening.snapshot.authority, lease: opening.lease)
    try storage.transaction { try storage.saveMetadata(record.metadata) }
    var request = command(try FixtureJSON(opening.json))
    var fields = request.object
    fields.removeValue(forKey: "ops")
    request = .object(fields)
    request["requestId"] = .string("file:" + hash)
    request["replace"] = .object([
      "baseRevision": envelope["$slop"]["baseRevision"], "data": envelope["data"],
    ])
    #expect(try storage.apply(request, schema: FixtureSchema(schema)).result["ok"] == .bool(true))
    // Simulate termination here: the commit is durable, but materializedHash is still old.
    let reopened = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    _ = try await reopened.fixtureOpening()
    let frame = try await reopened.frame()
    #expect(frame.data["count"] == .number(42))
    #expect(frame.snapshot["revision"] == .number(1))
    #expect(frame.proposalPath == nil)
    try await reopened.close()
  }

}

private actor AttemptLog {
  var values: [FixtureJSON] = []
  func append(_ request: FixtureJSON) { values.append(request) }
}
