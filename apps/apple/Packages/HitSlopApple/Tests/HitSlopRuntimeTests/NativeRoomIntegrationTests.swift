import Foundation
import HitSlopCore
import Testing

@testable import HitSlopRuntime

/// Run through apps/cloudflare's isolated Wrangler harness; never targets a hosted room.
@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_NATIVE_ROOM_ORIGIN"] != nil))
@MainActor func nativeCommandsRecoverThroughRealCloudflareRoom() async throws {
  let origin = try #require(
    URL(string: ProcessInfo.processInfo.environment["HITSLOP_NATIVE_ROOM_ORIGIN"]!))
  #expect(origin.host == "127.0.0.1")
  guard origin.host == "127.0.0.1" else { return }
  let parent = FileManager.default.temporaryDirectory.appendingPathComponent(
    "native-room-\(UUID())")
  let aRoot = parent.appendingPathComponent("a.slop")
  let bRoot = parent.appendingPathComponent("b.slop")
  try FileManager.default.createDirectory(
    at: aRoot.appendingPathComponent("assets"), withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: parent) }
  let schema =
    #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"left":{"type":"integer"},"right":{"type":"integer"},"photo":{"type":"object","required":["sha256","mime","bytes"],"properties":{"sha256":{"type":"string","pattern":"^[a-f0-9]{64}$"},"mime":{"type":"string","minLength":1,"maxLength":127},"bytes":{"type":"integer","minimum":1,"maximum":26214400},"filename":{"type":"string","minLength":1,"maxLength":255}},"additionalProperties":false,"x-hitslop":{"container":"atomic","media":true},"~optional":true}},"required":["left","right"],"additionalProperties":true}"#
  try commandEnvelope(schema).write(to: aRoot.appendingPathComponent("data.schema.json"))
  try Data(#"{"left":0,"right":0}"#.utf8).write(
    to: aRoot.appendingPathComponent("assets/initial.json"))
  try Data(
    #"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","slug":"native-room","title":"Native room","description":"Integration fixture","categories":["utilities"],"author":{"name":"Tests"},"presentation":{"width":320,"height":240}}"#
      .utf8
  ).write(to: aRoot.appendingPathComponent("manifest.json"))
  try Data("<!doctype html><title>Native room</title>".utf8).write(
    to: aRoot.appendingPathComponent("app.html"))
  let a = try #require(try SlopCommandDocument.open(package: SlopPackage(rootURL: aRoot)))
  let photoBytes = try #require(
    Data(
      base64Encoded:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    ))
  let aMedia = SlopMediaStore(
    directoryURL: aRoot.appendingPathComponent("stores/media"), rootURL: aRoot)
  let photo = try aMedia.add(photoBytes, imageOnly: true)
  func reference(_ media: SlopMediaStore.Reference) -> FixtureJSON {
    .object([
      "sha256": .string(media.sha256), "mime": .string(media.mime),
      "bytes": .number(Double(media.bytes)),
    ])
  }
  #expect(
    try await a.apply(testRequest(a.fixtureOpening(), ops: [testSet("photo", reference(photo))]))[
      "ok"] == .bool(true))
  let seed = try await a.fixtureSeed()
  let owner = SlopCloudAPI(origin: origin, authorization: { "test:native-owner" })
  let guest = SlopCloudAPI(origin: origin, authorization: { "test:native-friend" })
  let aTransfer = SlopMediaTransfer(package: try SlopPackage(rootURL: aRoot), api: owner)
  try await aTransfer.prepare([photo.sha256])
  let shared = try await owner.createDocument(
    id: seed["documentId"].string!, title: "Native room", slug: "native-room",
    schema: seed["schemaHash"].string!,
    package: SlopArchive.packSharedApp(aRoot), seed: seed)
  _ = try await guest.joinDocument(id: seed["documentId"].string!, invite: #require(shared.invite))
  let zip = parent.appendingPathComponent("join.zip")
  try await guest.documentPackage(seed["documentId"].string!).write(to: zip)
  try SlopArchive.extractDocument(zip, to: bRoot, expectedSHA256: shared.packageSha256)
  let b = try #require(
    try SlopCommandDocument.open(
      package: SlopPackage(rootURL: bRoot), seed: a.engine.call("frameSnapshot", [seed.json])))
  let bTransfer = SlopMediaTransfer(package: try SlopPackage(rootURL: bRoot), api: guest)
  func change(_ doc: SlopCommandDocument, _ key: String, _ number: Double) async throws {
    let result = try await doc.apply(
      testRequest(doc.fixtureOpening(), ops: [testSet(key, .number(number))]))
    #expect(result["ok"] == .bool(true))
  }
  func waitFor(_ condition: () async throws -> Bool) async throws {
    let deadline = ContinuousClock.now.advanced(by: .seconds(15))
    while try await !condition() {
      guard ContinuousClock.now < deadline else {
        throw SlopDocumentError("Native room convergence timed out")
      }
      try await Task.sleep(for: .milliseconds(30))
    }
  }
  let offline = try await b.apply(
    testRequest(b.fixtureOpening(), ops: [testSet("right", .number(99))]))
  #expect(offline["error"]["code"].string == "offline")
  let aSession = SlopRoomSession(
    origin: origin, documentId: seed["documentId"].string!, schema: seed["schemaHash"].string!,
    document: a,
    credentials: { try await owner.session(documentId: seed["documentId"].string!) },
    media: aTransfer.transport)
  let bSession = SlopRoomSession(
    origin: origin, documentId: seed["documentId"].string!, schema: seed["schemaHash"].string!,
    document: b,
    credentials: { try await guest.session(documentId: seed["documentId"].string!) },
    media: bTransfer.transport)
  defer {
    aSession.stop()
    bSession.stop()
  }
  aSession.start()
  bSession.start()
  try await waitFor {
    let first = try await a.frame().writable
    let second = try await b.frame().writable
    return first && second
  }
  try await b.loadMedia(photo.sha256)
  let bMedia = SlopMediaStore(
    directoryURL: bRoot.appendingPathComponent("stores/media"), rootURL: bRoot)
  #expect(try bMedia.read(photo.sha256) == photoBytes)
  #expect(SlopMediaSync.localHashes(in: try SlopPackage(rootURL: bRoot)).contains(photo.sha256))
  // A guest import is uploaded before its reference command reaches the room.
  let nextBytes = try #require(
    Data(base64Encoded: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"))
  let nextPhoto = try bMedia.add(nextBytes, imageOnly: true)
  let changed = try await b.apply(
    testRequest(b.fixtureOpening(), ops: [testSet("photo", reference(nextPhoto))]))
  #expect(changed["ok"] == .bool(true))
  try await waitFor { try await a.frame().data["photo"]["sha256"].string == nextPhoto.sha256 }
  try await a.loadMedia(nextPhoto.sha256)
  #expect(try aMedia.read(nextPhoto.sha256) == nextBytes)
  let publicAPI = SlopCloudAPI(origin: origin, authorization: { nil })
  #expect(try await publicAPI.media(nextPhoto.sha256) == nextBytes)
  try await change(a, "left", 1)
  try await change(b, "right", 2)
  try await waitFor {
    let left = try await a.frame().data
    let right = try await b.frame().data
    return left == right && left["left"] == .number(1) && left["right"] == .number(2)
  }
  await bSession.stopAndWait()
  #expect(try await b.frame().writable == false)
  try await change(a, "left", 3)
  bSession.start()
  try await waitFor { try await b.frame().writable }
  try await change(b, "right", 4)
  try await waitFor {
    let left = try await a.frame().data
    let right = try await b.frame().data
    return left == right && left["left"] == .number(3) && left["right"] == .number(4)
  }
  await aSession.stopAndWait()
  await bSession.stopAndWait()
  try await a.close()
  try await b.close()
  let reopened = try #require(try SlopCommandDocument.open(package: SlopPackage(rootURL: bRoot)))
  #expect(try await reopened.frame().data["left"] == .number(3))
  #expect(try await reopened.frame().data["right"] == .number(4))
  try await reopened.close()
}

private func commandEnvelope(_ schema: String) throws -> Data {
  let application = try JSONSerialization.jsonObject(with: Data(schema.utf8))
  let identity: [String: Any] = ["type": "string", "minLength": 1]
  return try JSONSerialization.data(withJSONObject: [
    "type": "object", "additionalProperties": false,
    "required": ["$slop", "data"],
    "properties": [
      "data": application,
      "$slop": [
        "type": "object", "additionalProperties": false,
        "required": ["format", "documentId", "schemaHash", "authority", "baseRevision"],
        "properties": [
          "format": ["const": 2], "documentId": identity, "schemaHash": identity,
          "authority": identity,
          "baseRevision": ["type": "integer", "minimum": 0, "maximum": 9_007_199_254_740_991],
        ],
      ],
    ],
  ])
}
