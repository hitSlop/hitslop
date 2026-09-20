import Darwin
import Foundation
import HitSlopCore

/// Native CLI transport. The document interpreter is always the bundled WASM runtime.
@MainActor public enum DocumentCommand {
  public static func run(
    method: String, url: URL, operation: Data? = nil, operations: Data? = nil,
    themeValues: Data? = nil, themeToken: String? = nil
  )
    async throws -> Data
  {
    let mutation = ["apply", "batch", "compact", "theme.set", "theme.reset"].contains(method)
    try SlopLocalDocument.requireLocal(url)
    let package = try SlopPackage(rootURL: url)
    let root = package.rootURL
    if method == "schema" {
      return try SlopFile.read(package.dataSchemaURL, within: root, maximumBytes: 1_048_576)
    }
    let masters = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(
      ".hitslop/templates"
    ).path
    guard !root.path.hasPrefix(masters + "/") else {
      throw failure("Create a writable copy of this template first")
    }
    var request: [String: Any] = [
      "id": UUID().uuidString, "method": method, "documentPath": root.path,
    ]
    if let themeValues { request["values"] = try JSONSerialization.jsonObject(with: themeValues) }
    if let themeToken { request["token"] = themeToken }
    if let operation { request["op"] = try JSONSerialization.jsonObject(with: operation) }
    if let operations { request["ops"] = try JSONSerialization.jsonObject(with: operations) }
    // Validate before acquiring ownership or creating any document state.
    var validation = request
    if mutation { validation["epoch"] = "new-session" }
    guard PlatformContract.valid(validation, against: socketRequestSchema) else {
      throw failure("Invalid document command")
    }
    var engine: WasmSession?
    var socket: String?
    do { engine = try WasmSession(package: package, headless: true) } catch {
      guard DocumentWriterLock.isBusy(error) else { throw error }
      socket = try liveSocket(for: root)
    }
    do {
      if let engine {
        engine.load()
        try await engine.waitUntilReady()
      }
      if mutation {
        do {
          let hello: [String: Any] = [
            "id": UUID().uuidString, "method": "hello", "documentPath": root.path,
          ]
          let opening = try await send(hello, engine: engine, socket: socket)
          guard opening["ok"] as? Bool == true, let current = opening["epoch"] as? String else {
            throw failure(opening["error"] as? String ?? "Cannot open session")
          }
          request["epoch"] = current
        }
      }
      let reply: [String: Any]
      do { reply = try await send(request, engine: engine, socket: socket) } catch {
        throw failure(error.localizedDescription + (mutation ? retryHint(request) : ""))
      }
      guard reply["ok"] as? Bool == true else {
        throw failure(
          (reply["error"] as? String ?? "Document operation failed")
            + (mutation ? retryHint(request) : ""))
      }
      guard let state = reply["state"] else { throw failure("Missing document state in response") }
      let data = try JSONSerialization.data(
        withJSONObject: state, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
      try await engine?.close()
      return data
    } catch {
      try? await engine?.close()
      throw error
    }
  }

  private static func retryHint(_ request: [String: Any]) -> String {
    "\nOutcome unknown. Run slop get before issuing another edit."
  }

  /// Discovery is consulted only after the caller observes a busy OS writer lock.
  public static func liveSocket(for root: URL) throws -> String {
    let url = root.appendingPathComponent("state/host.lock")
    do {
      let bytes = try SlopFile.read(url, within: root, maximumBytes: 16384)
      guard bytes.count <= 16384,
        let value = try JSONSerialization.jsonObject(with: bytes) as? [String: Any],
        PlatformContract.valid(value, against: socketDiscoverySchema),
        value["documentPath"] as? String == root.path,
        let socket = value["socket"] as? String
      else { throw failure("Invalid live session discovery") }
      return socket
    } catch {
      throw failure(
        "Writer is busy without a ready session; retry later. \(error.localizedDescription)")
    }
  }

  public static func exportLive(root: URL, socket: String, format: String, output: URL) async throws
  {
    let base: [String: Any] = [
      "id": UUID().uuidString, "documentPath": root.path, "method": "hello",
    ]
    let hello = try await send(base, engine: nil, socket: socket)
    guard hello["ok"] as? Bool == true, let epoch = hello["epoch"] as? String else {
      throw failure(hello["error"] as? String ?? "Cannot open session")
    }
    let request: [String: Any] = [
      "id": UUID().uuidString, "documentPath": root.path, "method": "export", "epoch": epoch,
      "format": format, "output": output.path,
    ]
    let reply: [String: Any]
    do { reply = try await send(request, engine: nil, socket: socket) } catch {
      throw failure(
        "Export outcome may be unknown; inspect the destination before retrying. \(error.localizedDescription)"
      )
    }
    guard reply["ok"] as? Bool == true, reply["output"] as? String == output.path else {
      throw failure(reply["error"] as? String ?? "Invalid export response")
    }
  }

  private static func send(_ request: [String: Any], engine: WasmSession?, socket: String?)
    async throws -> [String: Any]
  {
    guard PlatformContract.valid(request, against: socketRequestSchema) else {
      throw failure("Invalid socket request")
    }
    let object: [String: Any]
    if let engine {
      object = await engine.request(request)
    } else {
      guard let socket else { throw failure("Missing live session") }
      let bytes = try JSONSerialization.data(withJSONObject: request)
      let result: Data = try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.global(qos: .userInitiated).async {
          continuation.resume(with: Result { try SocketClient.call(path: socket, request: bytes) })
        }
      }
      guard let value = try JSONSerialization.jsonObject(with: result) as? [String: Any] else {
        throw failure("Invalid socket response")
      }
      object = value
    }
    guard PlatformContract.valid(object, against: socketReplySchema) else {
      throw failure("Invalid socket response")
    }
    return object
  }
}
enum SocketClient {
  static func call(path: String, request: Data) throws -> Data {
    guard request.count <= 1_048_576 else { throw failure("Oversized socket request") }
    let fd = socket(AF_UNIX, SOCK_STREAM, 0)
    guard fd >= 0 else { throw failure("Cannot create client socket") }
    defer { Darwin.close(fd) }
    _ = fcntl(fd, F_SETFD, FD_CLOEXEC)
    var timeout = timeval(tv_sec: 35, tv_usec: 0)
    var noPipe: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &noPipe, socklen_t(MemoryLayout<Int32>.size))
    var address = sockaddr_un()
    address.sun_family = sa_family_t(AF_UNIX)
    let chars = Array(path.utf8CString)
    guard chars.count <= MemoryLayout.size(ofValue: address.sun_path) else {
      throw failure("Socket path too long")
    }
    withUnsafeMutableBytes(of: &address.sun_path) {
      $0.copyBytes(from: chars.map { UInt8(bitPattern: $0) })
    }
    let connected = withUnsafePointer(to: &address) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
      }
    }
    guard connected == 0 else {
      throw failure("Live document unavailable; writer lock remains authoritative")
    }
    var payload = request
    payload.append(10)
    try payload.withUnsafeBytes { bytes in
      var offset = 0
      while offset < bytes.count {
        let n = Darwin.write(fd, bytes.baseAddress!.advanced(by: offset), bytes.count - offset)
        guard n > 0 else { throw failure("Socket write failed; outcome may be unknown") }
        offset += n
      }
    }
    var result = Data()
    var buffer = [UInt8](repeating: 0, count: 8192)
    while result.count <= 16 * 1024 * 1024 {
      let count = read(fd, &buffer, buffer.count)
      guard count > 0 else {
        throw failure("Host disconnected or timed out; outcome may be unknown")
      }
      result.append(contentsOf: buffer.prefix(count))
      if let end = result.firstIndex(of: 10) {
        guard end <= 16 * 1024 * 1024 else { throw failure("Oversized socket response") }
        return result.prefix(upTo: end)
      }
    }
    throw failure("Oversized socket response")
  }
}
