import Foundation
import HitSlopAPI
import HitSlopDocumentEngine

/// Online commands and full snapshots. Every reconnect resolves persisted attempts.
@MainActor public final class SlopRoomSession {
  public enum Status: Equatable, Sendable {
    case stopped, connecting, catchingUp, live, offline, paused
  }
  public private(set) var status: Status = .stopped { didSet { onStatus?(status) } }
  public private(set) var peers: [Peer] = []
  public var onStatus: ((Status) -> Void)?
  public var onPeers: (([Peer]) -> Void)?
  public var onError: ((String) -> Void)?
  public typealias Peer = Components.Schemas.RoomPeer
  private let origin: URL
  private let credentials: @Sendable () async throws -> SlopRoomSessionToken
  private let documentId: String
  private let schema: String
  private let media: SlopDocumentMediaTransport?
  private let document: SlopCommandDocument
  private let connect: @Sendable (URLRequest) -> any SlopRoomSocket
  private let retryDelay: Duration
  private let acknowledgementTimeout: Duration
  private var socket: (any SlopRoomSocket)?
  private var loop: Task<Void, Never>?
  private var bootstrap: Task<Void, Never>?
  private var epoch = UUID()
  private var ready = false
  private var bootstrapping = false
  private var buffered: StateSnapshot?
  private var receivedAt = ContinuousClock.now
  private struct Pending {
    let continuation: CheckedContinuation<StateResult, any Error>
    let sentAt: ContinuousClock.Instant
  }
  private var pending: [String: Pending] = [:]

