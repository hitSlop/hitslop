import Foundation
import HitSlopAPI

/// The room owns delivery order; the document journal owns the outbox and replay cursor.
/// A reconnect always renews credentials and replays before sending local changes.
@MainActor public final class SlopRoomSession {
    public enum Status: Equatable, Sendable { case stopped, connecting, catchingUp, live, offline, paused }
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
    private let document: SlopLoroDocument
    private let connect: @Sendable (URLRequest) -> any SlopRoomSocket
    private let retryDelay: Duration
    private let acknowledgementTimeout: Duration
    private var socket: (any SlopRoomSocket)?
    private var loop: Task<Void, Never>?
    private var epoch = UUID()
    private var ready = false
    private var pumping = false
    private var pending: SlopLoroBatch?
    private var sentAt = ContinuousClock.now
    private var receivedAt = ContinuousClock.now

    public convenience init(origin: URL, documentId: String, schema: String, document: SlopLoroDocument,
                            credentials: @escaping @Sendable () async throws -> SlopRoomSessionToken) {
        self.init(origin: origin, documentId: documentId, schema: schema, document: document, credentials: credentials,
                  connect: { NativeRoomSocket(request: $0) })
    }

    init(origin: URL, documentId: String, schema: String, document: SlopLoroDocument,
         credentials: @escaping @Sendable () async throws -> SlopRoomSessionToken,
         connect: @escaping @Sendable (URLRequest) -> any SlopRoomSocket,
         retryDelay: Duration = .seconds(1), acknowledgementTimeout: Duration = .seconds(30)) {
        self.origin = origin; self.credentials = credentials; self.documentId = documentId; self.schema = schema
        self.document = document; self.connect = connect; self.retryDelay = retryDelay
        self.acknowledgementTimeout = acknowledgementTimeout
    }

    public func start() {
        stop()
        let generation = epoch
        loop = Task { [weak self] in await self?.run(generation) }
    }

    public func stop() {
        epoch = UUID()
        loop?.cancel(); loop = nil
        socket?.cancel(); socket = nil
        ready = false; pumping = false; pending = nil
        peers = []; onPeers?(peers); status = .stopped
    }

