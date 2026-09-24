import Foundation
import HitSlopCore
import SQLite3
import Testing
import WebKit

@testable import HitSlopWasm

@Suite(.serialized) struct WasmTests {
  @Test @MainActor func socketRejectsMalformedEnvelopesBeforeDispatch() async throws {
    var handled = false
    let server = try SocketServer { _, _, reply in
      handled = true
      reply(["ok": true, "epoch": "test"])
    }
    defer { server.stop() }
    let path = server.path
    for payload in [
      "not json", "{}",
      #"{"id":"x","method":"export","documentPath":"/tmp/a.slop","format":"pdf","output":"/tmp/a.pdf"}"#,
    ] {
      let data = try await Task.detached {
        try SocketClient.call(path: path, request: Data(payload.utf8))
      }.value
      let reply = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
      #expect(reply["ok"] as? Bool == false)
      #expect(reply["error"] as? String == "Invalid socket request")
    }
    #expect(!handled)
    await #expect(throws: (any Error).self) {
      _ = try await Task.detached {
        try SocketClient.call(path: path, request: Data(repeating: 65, count: 1_048_577))
      }.value
    }
    #expect(!handled)
  }
  @Test @MainActor func socketBoundsConcurrentClientsWithoutBlockingMainActor() async throws {
    var replies: [@MainActor @Sendable ([String: Any]) -> Void] = []
    let server = try SocketServer { _, _, reply in replies.append(reply) }
    defer { server.stop() }
    let path = server.path
    let request = Data(#"{"id":"x","method":"get","documentPath":"/tmp/a.slop"}"#.utf8)
    // The synchronous client must not occupy Swift's cooperative executor.
    func call() async throws -> Data {
      try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.global().async {
          continuation.resume(with: Result { try SocketClient.call(path: path, request: request) })
        }
      }
    }
    let tasks = (0..<16).map { _ in Task { try await call() } }
    for _ in 0..<200 where replies.count < 16 { try await Task.sleep(for: .milliseconds(10)) }
    #expect(replies.count == 16)
    await #expect(throws: (any Error).self) {
      _ = try await call()
    }
    for reply in replies { reply(["ok": true, "state": [:]]) }
    for task in tasks { _ = try await task.value }
  }

  @Test func writerExclusion() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString + ".slop")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let storage = try Storage(root: root)
    defer { storage.close() }
    #expect(throws: (any Error).self) { try Storage(root: root) }
  }
  @Test(arguments: ["rows", "bytes"])
  func storageRefusesOversizedLogWithoutMaterializingIt(limit: String) throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString + ".slop")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let storage = try Storage(root: root)
    storage.close()
    var db: OpaquePointer?
    #expect(
      sqlite3_open(root.appendingPathComponent("state/document.sqlite").path, &db) == SQLITE_OK)
    let sql =
      limit == "rows"
      ? "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<4097) INSERT INTO updates(bytes) SELECT x'01' FROM n"
      : "INSERT INTO updates(bytes) VALUES(zeroblob(17 * 1024 * 1024)),(zeroblob(17 * 1024 * 1024))"
    #expect(sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK)
    sqlite3_close_v2(db)
    let reopened = try Storage(root: root)
    defer { reopened.close() }
    #expect(throws: (any Error).self) { try reopened.call(["method": "load"]) }
  }

  @Test @MainActor func schemeRejectsSymlinkReplacedAfterOpen() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(
      at: root.appendingPathComponent("assets"), withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let asset = root.appendingPathComponent("assets/test.js")
    try Data("safe".utf8).write(to: asset)
    let handler = SchemeHandler(root: root, runtime: root)
    try FileManager.default.removeItem(at: asset)
    try FileManager.default.createSymbolicLink(
      at: asset, withDestinationURL: root.appendingPathComponent("initial.json"))
    try Data("secret".utf8).write(to: root.appendingPathComponent("initial.json"))
    let task = SchemeTask(URL(string: "slop://app/assets/test.js")!)
    handler.webView(WKWebView(), start: task)
    #expect(task.error != nil)
    #expect(task.data.isEmpty)
  }

}

private final class SchemeTask: NSObject, WKURLSchemeTask {
  let request: URLRequest
  var data = Data()
  var error: Error?
  init(_ url: URL) { request = URLRequest(url: url) }
  func didReceive(_ response: URLResponse) {}
  func didReceive(_ data: Data) { self.data.append(data) }
  func didFinish() {}
  func didFailWithError(_ error: Error) { self.error = error }
}
