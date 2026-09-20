import Testing
import Foundation
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
    for payload in ["not json", "{}", #"{"id":"x","method":"export","documentPath":"/tmp/a.slop","format":"pdf","output":"/tmp/a.pdf"}"#] {
      let data = try await Task.detached { try SocketClient.call(path: path, request: Data(payload.utf8)) }.value
      let reply = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
      #expect(reply["ok"] as? Bool == false)
      #expect(reply["error"] as? String == "Invalid socket request")
    }
    #expect(!handled)
    await #expect(throws: (any Error).self) {
      _ = try await Task.detached { try SocketClient.call(path: path, request: Data(repeating: 65, count: 1_048_577)) }.value
    }
    #expect(!handled)
  }
  @Test func writerExclusion() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
    defer { try? FileManager.default.removeItem(at:root) }
    let storage = try Storage(root:root)
    defer { storage.close() }
    #expect(throws:(any Error).self) { try Storage(root:root) }
  }
}
