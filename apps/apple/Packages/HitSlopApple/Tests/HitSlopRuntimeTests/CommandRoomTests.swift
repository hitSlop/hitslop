import Foundation
import Testing

@testable import HitSlopRuntime

@MainActor struct CommandRoomTests {
  // Server fixtures deliberately use the room wire version, not the WebView bridge constant.
  private let schema = try! FixtureJSON(
    data: Data(
      #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"count":{"type":"integer"}},"required":["count"]}"#
        .utf8))
  private func eventually(_ condition: () async throws -> Bool) async throws {
    let deadline = ContinuousClock.now.advanced(by: .seconds(4))
    while try await !condition() {
      guard ContinuousClock.now < deadline else {
        throw SlopDocumentError("Timed out waiting for command transport")
      }
      try await Task.sleep(for: .milliseconds(5))
    }
  }
  @Test func depth64SurvivesReadyAndSnapshotMessages() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    func data(_ leaf: Int) -> FixtureJSON {
      var value = FixtureJSON.number(Double(leaf))
      for _ in 0..<63 { value = .object(["n": value]) }
      return .object(["value": value])
    }
    let source = try FixtureJSON(
      data: Data(
        #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{},"additionalProperties":true}"#
          .utf8))
    let document = try SlopCommandDocument(root: root, schema: source, initial: data(0))
    let seed = try await document.fixtureSeed()
    let identity = await document.identity()
    let socket = TestRoomSocket()
    let session = SlopRoomSession(
      origin: URL(string: "http://127.0.0.1")!, documentId: identity.documentId,
      schema: identity.schema,
      document: document,
      credentials: {
        SlopRoomSessionToken(
          token: "token", documentId: identity.documentId, schema: identity.schema)
      },
      connect: { _ in socket })
    session.start()
    socket.deliver(["type": "welcome", "protocol": 3, "peers": []])
    try await eventually { socket.frames("hello").count == 1 }
    socket.deliver([
      "type": "ready",
      "open": [
        "snapshot": try seed.jsonValue(),
        "lease": ["id": "deep-lease", "expiresAt": 9_999_999_999_999],
      ], "peers": [],
    ])
    try await eventually { session.status == .live }
    var next = seed
    next["revision"] = .number(1)
    next["data"] = data(1)
    socket.deliver(["type": "snapshot", "snapshot": try next.jsonValue()])
    try await eventually { try await document.frame().fixtureData == data(1) }
    await session.stopAndWait()
    try await document.close()
    let reopened = try SlopCommandDocument(root: root, schema: source, initial: data(0))
    #expect(try await reopened.frame().fixtureData == data(1))
    try await reopened.close()
  }

  @Test func lostReplyReconnectsAndResendsThePersistedRequest() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    let seed = try await document.fixtureSeed()
    let first = TestRoomSocket()
    let second = TestRoomSocket()
    let calls = TestCounter()
    let identity = await document.identity()
    let session = SlopRoomSession(
      origin: URL(string: "http://127.0.0.1")!, documentId: identity.documentId,
      schema: identity.schema,
      document: document,
      credentials: {
        _ = calls.next()
        return SlopRoomSessionToken(
          token: "token", documentId: identity.documentId, schema: identity.schema)
      },
      connect: { _ in calls.value == 1 ? first : second }, retryDelay: .milliseconds(5),
      acknowledgementTimeout: .milliseconds(80))
    defer { session.stop() }
    session.start()
    try await eventually { calls.value == 1 }
    first.deliver(["type": "welcome", "protocol": 3, "peers": []])
    try await eventually { first.frames("hello").count == 1 }
    let opening = FixtureJSON.object([
      "snapshot": seed,
      "lease": .object(["id": .string("lease-one"), "expiresAt": .number(9_999_999_999_999)]),
    ])
    first.deliver(["type": "ready", "open": try opening.jsonValue(), "peers": []])
    try await eventually { session.status == .live }
    let request = testRequest(
      try await document.fixtureOpening(), ops: [testSet("count", .number(1))])
    let sending = Task { try await document.apply(request) }
    try await eventually { first.frames("execute").count == 1 }
    // No reply arrives. The watchdog reconnects with fresh credentials.
    try await eventually { calls.value == 2 }
    #expect(try await sending.value["error"]["code"].string == "unknown_outcome")
    second.deliver(["type": "welcome", "protocol": 3, "peers": []])
    try await eventually { second.frames("hello").count == 1 }
    var next = opening
    next["lease"]["id"] = .string("lease-two")
    next["snapshot"]["revision"] = .number(1)
    next["snapshot"]["data"]["count"] = .number(1)
    second.deliver(["type": "ready", "open": try next.jsonValue(), "peers": []])
    try await eventually { second.frames("execute").count == 1 }
    #expect(second.frames("execute").first?["request"] == request)
    second.deliver([
      "type": "result", "authority": request["authority"].string!,
      "leaseId": request["leaseId"].string!,
      "requestId": request["requestId"].string!, "result": ["ok": true, "revision": 1],
    ])
    try await eventually { session.status == .live }
    #expect(try await document.frame().data["count"] == .number(1))
    #expect(try await document.frame().writable)
    await session.stopAndWait()
    try await document.close()
    let reopened = try SlopCommandDocument(
      root: root, schema: schema, initial: .object(["count": .number(0)]))
    #expect(try await reopened.frame().data["count"] == .number(1))
    #expect(try await reopened.frame().writable == false)
    try await reopened.close()
  }
}

private final class TestCounter: @unchecked Sendable {
  private let lock = NSLock()
  private var count = 0
  var value: Int { lock.withLock { count } }
  func next() -> Int {
    lock.withLock {
      count += 1
      return count
    }
  }
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
  func deliver(_ value: [String: Any]) {
    continuation.yield(try! JSONSerialization.data(withJSONObject: value))
  }
  func frames(_ type: String) -> [FixtureJSON] {
    lock.withLock {
      sent.compactMap { try? FixtureJSON(data: $0) }.filter { $0["type"].string == type }
    }
  }
}
