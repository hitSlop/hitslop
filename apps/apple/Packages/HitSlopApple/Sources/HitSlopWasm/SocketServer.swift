import Darwin
import Foundation
import HitSlopCore

/// Bounded newline JSON, one request per connection, private per-user socket directory.
final class SocketServer: @unchecked Sendable {
  let path: String
  private var listener: Int32 = -1
  private let guardLock = NSLock()
  private var stopped = false
  private let handle: @MainActor @Sendable ([String: Any], NativeCommandDeadline, @escaping @MainActor @Sendable ([String: Any]) -> Void) -> Void
  init(handle: @escaping @MainActor @Sendable ([String: Any], NativeCommandDeadline, @escaping @MainActor @Sendable ([String: Any]) -> Void) -> Void) throws {
    self.handle = handle
    let dir = "/tmp/hitslop-v1-\(getuid())"
    if mkdir(dir, 0o700) != 0 && errno != EEXIST { throw failure("Cannot create socket directory") }
    var info = stat()
    guard lstat(dir, &info) == 0, info.st_uid == getuid(), (info.st_mode & S_IFMT) == S_IFDIR else {
      throw failure("Unsafe socket directory")
    }
    chmod(dir, 0o700)
    path = dir + "/" + UUID().uuidString + ".sock"
    listener = socket(AF_UNIX, SOCK_STREAM, 0)
    guard listener >= 0 else { throw failure("Cannot create socket") }
    var address = sockaddr_un()
    address.sun_family = sa_family_t(AF_UNIX)
    let bytes = Array(path.utf8CString)
    withUnsafeMutableBytes(of: &address.sun_path) { raw in
      raw.copyBytes(from: bytes.map { UInt8(bitPattern: $0) })
    }
    let result = withUnsafePointer(to: &address) { ptr in
      ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.bind(listener, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
      }
    }
    guard result == 0, listen(listener, 16) == 0 else {
      Darwin.close(listener)
      throw failure("Cannot bind socket")
    }
    chmod(path, 0o600)
    let fd = listener
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      while let self, !self.isStopped {
        let client = accept(fd, nil, nil)
        if client < 0 { break }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in self?.serve(client) }
      }
    }
  }
  private var isStopped: Bool {
    guardLock.lock()
    defer { guardLock.unlock() }
    return stopped
  }
  func stop() {
    guardLock.lock()
    defer { guardLock.unlock() }
    guard !stopped else { return }
    stopped = true
    shutdown(listener, SHUT_RDWR)
    Darwin.close(listener)
    unlink(path)
  }
  deinit { stop() }
  private func serve(_ fd: Int32) {
    defer { Darwin.close(fd) }
    var timeout = timeval(tv_sec: 10, tv_usec: 0)
    var noPipe: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &noPipe, socklen_t(MemoryLayout<Int32>.size))
    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 4096)
    while data.count <= 1_048_576 {
      let count = read(fd, &buffer, buffer.count)
      if count <= 0 { return }
      data.append(contentsOf: buffer.prefix(count))
      if let end = data.firstIndex(of: 10) {
        guard end <= 1_048_576 else { return }
        let requestData = Data(data.prefix(upTo:end))
        let semaphore = DispatchSemaphore(value:0)
        let response = SocketResponse()
        let deadline = NativeCommandDeadline()
        DispatchQueue.main.async { [weak self] in
          guard let self, !self.isStopped else { semaphore.signal();return }
          guard let request = try? JSONSerialization.jsonObject(with:requestData) as? [String:Any],
                PlatformContract.valid(request, against: socketRequestSchema) else {
            response.set(try? JSONSerialization.data(withJSONObject: ["ok": false, "error": "Invalid socket request"]))
            semaphore.signal(); return
          }
          self.handle(request, deadline) { reply in
            let valid = PlatformContract.valid(reply, against: socketReplySchema)
            var data = valid ? try? JSONSerialization.data(withJSONObject:reply) : nil
            if data == nil || data!.count > 16*1024*1024 {
              data = try? JSONSerialization.data(withJSONObject: ["ok": false, "error": "Invalid or oversized socket response", "retryable": true])
            }
            response.set(data)
            semaphore.signal()
          }
        }
        guard semaphore.wait(timeout:.now()+30) == .success, var reply = response.get() else { return }
        reply.append(10)
        reply.withUnsafeBytes { bytes in
          var offset = 0
          while offset < bytes.count {
            let count = Darwin.write(
              fd, bytes.baseAddress!.advanced(by: offset), bytes.count - offset)
            if count <= 0 { break }
            offset += count
          }
        }
        return
      }
    }
  }
}

private final class SocketResponse: @unchecked Sendable {
  private let lock = NSLock()
  private var data: Data?
  func set(_ data:Data?) { lock.lock();defer { lock.unlock() };self.data = data }
  func get() -> Data? { lock.lock();defer { lock.unlock() };return data }
}
