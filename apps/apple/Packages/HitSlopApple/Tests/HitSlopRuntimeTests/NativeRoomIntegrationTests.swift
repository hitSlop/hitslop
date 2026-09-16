import Foundation
import HitSlopCore
import Testing
@testable import HitSlopRuntime

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_NATIVE_ROOM_ORIGIN"] != nil && ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func nativeChecklistMergesThroughRealCloudflareRoom() async throws {
    let origin = try #require(URL(string: ProcessInfo.processInfo.environment["HITSLOP_NATIVE_ROOM_ORIGIN"]!))
    try #require(origin.host == "127.0.0.1")
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("checklist-room-\(UUID())")
    let aRoot = parent.appendingPathComponent("a.slop"), bRoot = parent.appendingPathComponent("b.slop")
    try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: parent) }
    try FileManager.default.copyItem(at: source, to: aRoot)
    let a = try #require(try SlopLoroDocument.open(package: SlopPackage(rootURL: aRoot)))
    let seed = try await a.convertToIncremental()
    let owner = SlopCloudAPI(origin: origin, authorization: { "test:checklist-owner" })
    let guest = SlopCloudAPI(origin: origin, authorization: { "test:checklist-friend" })
    let shared = try await owner.createDocument(id: seed.documentId, title: "Checklist", slug: "quick-checklist", schema: seed.schema,
        package: SlopArchive.packSharedApp(aRoot), seed: seed)
    _ = try await guest.joinDocument(id: seed.documentId, invite: #require(shared.invite))
    let zip = parent.appendingPathComponent("join.zip")
    try await guest.documentPackage(seed.documentId).write(to: zip)
    try SlopArchive.extractDocument(zip, to: bRoot, expectedSHA256: shared.packageSha256)
    let b = try #require(try SlopLoroDocument.open(package: SlopPackage(rootURL: bRoot), seed: seed))
    let af = try await a.frame(), bf = try await b.frame()
    var left = af.data, right = bf.data
    left["title"] = .string("Our " + (left["title"].string ?? ""))
    right["title"] = .string((right["title"].string ?? "") + " together")
    var tasks = left["tasks"].array
    tasks.append(.object(["id": .string("shared-task"), "text": .string("Send the invitation"), "done": .bool(false), "archived": .bool(false)]))
    left["tasks"] = .array(tasks)
    var other = Array(right["tasks"].array.reversed())
    let walk = try #require(other.firstIndex { $0["id"].string == "walk" })
    other[walk]["done"] = .bool(true)
    right["tasks"] = .array(other)
    _ = try await a.apply(.init(session: "left", sequence: 1, base: af.revision, after: left))
    _ = try await b.apply(.init(session: "right", sequence: 1, base: bf.revision, after: right))
    let asession = SlopRoomSession(origin: origin, documentId: seed.documentId, schema: seed.schema, document: a,
        credentials: { try await owner.session(documentId: seed.documentId) })
    let bsession = SlopRoomSession(origin: origin, documentId: seed.documentId, schema: seed.schema, document: b,
        credentials: { try await guest.session(documentId: seed.documentId) })
    defer { asession.stop(); bsession.stop() }
    asession.start(); bsession.start()
    let deadline = ContinuousClock.now.advanced(by: .seconds(15))
    while true {
        let av = try await a.frame().data, bv = try await b.frame().data
        if av == bv, await a.queuedBatchCount() == 0, await b.queuedBatchCount() == 0 { break }
        guard ContinuousClock.now < deadline else { throw SlopDocumentError("Checklist convergence timed out") }
        try await Task.sleep(for: .milliseconds(30))
    }
    let merged = try await a.frame().data
    #expect(merged["title"].string?.hasPrefix("Our ") == true)
    #expect(merged["title"].string?.hasSuffix(" together") == true)
    #expect(merged["tasks"].array.contains { $0["id"].string == "shared-task" })
    #expect(merged["tasks"].array.first { $0["id"].string == "walk" }?["done"] == .bool(true))
    let originalIDs = merged["tasks"].array.compactMap { $0["id"].string }.filter { $0 != "shared-task" }
    #expect(originalIDs == other.compactMap { $0["id"].string })
    await asession.stopAndWait(); await bsession.stopAndWait()
    try await a.close(); try await b.close()
    let reopened = try #require(try SlopLoroDocument.open(package: SlopPackage(rootURL: bRoot)))
    #expect(try await reopened.frame().data == merged)
    try await reopened.close()
}

