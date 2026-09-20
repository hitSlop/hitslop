import Foundation
import HitSlopCore
import Testing

@testable import HitSlopRuntime

struct DocumentBoundaryTests {
  private func directory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }
  private func nested(_ levels: Int, leaf: FixtureJSON = .number(1), arrays: Bool = false)
    -> FixtureJSON
  {
    var value = leaf
    for _ in 0..<levels { value = arrays ? .array([value]) : .object(["n": value]) }
    return value
  }
  private func documentSchema(_ fields: FixtureJSON) throws -> FixtureSchema {
    try FixtureSchema(
      .object([
        "type": .string("object"), "properties": fields,
        "x-hitslop": .object(["version": .number(1), "container": .string("map")]),
      ]))
  }
  @Test func containerCountingAndFraming() throws {
    // Undeclared data is preserved, while JSON bounds still apply.
    let schema = try documentSchema(.object([:]))
    for arrays in [false, true] {
      for (leaf, extra) in [(FixtureJSON.number(1), 0), (.object([:]), 1), (.array([]), 1)] {
        let value = FixtureJSON.object([
          "value": nested(63 - extra, leaf: leaf, arrays: arrays)
        ])
        let bytes = try schema.prepare(value).bytes
        try SlopJSONLimits.checkObject(
          value.jsonValue(), maximumBytes: SlopJSONLimits.documentBytes)
        #expect(try FixtureJSON(data: bytes, maximumDepth: 64) == value)
        let invalid = FixtureJSON.object([
          "value": nested(64 - extra, leaf: leaf, arrays: arrays)
        ])
        #expect(throws: (any Error).self) { try schema.prepare(invalid) }
        #expect(throws: (any Error).self) {
          try SlopJSONLimits.checkObject(
            invalid.jsonValue(), maximumBytes: SlopJSONLimits.documentBytes)
        }
        #expect(throws: (any Error).self) {
          try SlopJSONLimits.check(JSONEncoder().encode(invalid))
        }
      }
    }
    let frame = nested(68)
    #expect(try FixtureJSON(data: frame.encoded()) == frame)
    #expect(try JSONDecoder().decode(FixtureJSON.self, from: frame.encoded()) == frame)
    let tooDeep = nested(69)
    #expect(throws: (any Error).self) { try tooDeep.encoded() }
    #expect(throws: (any Error).self) {
      try FixtureJSON(
        data: Data(
          (String(repeating: "[", count: 69) + "1" + String(repeating: "]", count: 69)).utf8))
    }
    #expect(throws: (any Error).self) {
      try JSONDecoder().decode(
        FixtureJSON.self,
        from: Data(
          (String(repeating: "[", count: 69) + "1" + String(repeating: "]", count: 69)).utf8))
    }
  }
  @Test func exactByteLimitsAndConservativePreflight() throws {
    let schema = try documentSchema(.object(["text": .object(["type": .string("string")])]))
    for escaped in [false, true] {
      for size in [1_048_575, 1_048_576, 1_048_577] {
        let count = size - 11
        let string =
          escaped
          ? String(repeating: "\0", count: count / 6) + String(repeating: "x", count: count % 6)
          : String(repeating: "x", count: count)
        let value = FixtureJSON.object(["text": .string(string)])
        #expect(try value.encoded().count == size)
        let root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let storage = try SlopCommandStorage(root: root)
        let snapshot: FixtureJSON = .object([
          "documentId": .string("doc"), "schemaHash": .string("schema"),
          "authority": .string("local"), "revision": .number(0),
          "data": .object(["text": .string("")]),
        ])
        try storage.initialize(snapshot: snapshot)
        let opening = try storage.open(now: 0)
        let request: FixtureJSON = .object([
          "documentId": snapshot["documentId"], "schemaHash": snapshot["schemaHash"],
          "authority": snapshot["authority"], "leaseId": opening["lease"]["id"],
          "requestId": .string("size"),
          "ops": .array([
            .object([
              "op": .string("set"), "path": .array([.object(["key": .string("text")])]),
              "value": .string(string),
            ])
          ]),
        ])
        let outcome = try storage.apply(request, schema: schema, now: 1)
        #expect(outcome.result["ok"] == .bool(size <= SlopJSONLimits.documentBytes))
        #expect(
          outcome.snapshot["revision"] == .number(size <= SlopJSONLimits.documentBytes ? 1 : 0))
        let reopened = try SlopCommandStorage(root: root)
        #expect(try reopened.load()?.snapshot == outcome.snapshot)
        #expect(try reopened.apply(request, schema: schema, now: 2).result == outcome.result)
        if size <= SlopJSONLimits.documentBytes {
          #expect(try schema.prepare(value).bytes.count == size)
          try SlopJSONLimits.checkObject(value.jsonValue(), maximumBytes: size)
        } else {
          #expect(throws: (any Error).self) { try schema.prepare(value) }
        }
      }
    }
    // Multiple separators, multibyte keys/text, escaped keys, arrays and empty containers.
    let value: FixtureJSON = .object([
      "é\n": .string("🇨🇦\0"), "b": .array([.string("中"), .null, .object([:])]),
    ])
    let bytes = try value.encoded()
    try value.validateBounds(maximumBytes: bytes.count)
    try SlopJSONLimits.checkObject(value.jsonValue(), maximumBytes: bytes.count)
    #expect(try value.encoded(maximumBytes: bytes.count) == bytes)
    #expect(throws: (any Error).self) { try value.encoded(maximumBytes: bytes.count - 1) }
  }
  @Test(arguments: [62, 63, 64, 65]) func durableDepth(_ depth: Int) throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    var source: FixtureJSON = .object([
      "type": .string("object"), "additionalProperties": .bool(true),
      "x-hitslop": .object(["container": .string("atomic")]),
    ])
    var initial = FixtureJSON.object([:])
    for _ in 0..<20 {
      source = .object([
        "type": .string("object"), "properties": .object(["v": source]),
        "x-hitslop": .object(["container": .string("map")]),
      ])
      initial = .object(["v": initial])
    }
    source["x-hitslop"]["version"] = .number(1)
    let schema = try FixtureSchema(source)
    let storage = try SlopCommandStorage(root: root)
    let seed: FixtureJSON = .object([
      "documentId": .string("doc"), "schemaHash": .string("schema"), "authority": .string("local"),
      "revision": .number(0), "data": initial,
    ])
    try storage.initialize(snapshot: seed)
    let open = try storage.open(now: 0)
    let request: FixtureJSON = .object([
      "documentId": seed["documentId"], "schemaHash": seed["schemaHash"],
      "authority": seed["authority"], "leaseId": open["lease"]["id"], "requestId": .string("edit"),
      "ops": .array([
        .object([
          "op": .string("set"),
          "path": .array((0..<20).map { _ in .object(["key": .string("v")]) }),
          "value": nested(depth - 20),
        ])
      ]),
    ])
    try SlopJSONLimits.check(
      FixtureJSON.object(["method": .string("document.execute"), "request": request]).encoded()
    )
    let outcome = try storage.apply(request, schema: schema, now: 1)
    #expect(outcome.result["ok"] == .bool(depth <= 64))
    #expect(outcome.snapshot["revision"] == .number(depth <= 64 ? 1 : 0))
    let reopened = try SlopCommandStorage(root: root)
    #expect(try reopened.load()?.snapshot == outcome.snapshot)
    #expect(try reopened.apply(request, schema: schema, now: 2).result == outcome.result)
    let envelopes: [FixtureJSON] = [
      .object(["$slop": .object(["format": .number(2)]), "data": outcome.snapshot["data"]]),
      .object(["type": .string("snapshot"), "snapshot": outcome.snapshot.fixtureValue]),
      .object([
        "type": .string("ready"),
        "open": .object(["snapshot": outcome.snapshot.fixtureValue, "lease": open["lease"]]),
        "peers": .array([]),
      ]),
    ]
    for envelope in envelopes {
      #expect(try FixtureJSON(data: envelope.encoded()) == envelope)
    }
    // Storage's non-prepared initialization/save paths obey the same invariant.
    let copy = try directory()
    defer { try? FileManager.default.removeItem(at: copy) }
    let other = try SlopCommandStorage(root: copy)
    try other.initialize(snapshot: outcome.snapshot)
    #expect(try other.load()?.snapshot == outcome.snapshot)
    var invalid = outcome.snapshot.fixtureValue
    invalid["data"] = nested(65)
    #expect(throws: (any Error).self) {
      try other.save(
        .init(
          snapshot: other.engine.call("frameSnapshot", [invalid.json], as: StateSnapshot.self),
          metadata: .init(mode: .local)))
    }
    #expect(try other.load()?.snapshot == outcome.snapshot)
  }
  @Test func sharedDataUsesExactByteAndDepthLimits() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let source = try documentSchema(.object(["text": .object(["type": .string("string")])])).source
    let initial: FixtureJSON = .object(["text": .string("original")])
    let document = try SlopCommandDocument(root: root, schema: source, initial: initial)
    let seed = try await document.fixtureSeed()
    var opening: FixtureJSON = .object([
      "snapshot": seed,
      "lease": .object(["id": .string("lease"), "expiresAt": .number(9_999_999_999_999)]),
    ])
    var invalid = seed
    invalid["data"] = .object(["text": .string(String(repeating: "\0", count: 180_000))])
    opening["snapshot"] = invalid
    await #expect(throws: (any Error).self) {
      try await document.connect(opening: opening) { _ in .null }
    }
    opening["snapshot"] = seed
    try await document.connect(opening: opening) { _ in .null }
    invalid["revision"] = .number(1)
    await #expect(throws: (any Error).self) { try await document.receive(invalid) }
    invalid["data"] = nested(65)
    await #expect(throws: (any Error).self) { try await document.receive(invalid) }
    #expect(try await document.frame().fixtureData == initial)
    #expect(try SlopCommandStorage(root: root).load()?.snapshot["revision"] == .number(0))
    try await document.close()
  }

  @Test func recordKeysAndLegacyRejection() throws {
    let field: FixtureJSON = .object([
      "type": .string("object"),
      "patternProperties": .object([#"^[\s\S]*$"#: .object(["type": .string("number")])]),
      "x-hitslop": .object(["container": .string("record")]),
    ])
    let schema = try documentSchema(.object(["values": field]))
    for key in ["", "a\nb", "a\rb", "a\u{2028}b", "a\u{2029}b", "a\0b", "__proto__", "constructor"]
    {
      let good: FixtureJSON = .object(["values": .object([key: .number(2)])])
      try schema.validate(good)
      #expect(throws: (any Error).self) {
        try schema.validate(.object(["values": .object([key: .string("wrong")])]))
      }
      let path: FixtureJSON = .array([
        .object(["key": .string("values")]), .object(["key": .string(key)]),
      ])
      let changed = try FixtureOps.apply(
        .array([.object(["op": .string("set"), "path": path, "value": .number(3)])]), to: good,
        schema: schema)
      #expect(changed["values"][key] == .number(3))
      #expect(throws: (any Error).self) {
        try FixtureOps.apply(
          .array([.object(["op": .string("set"), "path": path, "value": .string("bad")])]),
          to: good, schema: schema)
      }
    }
    var legacy = field
    legacy["patternProperties"] = .object(["^.*$": .object(["type": .string("number")])])
    #expect(throws: (any Error).self) { try documentSchema(.object(["values": legacy])) }
  }
}