    public func stopAndWait() async {
        let pending = loop
        stop()
        await pending?.value
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
                guard token.documentId == documentId, token.schema == schema else { throw ProtocolFailure("Wrong room credentials") }
                var components = URLComponents(url: origin.appendingPathComponent("rooms/\(documentId)/socket"), resolvingAgainstBaseURL: false)!
                components.scheme = origin.scheme == "http" ? "ws" : "wss"
                var request = URLRequest(url: components.url!)
                request.setValue("Bearer \(token.token)", forHTTPHeaderField: "Authorization")
                let connection = connect(request)
                socket = connection; pending = nil; ready = false; pumping = false
                receivedAt = .now
                try await withThrowingTaskGroup(of: Void.self) { group in
                    group.addTask { try await self.listen(connection, generation) }
                    group.addTask {
                        for await _ in try await self.document.events() {
                            try Task.checkCancellation()
                            try await self.pump(connection, generation)
                        }
                    }
                    group.addTask { try await self.watchdog(connection, generation) }
                    do { try await group.next() }
                    catch { connection.cancel(); group.cancelAll(); throw error }
                    connection.cancel(); group.cancelAll()
                }
                try check(generation)
                throw URLError(.networkConnectionLost)
            } catch {
                guard !Task.isCancelled, generation == epoch else { return }
                socket?.cancel(); socket = nil; pending = nil; ready = false; pumping = false
                peers = []; onPeers?(peers); onError?(error.localizedDescription)
                if error is ProtocolFailure || (error as? SlopCloudError).map({ [401, 403, 404, 409, 429].contains($0.status) }) == true { status = .paused; return }
                if status == .live { attempt = 0 }
                status = .offline
                do { try await Task.sleep(for: retryDelay * (1 << min(attempt, 5))) } catch { return }
                attempt += 1
            }
        }
    }

    private func listen(_ connection: any SlopRoomSocket, _ generation: UUID) async throws {
        while true {
            let data = try await connection.receive()
            try check(generation)
            receivedAt = .now
            if data == Data("pong".utf8) { continue }
            do { try await handle(data, connection, generation) }
            catch is CancellationError { throw CancellationError() }
            catch let failure as ProtocolFailure { throw failure }
            catch let error as URLError { throw error }
            catch { throw ProtocolFailure(error.localizedDescription) }
        }
    }

    private func handle(_ data: Data, _ connection: any SlopRoomSocket, _ generation: UUID) async throws {
        let message = try JSONDecoder().decode(Components.Schemas.RoomServerMessage.self, from: data)
        switch message {
        case .welcome(let message):
            updatePeers(message.peers)
            guard message._protocol == ._1, status == .connecting else { throw ProtocolFailure("Unexpected room welcome") }
            status = .catchingUp
            let cursor = await document.deliveryCursor()
            try check(generation)
            try await send(.hello(.init(_type: .hello, _protocol: ._1, documentId: documentId, schema: schema, after: cursor, batchSize: 8)), connection)
        case .updates(let message):
            guard message.documentId == documentId, message.schema == schema,
                  !message.updates.isEmpty, message.updates.count <= 32 else { throw ProtocolFailure("Invalid replay window") }
            let updates = message.updates
            // Decode and validate the *received* hashes and envelope before importing anything.
            for update in updates { _ = try update.batch.decoded() }
            for update in updates {
                try await document.receiveBatch(update.batch, documentId: documentId, schema: schema, sequence: update.sequence)
                try check(generation)
            }
            try await send(.applied(.init(_type: .applied, sequence: updates.last!.sequence)), connection)
        case .ready(let message):
            updatePeers(message.peers)
            let cursor = await document.deliveryCursor()
            try check(generation)
            guard message.head == cursor else { throw ProtocolFailure("Replay has not reached the room head") }
            ready = true; status = .live
            try await pump(connection, generation)
        case .ack(let message):
            guard let batch = pending, message.id == batch.id, message.hash == batch.hash, (2...10000).contains(message.sequence) else { throw ProtocolFailure("Unexpected upload acknowledgement") }
            try await document.acknowledgeBatch(id: batch.id, hash: batch.hash, sequence: message.sequence)
            try check(generation)
            pending = nil
            try await pump(connection, generation)
        case .presence(let message): updatePeers(message.peers)
        case .error(let message):
            if message.status == 401 { throw URLError(.userAuthenticationRequired) }
            throw ProtocolFailure(message.message)
        }
    }

    private func pump(_ connection: any SlopRoomSocket, _ generation: UUID) async throws {
        try check(generation)
        guard ready, pending == nil, !pumping else { return }
        pumping = true
        defer { if generation == epoch { pumping = false } }
        repeat {
            let batch = try await document.nextBatch()
            try check(generation)
            guard let batch else { return }
            pending = batch; sentAt = .now
            try await send(.append(.init(_type: .append, _protocol: ._1, documentId: documentId, schema: schema, batch: batch)), connection)
            // An unusually fast ACK may have arrived while send suspended.
        } while pending == nil
    }

    private func watchdog(_ connection: any SlopRoomSocket, _ generation: UUID) async throws {
        while true {
            try await Task.sleep(for: min(.seconds(15), acknowledgementTimeout))
            try check(generation)
            if pending != nil, sentAt.duration(to: .now) >= acknowledgementTimeout { throw URLError(.timedOut) }
            if receivedAt.duration(to: .now) >= .seconds(60) { throw URLError(.timedOut) }
            // The DO auto-response handles this without waking a hibernated room.
            try await connection.send(Data("ping".utf8))
        }
    }

    private func updatePeers(_ peers: [Peer]) { self.peers = peers; onPeers?(peers) }

    private func send(_ value: Components.Schemas.RoomClientMessage, _ connection: any SlopRoomSocket) async throws {
        try await connection.send(JSONEncoder().encode(value))
    }
}

private struct ProtocolFailure: LocalizedError { let errorDescription: String?; init(_ message: String) { errorDescription = message } }

protocol SlopRoomSocket: Sendable {
    func receive() async throws -> Data
    func send(_ data: Data) async throws
    func cancel()
}
private struct NativeRoomSocket: SlopRoomSocket {
    let task: URLSessionWebSocketTask
    init(request: URLRequest) { task = URLSession.shared.webSocketTask(with: request); task.resume() }
    func receive() async throws -> Data {
        let message: URLSessionWebSocketTask.Message
        do { message = try await task.receive() }
        catch {
            if let response = task.response as? HTTPURLResponse, [403, 404, 409, 429].contains(response.statusCode) { throw ProtocolFailure("Room access unavailable (\(response.statusCode))") }
            throw error
        }
        switch message {
        case .string(let text): return Data(text.utf8)
        case .data(let data): return data
        @unknown default: throw URLError(.cannotParseResponse)
        }
    }
    func send(_ data: Data) async throws { try await task.send(.string(String(decoding: data, as: UTF8.self))) }
    func cancel() { task.cancel(with: .goingAway, reason: nil) }
}
