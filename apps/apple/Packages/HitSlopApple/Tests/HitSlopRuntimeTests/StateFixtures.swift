import Foundation
import HitSlopCore
import HitSlopDocumentEngine

@testable import HitSlopRuntime

extension FixtureJSON {
  init(_ json: String) throws { try self.init(data: Data(json.utf8)) }
  var json: String { get throws { String(decoding: try encoded(), as: UTF8.self) } }
}
extension String {
  subscript(_ key: String) -> FixtureJSON { (try! FixtureJSON(self))[key] }
}
extension SlopCommandFrame { var fixtureData: FixtureJSON { try! FixtureJSON(data) } }
extension StateSnapshot {
  var fixtureValue: FixtureJSON { try! FixtureJSON(json) }
  subscript(_ key: String) -> FixtureJSON { (try! FixtureJSON(json))[key] }
  func encoded() throws -> Data { Data(json.utf8) }
}
extension StateOpening {
  subscript(_ key: String) -> FixtureJSON { (try! FixtureJSON(json))[key] }
}
extension StateResult {
  subscript(_ key: String) -> FixtureJSON { (try! FixtureJSON(json))[key] }
}
final class FixtureSchema {
  let source: FixtureJSON
  let engine: StateEngine
  static let recordKeyPattern = "^[\\s\\S]*$"
  init(_ source: FixtureJSON) throws {
    self.source = source
    engine = try StateEngine()
    try engine.configure(source.json)
  }
  func validate(_ value: FixtureJSON) throws {
    let _: String = try engine.call("validateData", [value.json])
  }
  struct Prepared {
    let data: FixtureJSON
    let bytes: Data
  }
  func prepare(_ value: FixtureJSON) throws -> Prepared {
    let json: String = try engine.call("validateData", [value.json])
    return try .init(data: FixtureJSON(json), bytes: Data(json.utf8))
  }
}
enum FixtureOps {
  static func apply(_ ops: FixtureJSON, to before: FixtureJSON, schema: FixtureSchema) throws
    -> FixtureJSON
  {
    try FixtureJSON(schema.engine.call("applyData", [before.json, ops.json], as: String.self))
  }
}
extension SlopCommandStorage {
  func initialize(snapshot: FixtureJSON, metadata: Metadata = .init(mode: .local)) throws {
    try initialize(
      snapshot: engine.call("frameSnapshot", [snapshot.json], as: StateSnapshot.self),
      metadata: metadata)
  }
  func apply(
    _ request: FixtureJSON, schema: FixtureSchema,
    now: Int = Int(Date().timeIntervalSince1970 * 1000)
  ) throws -> (snapshot: StateSnapshot, result: StateResult, metadata: Metadata) {
    try engine.configure(schema.source.json)
    return try apply(request.json, now: now)
  }
}
extension SlopCommandDocument {
  init(
    root: URL, schema: FixtureJSON, initial: FixtureJSON, schemaFingerprint: String? = nil,
    sharedSeed: FixtureJSON? = nil
  ) throws {
    let inspector = try StateEngine()
    defer { inspector.close() }
    let seed: StateSnapshot? = try sharedSeed.map { try inspector.call("frameSnapshot", [$0.json]) }
    try self.init(
      root: root, schema: schema.json, initial: initial.json, schemaFingerprint: schemaFingerprint,
      sharedSeed: seed)
  }
  func fixtureOpening() async throws -> FixtureJSON { try FixtureJSON(await openGuest().json) }
  func fixtureSeed() async throws -> FixtureJSON { try FixtureJSON(await prepareSharing().json) }
  func apply(_ request: FixtureJSON) async throws -> StateResult { try await apply(request.json) }
  func receive(_ snapshot: FixtureJSON) throws {
    try receive(engine.call("frameSnapshot", [snapshot.json], as: StateSnapshot.self))
  }
  func connect(
    opening: FixtureJSON, connectionId: String = UUID().uuidString,
    media: SlopDocumentMediaTransport? = nil,
    sender: @escaping @Sendable (FixtureJSON) async throws -> FixtureJSON
  ) async throws {
    try await connect(
      opening: engine.call("opening", [opening.json]), connectionId: connectionId, media: media
    ) { [engine] raw in
      try await engine.call("result", [sender(FixtureJSON(raw)).json])
    }
  }
}
extension SlopMediaSync {
  static func introducedHashes(in request: FixtureJSON, schema: FixtureJSON) throws -> Set<String> {
    let engine = try StateEngine()
    defer { engine.close() }
    try engine.configure(schema.json)
    return Set(try engine.call("introduced", [request.json], as: [String].self))
  }
}
extension SlopCloudAPI {
  func createDocument(
    id: String, title: String, slug: String, schema: String, package: Data, seed: FixtureJSON
  ) async throws -> SlopSharedDocument {
    let engine = try StateEngine()
    defer { engine.close() }
    let snapshot: StateSnapshot = try engine.call("frameSnapshot", [seed.json])
    return try await createDocument(
      id: id, title: title, slug: slug, schema: schema, package: package, seed: snapshot)
  }
}