/// Run through apps/cloudflare's isolated Wrangler harness; never targets a hosted room.
@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_NATIVE_ROOM_ORIGIN"] != nil))
@MainActor func nativeReplicasMergeOfflineThroughRealCloudflareRoom() async throws {
    let origin = try #require(URL(string: ProcessInfo.processInfo.environment["HITSLOP_NATIVE_ROOM_ORIGIN"]!))
    #expect(origin.host == "127.0.0.1")
    guard origin.host == "127.0.0.1" else { return }
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("native-room-\(UUID())")
    let aRoot = parent.appendingPathComponent("a.slop"), bRoot = parent.appendingPathComponent("b.slop")
    try FileManager.default.createDirectory(at: aRoot.appendingPathComponent("assets"), withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: parent) }
    let schema = #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"left":{"type":"integer"},"right":{"type":"integer"}},"required":["left","right"],"additionalProperties":true}"#
    try v1Envelope(schema).write(to: aRoot.appendingPathComponent("data.schema.json"))
    try Data(#"{"left":0,"right":0}"#.utf8).write(to: aRoot.appendingPathComponent("assets/initial.json"))
    try Data(#"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","slug":"native-room","title":"Native room","description":"Integration fixture","categories":["utilities"],"author":{"name":"Tests"},"presentation":{"width":320,"height":240}}"#.utf8).write(to: aRoot.appendingPathComponent("manifest.json"))
    try Data("<!doctype html><title>Native room</title>".utf8).write(to: aRoot.appendingPathComponent("app.html"))
    let a = try #require(try SlopLoroDocument.open(package: SlopPackage(rootURL: aRoot)))
    let seed = try await a.convertToIncremental()
    let owner = SlopCloudAPI(origin: origin, authorization: { "test:native-owner" })
    let guest = SlopCloudAPI(origin: origin, authorization: { "test:native-friend" })
    let shared = try await owner.createDocument(id: seed.documentId, title: "Native room", slug: "native-room", schema: seed.schema,
                                                package: SlopArchive.packSharedApp(aRoot), seed: seed)
    _ = try await guest.joinDocument(id: seed.documentId, invite: #require(shared.invite))
    let zip = parent.appendingPathComponent("join.zip")
    try await guest.documentPackage(seed.documentId).write(to: zip)
    try SlopArchive.extractDocument(zip, to: bRoot, expectedSHA256: shared.packageSha256)
    let b = try #require(try SlopLoroDocument.open(package: SlopPackage(rootURL: bRoot), seed: seed))
    func change(_ doc: SlopLoroDocument, _ key: String, _ number: Double) async throws {
        let frame = try await doc.frame()
        var after = frame.data; after[key] = .number(number)
        _ = try await doc.apply(.init(session: UUID().uuidString, sequence: 1, base: frame.revision, after: after))
    }
    func waitFor(_ condition: () async throws -> Bool) async throws {
        let deadline = ContinuousClock.now.advanced(by: .seconds(15))
        while try await !condition() {
            guard ContinuousClock.now < deadline else { throw SlopDocumentError("Native room convergence timed out") }
            try await Task.sleep(for: .milliseconds(30))
        }
    }
    // Separate edits exist durably before either peer opens its WebSocket.
    try await change(a, "left", 1); try await change(b, "right", 2)
    let aSession = SlopRoomSession(origin: origin, documentId: seed.documentId, schema: seed.schema, document: a,
                                  credentials: { try await owner.session(documentId: seed.documentId) })
    let bSession = SlopRoomSession(origin: origin, documentId: seed.documentId, schema: seed.schema, document: b,
                                  credentials: { try await guest.session(documentId: seed.documentId) })
    defer { aSession.stop(); bSession.stop() }
    aSession.start(); bSession.start()
    try await waitFor {
        let left = try await a.frame().data, right = try await b.frame().data
        let aPending = await a.queuedBatchCount(), bPending = await b.queuedBatchCount()
        return left == right && left["left"] == .number(1) && left["right"] == .number(2)
            && aPending == 0 && bPending == 0
    }
    await bSession.stopAndWait()
    try await change(b, "right", 4); try await change(a, "left", 3)
    bSession.start()
    try await waitFor {
        let left = try await a.frame().data, right = try await b.frame().data
        let aPending = await a.queuedBatchCount(), bPending = await b.queuedBatchCount()
        return left == right && left["left"] == .number(3) && left["right"] == .number(4)
            && aPending == 0 && bPending == 0
    }
    await aSession.stopAndWait(); await bSession.stopAndWait()
    try await a.close(); try await b.close()
    let reopened = try #require(try SlopLoroDocument.open(package: SlopPackage(rootURL: bRoot)))
    #expect(try await reopened.frame().data["left"] == .number(3))
    #expect(try await reopened.frame().data["right"] == .number(4))
    try await reopened.close()
}

private func v1Envelope(_ schema: String) throws -> Data {
    let application = try JSONSerialization.jsonObject(with: Data(schema.utf8))
    return try JSONSerialization.data(withJSONObject: ["type": "object", "additionalProperties": false,
        "required": ["$slop", "data"], "properties": ["data": application,
        "$slop": ["type": "object", "additionalProperties": false, "required": ["format", "baseRevision"],
        "properties": ["format": ["const": 1], "baseRevision": ["type": "string", "minLength": 1]]]]])
}
