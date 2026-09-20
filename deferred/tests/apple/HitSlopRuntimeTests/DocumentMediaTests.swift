import Foundation
import Testing

@testable import HitSlopRuntime

struct DocumentMediaTests {
  private let schema = try! FixtureJSON(
    data: Data(
      #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"photo":{"type":"object","required":["sha256","mime","bytes"],"properties":{"sha256":{"type":"string","pattern":"^[a-f0-9]{64}$"},"mime":{"type":"string","minLength":1,"maxLength":127},"bytes":{"type":"integer","minimum":1,"maximum":26214400},"filename":{"type":"string","minLength":1,"maxLength":255}},"additionalProperties":false,"x-hitslop":{"container":"atomic","media":true},"~optional":true}}}"#
        .utf8))
  @Test func recordMediaUsesTheUnrestrictedKeySchema() async throws {
    let record: FixtureJSON = .object([
      "type": .string("object"),
      "patternProperties": .object([FixtureSchema.recordKeyPattern: schema["properties"]["photo"]]),
      "x-hitslop": .object(["container": .string("record")]),
    ])
    var source = schema
    source["properties"] = .object(["photos": record])
    let hash = String(repeating: "a", count: 64)
    let reference: FixtureJSON = .object([
      "sha256": .string(hash), "mime": .string("image/png"), "bytes": .number(1),
    ])
    let document: FixtureJSON = .object(["photos": .object(["a\nb": reference])])
    let validator = try FixtureSchema(source)
    try validator.validate(document)
    #expect(try await SlopMediaSync.hashes(in: document.json, using: validator.engine) == [hash])
    let request: FixtureJSON = .object([
      "ops": .array([
        .object([
          "op": .string("set"),
          "path": .array([.object(["key": .string("photos")]), .object(["key": .string("a\nb")])]),
          "value": reference,
        ])
      ])
    ])
    #expect(try SlopMediaSync.introducedHashes(in: request, schema: source) == [hash])
  }
  @Test func failedUploadNeverSendsOrPersistsAnUncertainCommand() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(root: root, schema: schema, initial: .object([:]))
    let seed = try await document.fixtureSeed()
    let opening = FixtureJSON.object([
      "snapshot": seed,
      "lease": .object(["id": .string("lease"), "expiresAt": .number(9_999_999_999_999)]),
    ])
    let calls = MediaCalls()
    let hash = String(repeating: "a", count: 64)
    try await document.connect(
      opening: opening,
      media: .init(
        prepare: { hashes in
          #expect(hashes == [hash])
          throw URLError(.notConnectedToInternet)
        }, load: { _ in })
    ) { _ in
      await calls.sent()
      return .object(["ok": .bool(true), "revision": .number(1)])
    }
    let reference = FixtureJSON.object([
      "sha256": .string(hash), "mime": .string("image/png"), "bytes": .number(1),
    ])
    let result = try await document.apply(
      testRequest(document.fixtureOpening(), ops: [testSet("photo", reference)]))
    #expect(result["error"]["code"].string == "storage_unavailable")
    #expect(await calls.count == 0)
    #expect(try await document.frame().fixtureData == .object([:]))
    #expect(try await document.frame().writable)
    try await document.close()
    let reopened = try SlopCommandDocument(root: root, schema: schema, initial: .object([:]))
    try await reopened.connect(opening: opening) { _ in
      await calls.sent()
      return .object(["ok": .bool(true), "revision": .number(1)])
    }
    #expect(await calls.count == 0)
    try await reopened.close()
  }
}
private actor MediaCalls {
  private(set) var count = 0
  func sent() { count += 1 }
}