  public convenience init(
    origin: URL, documentId: String, schema: String, document: SlopCommandDocument,
    credentials: @escaping @Sendable () async throws -> SlopRoomSessionToken,
    media: SlopDocumentMediaTransport? = nil
  ) {
    self.init(
      origin: origin, documentId: documentId, schema: schema, document: document,
      credentials: credentials, media: media,
      connect: { NativeRoomSocket(request: $0) })
  }
  init(
    origin: URL, documentId: String, schema: String, document: SlopCommandDocument,
    credentials: @escaping @Sendable () async throws -> SlopRoomSessionToken,
    media: SlopDocumentMediaTransport? = nil,
    connect: @escaping @Sendable (URLRequest) -> any SlopRoomSocket,
    retryDelay: Duration = .seconds(1), acknowledgementTimeout: Duration = .seconds(30)
  ) {
    self.origin = origin
    self.credentials = credentials
    self.documentId = documentId
    self.schema = schema
    self.document = document
    self.media = media
    self.connect = connect
    self.retryDelay = retryDelay
    self.acknowledgementTimeout = acknowledgementTimeout
  }
  public func start() {
    stop()
    let generation = epoch
    loop = Task { [weak self] in await self?.run(generation) }
  }
  public func stop() {
    let old = epoch
    epoch = UUID()
    loop?.cancel()
    loop = nil
    bootstrap?.cancel()
    bootstrap = nil
    socket?.cancel()
    socket = nil
    ready = false
    bootstrapping = false
    buffered = nil
    failPending(CancellationError())
    peers = []
    onPeers?(peers)
    status = .stopped
    Task { try? await document.disconnect(connectionId: old.uuidString) }
  }
  public func stopAndWait() async {
    let previous = loop
    let preparing = bootstrap
    let old = epoch
    stop()
    await previous?.value
    await preparing?.value
    try? await document.disconnect(connectionId: old.uuidString)
  }
  private func failPending(_ error: any Error) {
    let attempts = pending
    pending.removeAll()
    for attempt in attempts.values { attempt.continuation.resume(throwing: error) }
  }
  private func check(_ generation: UUID) throws {
    try Task.checkCancellation()
    guard generation == epoch else { throw CancellationError() }
  }
  private func run(_ generation: UUID) async {
    var attempt = 0
    while !Task.isCancelled, generation == epoch {
      do {
        status = .connecting
        let token = try await credentials()
        try check(generation)
        guard token.documentId == documentId, token.schema == schema else {
          throw ProtocolFailure("Wrong room credentials")
        }
        var components = URLComponents(
          url: origin.appendingPathComponent("rooms/\(documentId)/socket"),
          resolvingAgainstBaseURL: false)!
        components.scheme = origin.scheme == "http" ? "ws" : "wss"
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token.token)", forHTTPHeaderField: "Authorization")
        let connection = connect(request)
        socket = connection
        ready = false
        receivedAt = .now
        try await withThrowingTaskGroup(of: Void.self) { group in
          group.addTask { try await self.listen(connection, generation) }
          group.addTask { try await self.watchdog(connection, generation) }
          do { try await group.next() } catch {
            connection.cancel()
            group.cancelAll()
            throw error
          }
          connection.cancel()
          group.cancelAll()
        }
        try check(generation)
        throw URLError(.networkConnectionLost)
      } catch {
        guard !Task.isCancelled, generation == epoch else { return }
        socket?.cancel()
        socket = nil
        bootstrap?.cancel()
        bootstrap = nil
        ready = false
        bootstrapping = false
        buffered = nil
        failPending(error)
        try? await document.disconnect(connectionId: generation.uuidString)
        peers = []
        onPeers?(peers)
        onError?(error.localizedDescription)
        if error is ProtocolFailure
          || (error as? SlopCloudError).map({ [403, 404, 409, 429].contains($0.status) }) == true
        {
          status = .paused
          return
        }
        if status == .live { attempt = 0 }
        status = .offline
        do { try await Task.sleep(for: retryDelay * (1 << min(attempt, 5))) } catch { return }
        attempt += 1
      }
    }
  }
  private struct Message: Decodable {
    let type: String
    let `protocol`: Int?
    let peers: [Peer]?
    let open: StateOpening?
    let snapshot: StateSnapshot?
    let key: String?
    let result: StateResult?
    let status: Int?
    let message: String?
  }
  private func listen(_ connection: any SlopRoomSocket, _ generation: UUID) async throws {
    while true {
      let bytes = try await connection.receive()
      try check(generation)
      receivedAt = .now
      if bytes == Data("pong".utf8) { continue }
      guard bytes.count <= 2 * 1024 * 1024 else {
        throw ProtocolFailure("Room frame exceeds its limit")
      }
      let message: Message
      do { message = try document.engine.call("room", [try StateEngine.utf8(bytes)]) } catch {
        throw ProtocolFailure(error.localizedDescription)
      }
      switch message.type {
      case "welcome":
        guard message.protocol == slopRoomProtocolVersion else {
          throw ProtocolFailure("Unsupported room protocol")
        }
        guard status == .connecting else { throw ProtocolFailure("Unsupported room protocol") }
        status = .catchingUp
        try updatePeers(message.peers)
        struct Hello: Encodable {
          let type = "hello"
          let `protocol` = slopRoomProtocolVersion
          let documentId: String
          let schema: String
        }
        try await connection.send(
          JSONEncoder().encode(Hello(documentId: documentId, schema: schema)))
      case "ready":
        guard !ready else { throw ProtocolFailure("Repeated room handshake") }
        guard let open = message.open, open.snapshot.documentId == documentId,
          open.snapshot.schemaHash == schema
        else { throw ProtocolFailure("Invalid room opening") }
        ready = true
        bootstrapping = true
        try updatePeers(message.peers)
        // Keep receiving while connect resolves requests; waiting here would deadlock their replies.
        bootstrap = Task { [weak self] in
          guard let self else { return }
          do {
            try await document.connect(
              opening: open, connectionId: generation.uuidString, media: media
            ) {
              [weak self] request in
              guard let self else { throw CancellationError() }
              return try await self.execute(request, connection, generation)
            }
            try check(generation)
            if let buffered {
              try await document.receive(buffered)
              self.buffered = nil
            }
            try check(generation)
            bootstrapping = false
            status = .live
          } catch {
            guard generation == epoch else { return }
            onError?(error.localizedDescription)
            connection.cancel()
          }
        }
      case "snapshot":
        guard ready else { throw ProtocolFailure("Snapshot before handshake") }
        guard let snapshot = message.snapshot else { throw ProtocolFailure("Missing snapshot") }
        if bootstrapping {
          if buffered == nil || snapshot.revision > (buffered?.revision ?? -1) {
            buffered = snapshot
          }
        } else {
          try await document.receive(snapshot)
        }
      case "result":
        guard let key = message.key, let result = message.result,
          let attempt = pending.removeValue(forKey: key)
        else {
          throw ProtocolFailure("Uncorrelated command receipt")
        }
        attempt.continuation.resume(returning: result)
      case "presence": try updatePeers(message.peers)
      case "error":
        let status = message.status ?? 503
        if status == 401 { throw URLError(.userAuthenticationRequired) }
        if status >= 500 { throw URLError(.networkConnectionLost) }
        throw ProtocolFailure(message.message ?? "Room rejected the connection")
      default: throw ProtocolFailure("Unknown room message")
      }
    }
  }
  private func execute(_ request: String, _ connection: any SlopRoomSocket, _ generation: UUID)
    async throws
    -> StateResult
  {
    try check(generation)
    guard ready else { throw URLError(.notConnectedToInternet) }
    struct Outgoing: Decodable, Sendable {
      let key: String
      let json: String
    }
    let outgoing: Outgoing = try document.engine.call("executeMessage", [request])
    let key = outgoing.key
    let bytes = Data(outgoing.json.utf8)
    guard pending[key] == nil else { throw ProtocolFailure("Request is already in flight") }
    return try await withCheckedThrowingContinuation { continuation in
      pending[key] = Pending(continuation: continuation, sentAt: .now)
      Task {
        do {
          try await connection.send(bytes)
          try check(generation)
        } catch { pending.removeValue(forKey: key)?.continuation.resume(throwing: error) }
      }
    }
  }
  private func watchdog(_ connection: any SlopRoomSocket, _ generation: UUID) async throws {
    while true {
      try await Task.sleep(for: min(.seconds(15), acknowledgementTimeout))
      try check(generation)
      if pending.values.contains(where: { $0.sentAt.duration(to: .now) >= acknowledgementTimeout })
        || receivedAt.duration(to: .now) >= .seconds(60)
      {
        throw URLError(.timedOut)
      }
      try await connection.send(Data("ping".utf8))
    }
  }
  private func updatePeers(_ value: [Peer]?) throws {
    guard let value, value.count <= 20 else { throw ProtocolFailure("Invalid room presence") }
    peers = value
    onPeers?(peers)
  }
}

private struct ProtocolFailure: LocalizedError {
  let errorDescription: String?
  init(_ message: String) { errorDescription = message }
}

protocol SlopRoomSocket: Sendable {
  func receive() async throws -> Data
  func send(_ data: Data) async throws
  func cancel()
}
private struct NativeRoomSocket: SlopRoomSocket {
  let task: URLSessionWebSocketTask
  init(request: URLRequest) {
    task = URLSession.shared.webSocketTask(with: request)
    task.resume()
  }
  func receive() async throws -> Data {
    let message: URLSessionWebSocketTask.Message
    do { message = try await task.receive() } catch {
      if let response = task.response as? HTTPURLResponse,
        [403, 404, 409, 429].contains(response.statusCode)
      {
        throw ProtocolFailure("Room access unavailable (\(response.statusCode))")
      }
      throw error
    }
    switch message {
    case .string(let text): return Data(text.utf8)
    case .data(let data): return data
    @unknown default: throw URLError(.cannotParseResponse)
    }
  }
  func send(_ data: Data) async throws { try await task.send(.string(try StateEngine.utf8(data))) }
  func cancel() { task.cancel(with: .goingAway, reason: nil) }
}
