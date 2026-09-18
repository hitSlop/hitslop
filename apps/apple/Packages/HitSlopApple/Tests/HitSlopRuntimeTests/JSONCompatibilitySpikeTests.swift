import Foundation
import HitSlopCore
import Testing

@testable import HitSlopRuntime

// Opt-in reporting adapter for spikes/json-schema-comparison. Known mismatches
// are observations, not weakened production assertions; the TS oracle gates them.
private struct SpikeInput: Decodable {
  struct Fixture: Decodable {
    let name: String
    let json: String
    let valid: Bool
  }
  struct Group: Decodable {
    let name: String
    let schema: String
    let native: Bool
    let cases: [Fixture]
  }
  struct Boundary: Decodable {
    let name: String
    let kind: String
    let size: Int
    let escaped: Bool?
  }
  let groups: [Group]
  let boundaries: [Boundary]
}
private struct SpikeObservation: Encodable {
  let pass: Int
  var accepted = false
  var complete = true
  var phase = "parse"
  var parsedJSON: String?
  var outputJSON: String?
  var error: String?
}
private struct SpikeRow: Encodable {
  let engine = "native-document"
  let group: String
  let name: String
  let observations: [SpikeObservation]
}
private struct SpikeSchema: Encodable {
  let engine = "native-document"
  let group: String
  let accepted: Bool
  let outputJSON: String?
  let error: String?
}
private struct SpikeBoundary: Encodable {
  let engine = "native-document"
  let name: String
  let stage: String
  let expected: Bool
  let observed: Bool
  let error: String?
}
private struct SpikeReport: Encodable {
  var schemas: [SpikeSchema] = []
  var cases: [SpikeRow] = []
  var boundaries: [SpikeBoundary] = []
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_JSON_SPIKE_INPUT"] != nil))
func jsonCompatibilitySpike() throws {
  let environment = ProcessInfo.processInfo.environment
  let inputURL = URL(fileURLWithPath: try #require(environment["HITSLOP_JSON_SPIKE_INPUT"]))
  let outputURL = URL(fileURLWithPath: try #require(environment["HITSLOP_JSON_SPIKE_OUTPUT"]))
  let input = try JSONDecoder().decode(SpikeInput.self, from: Data(contentsOf: inputURL))
  var report = SpikeReport()
  for group in input.groups where group.native {
    let engine: StateEngine
    do {
      engine = try StateEngine()
      try engine.configure(group.schema)
      report.schemas.append(
        .init(
          group: group.name, accepted: true,
          outputJSON: group.schema, error: nil))
    } catch {
      report.schemas.append(
        .init(
          group: group.name, accepted: false, outputJSON: nil, error: error.localizedDescription))
      continue
    }
    var observations = Array(repeating: [SpikeObservation](), count: group.cases.count)
    for pass in 0..<3 {
      for (index, fixture) in group.cases.enumerated() {
        var row = SpikeObservation(pass: pass)
        do {
          let value = fixture.json
          row.phase = "serialization"
          row.parsedJSON = try engine.call("canonical", [value], as: String.self)
          row.phase = "validation"
          do {
            row.outputJSON = try engine.call("validateData", [value], as: String.self)
            row.accepted = true
          } catch { row.error = String(error.localizedDescription.prefix(1500)) }
          // Check nonmutation on failures, too.
          if row.outputJSON == nil {
            row.outputJSON = try engine.call("canonical", [value], as: String.self)
          }
        } catch {
          if row.phase != "parse" { row.complete = false }
          row.error = String(error.localizedDescription.prefix(1500))
        }
        observations[index].append(row)
      }
    }
    for (index, fixture) in group.cases.enumerated() {
      report.cases.append(
        .init(group: group.name, name: fixture.name, observations: observations[index]))
    }
  }
  for boundary in input.boundaries {
    try runSpikeBoundary(boundary, report: &report)
  }
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
  try encoder.encode(report).write(to: outputURL, options: .atomic)
  #expect(!report.cases.isEmpty && !report.boundaries.isEmpty)
}

private func runSpikeBoundary(_ boundary: SpikeInput.Boundary, report: inout SpikeReport) throws {
  let root = FileManager.default.temporaryDirectory.appendingPathComponent(
    "hitslop-json-spike-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: root) }
  let source: FixtureJSON
  let initial: FixtureJSON
  let replacement: FixtureJSON
  let path: [FixtureJSON]
  let expected: Bool
  if boundary.kind == "depth" {
    var node: FixtureJSON = .object([
      "type": .string("object"), "additionalProperties": .bool(true),
      "x-hitslop": .object(["container": .string("atomic")]),
    ])
    var seed = FixtureJSON.object([:])
    for _ in 0..<20 {
      node = .object([
        "type": .string("object"), "properties": .object(["v": node]),
        "required": .array([.string("v")]), "x-hitslop": .object(["container": .string("map")]),
      ])
      seed = .object(["v": seed])
    }
    node["x-hitslop"]["version"] = .number(1)
    source = node
    initial = seed
    var value = FixtureJSON.number(1)
    for _ in 0..<(boundary.size - 20) { value = .object(["n": value]) }
    replacement = value
    path = (0..<20).map { _ in .object(["key": .string("v")]) }
    expected = boundary.size <= 64
  } else {
    source = try FixtureJSON(
      data: Data(
        #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"text":{"type":"string"}},"required":["text"]}"#
          .utf8))
    initial = .object(["text": .string("")])
    let count = boundary.size - 11  // {"text":""}
    let text =
      boundary.escaped == true
      ? String(repeating: "\0", count: count / 6) + String(repeating: "x", count: count % 6)
      : String(repeating: "x", count: count)
    replacement = .string(text)
    path = [.object(["key": .string("text")])]
    expected = boundary.size <= SlopJSONLimits.documentBytes
  }
  let schema = try FixtureSchema(source)
  let storage = try SlopCommandStorage(root: root)
  let snapshot: FixtureJSON = .object([
    "documentId": .string("spike"), "schemaHash": .string("schema"),
    "authority": .string("local"), "revision": .number(0), "data": initial,
  ])
  try storage.initialize(snapshot: snapshot)
  let opening = try storage.open(now: 0)
  let request: FixtureJSON = .object([
    "documentId": .string("spike"), "schemaHash": .string("schema"),
    "authority": .string("local"), "leaseId": opening["lease"]["id"],
    "requestId": .string("boundary"),
    "ops": .array([.object(["op": .string("set"), "path": .array(path), "value": replacement])]),
  ])
  func record(_ stage: String, expected: Bool = true, _ action: () throws -> Bool) {
    do {
      report.boundaries.append(
        .init(
          name: boundary.name, stage: stage, expected: expected, observed: try action(), error: nil)
      )
    } catch {
      report.boundaries.append(
        .init(
          name: boundary.name, stage: stage, expected: expected, observed: false,
          error: error.localizedDescription))
    }
  }
  let bridgeBytes = try FixtureJSON.object([
    "method": .string("document.execute"), "request": request,
  ]).encoded()
  let requestLimit = SlopRuntimeSecurity.requestLimit(.documentExecute)
  // Transport overhead has its own budget: a legal 1 MiB document cannot
  // necessarily be replaced in a single 1 MiB command. Test authority separately.
  record("bridge-limits", expected: bridgeBytes.count <= requestLimit) {
    try SlopJSONLimits.check(bridgeBytes, maximumBytes: requestLimit)
    return true
  }
  let outcome = try storage.apply(request, schema: schema, now: 1)
  let accepted = outcome.result["ok"] == .bool(true)
  report.boundaries.append(
    .init(
      name: boundary.name, stage: "validation", expected: expected, observed: accepted,
      error: outcome.result["error"]["message"].string))
  record("persistence-reopen") {
    let reopened = try SlopCommandStorage(root: root)
    return try reopened.load()?.snapshot == outcome.snapshot
  }
  record("retry") { try storage.apply(request, schema: schema, now: 2).result == outcome.result }
  record("disk-projection") {
    let envelope: FixtureJSON = .object([
      "$slop": .object([
        "format": .number(2), "documentId": .string("spike"), "schemaHash": .string("schema"),
        "authority": .string("local"), "baseRevision": outcome.snapshot["revision"],
      ]), "data": outcome.snapshot["data"],
    ])
    return try FixtureJSON(data: envelope.encoded()) == envelope
  }
  record("room-frame") {
    let frame: FixtureJSON = .object([
      "type": .string("snapshot"), "snapshot": outcome.snapshot.fixtureValue,
    ])
    return try FixtureJSON(data: frame.encoded()) == frame
  }
  record("room-ready") {
    let frame: FixtureJSON = .object([
      "type": .string("ready"),
      "open": .object(["snapshot": outcome.snapshot.fixtureValue, "lease": opening["lease"]]),
      "peers": .array([]),
    ])
    return try FixtureJSON(data: frame.encoded()) == frame
  }
  if !accepted { record("rollback") { outcome.snapshot.fixtureValue == snapshot } }
}
