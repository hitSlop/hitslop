import Foundation
import Darwin

private struct SpikeRelayPaused: LocalizedError { let message: String; var errorDescription: String? { message } }

/// Test relay configuration lives outside the package. No credentials cross the UI bridge.
package struct SpikeRelayConfiguration: Codable, Sendable {
    package let endpoint: String
    package let token: String
}

/// Owns delivery only. The document actor owns merge state and durable replay progress.
@MainActor package final class SpikeConnection {
    private let document: SpikeDocument
    private let configuration: SpikeRelayConfiguration
    private var socket: URLSessionWebSocketTask?
    private var loop: Task<Void, Never>?
    private var events: Task<Void, Never>?
    private var epoch = UUID()
    private var lifecycle = UUID()
    private var ready = false
    private var uploading = false
    private var pending: (id: String, version: String, started: ContinuousClock.Instant)?
    private var lastUploaded: String?
    private var lastError: String?
    private var received = 0
    private var acknowledgements: [Double] = []
    private var bootIds = Set<String>()
    private var enabled = false
    private var paused = false
    private var fault: String?
    package func injectNetworkFault(_ point: String?) { fault = point }
    private func crashAt(_ point: String) { if fault == point { kill(getpid(), SIGKILL) } }

    package init(document: SpikeDocument, configuration: SpikeRelayConfiguration) {
        self.document = document; self.configuration = configuration
    }
    package func start() {
        guard !enabled else { return }; enabled = true; paused = false
        let lifecycle = UUID(); self.lifecycle = lifecycle
        events = Task { [weak self, document] in
            do {
                for await frame in try await document.events() {
                    guard !Task.isCancelled else { return }
                    if !frame.dirty { await self?.uploadIfNeeded() }
                }
            } catch { self?.lastError = error.localizedDescription }
        }
        loop = Task { [weak self] in
            while !Task.isCancelled {
                guard let self, self.enabled, self.lifecycle == lifecycle else { return }
                do { try await self.connectAndReceive() }
                catch {
                    if !Task.isCancelled && !self.paused { self.lastError = error.localizedDescription }
                    if error is SpikeRelayPaused { self.paused = true }
                }
                guard self.lifecycle == lifecycle else { return }
                self.ready = false; self.socket?.cancel(with: .goingAway, reason: nil); self.socket = nil
                if Task.isCancelled || !self.enabled || self.paused { return }
                do { try await Task.sleep(for: .seconds(1)) } catch { return }
            }
        }
    }
    package func stop() {
        enabled = false; lifecycle = UUID(); epoch = UUID(); loop?.cancel(); loop = nil; events?.cancel(); events = nil
        socket?.cancel(with: .goingAway, reason: nil); socket = nil; ready = false; pending = nil; uploading = false
    }
    package func status() -> SpikeJSON {
        .object(["enabled": .bool(enabled), "connected": .bool(socket != nil), "ready": .bool(ready),
                 "paused": .bool(paused), "pending": .bool(pending != nil), "error": lastError.map(SpikeJSON.string) ?? .null,
                 "received": .number(Double(received)), "acknowledgementMs": .array(acknowledgements.map(SpikeJSON.number)),
                 "bootIds": .array(bootIds.sorted().map(SpikeJSON.string))])
    }
    private func send(_ value: SpikeJSON, on socket: URLSessionWebSocketTask) async throws {
        try await socket.send(.string(String(decoding: value.encoded(), as: UTF8.self)))
    }
    private func connectAndReceive() async throws {
        let generation = UUID(); epoch = generation; pending = nil; lastUploaded = nil; uploading = false; ready = false
        let transfer = try await document.transfer()
        let incremental = document.transport == .incremental
        guard !Task.isCancelled, enabled, epoch == generation else { return }
        guard var components = URLComponents(string: configuration.endpoint), let host = components.host else { throw SpikeFailure("Invalid relay endpoint") }
        guard components.scheme == "https" || (components.scheme == "http" && ["127.0.0.1", "localhost"].contains(host)) else { throw SpikeFailure("Relay requires HTTPS") }
        components.scheme = components.scheme == "https" ? "wss" : "ws"
        components.path = "/rooms/\(transfer.documentId)/socket"
        guard let url = components.url else { throw SpikeFailure("Invalid relay endpoint") }
        var request = URLRequest(url: url); request.setValue("Bearer \(configuration.token)", forHTTPHeaderField: "Authorization")
        let task = URLSession.shared.webSocketTask(with: request); socket = task; task.resume()
        let cursor = await document.deliveryCursor()
        guard !Task.isCancelled, enabled, epoch == generation else { return }
        try await send(.object(["type": .string("hello"), "after": .number(Double(cursor)),
                               "protocol": .number(incremental ? 2 : 1), "schema": .string(transfer.schema), "documentId": .string(transfer.documentId)]), on: task)
        while !Task.isCancelled, epoch == generation {
            let incoming = try await task.receive()
            guard epoch == generation else { return }
            let bytes: Data
            switch incoming { case .string(let text): bytes = Data(text.utf8); case .data(let data): bytes = data; @unknown default: throw SpikeFailure("Unsupported relay frame") }
            guard bytes.count <= 1024 * 1024 else { throw SpikeFailure("Oversized relay frame") }
            let message = try SpikeJSON(data: bytes)
            if let boot = message["bootId"].string { bootIds.insert(boot) }
            switch message["type"].string {
            case "welcome": break
            case "update":
                guard incremental else { throw SpikeFailure("Unexpected incremental update") }
                ready = false
                guard let number = message["sequence"].number, number > 1, number.rounded() == number, number <= 10000,
                      let documentId = message["documentId"].string, let schema = message["schema"].string else { throw SpikeRelayPaused(message: "Invalid incremental delivery") }
                do {
                    let batch = try JSONDecoder().decode(SpikeBatch.self, from: message["batch"].encoded())
                    try await document.receiveBatch(batch, documentId: documentId, schema: schema, sequence: Int(number))
                } catch { throw SpikeRelayPaused(message: error.localizedDescription) }
                guard epoch == generation else { return }
                received += 1; crashAt("after-receive-commit")
                try await send(.object(["type": .string("applied"), "sequence": .number(number)]), on: task)
            case "snapshot":
                guard !incremental else { throw SpikeRelayPaused(message: "Incremental seed must be installed before replay") }
                ready = false
                guard let number = message["sequence"].number, number > 0, number.rounded() == number, number <= 10000,
                      let hash = message["hash"].string else { throw SpikeFailure("Invalid relay sequence") }
                let update = try JSONDecoder().decode(SpikeTransfer.self, from: message["snapshot"].encoded())
                try await document.receiveShared(update, sequence: Int(number), hash: hash)
                guard epoch == generation else { return }
                received += 1
                try await send(.object(["type": .string("applied"), "sequence": .number(number)]), on: task)
            case "ready":
                ready = true; lastError = nil; await uploadIfNeeded()
            case "ack":
                guard let pending, pending.id == message["id"].string else { throw SpikeFailure("Unknown upload acknowledgement") }
                let elapsed = ContinuousClock.now - pending.started
                acknowledgements.append(Double(elapsed.components.seconds) * 1000 + Double(elapsed.components.attoseconds) / 1e15)
                if incremental {
                    guard let number = message["sequence"].number, number > 1, number <= 10000, number.rounded() == number,
                          message["hash"].string == pending.version else { throw SpikeRelayPaused(message: "Invalid incremental acknowledgement") }
                    crashAt("after-server-ack")
                    try await document.acknowledgeBatch(id: pending.id, hash: pending.version, sequence: Int(number))
                    crashAt("after-outbox-commit")
                }
                lastUploaded = pending.version; self.pending = nil; lastError = nil; await uploadIfNeeded()
            case "error":
                if incremental { throw SpikeRelayPaused(message: message["message"].string ?? "Sharing paused") }
                throw SpikeFailure(message["message"].string ?? "Sharing paused")
            default: throw SpikeFailure("Unknown relay message")
            }
        }
    }
    private func uploadIfNeeded() async {
        guard enabled, !paused, ready, pending == nil, !uploading, let socket else { return }
        uploading = true; let generation = epoch
        defer { if epoch == generation { uploading = false } }
        do {
            if document.transport == .incremental {
                guard let batch = try await document.nextBatch(), epoch == generation, ready else { return }
                guard try batch.decoded().count <= 512 * 1024 else {
                    paused = true; lastError = "Incremental update exceeds 512 KiB; changes remain local"
                    socket.cancel(with: .goingAway, reason: nil); return
                }
                pending = (batch.id, batch.hash, .now); crashAt("before-send")
                let transfer = try await document.transfer()
                guard epoch == generation else { return }
                try await send(.object(["type": .string("append"), "protocol": .number(2),
                    "documentId": .string(transfer.documentId), "schema": .string(transfer.schema),
                    "batch": try SpikeJSON(data: JSONEncoder().encode(batch))]), on: socket)
                return
            }
            let transfer = try await document.transfer()
            guard epoch == generation, ready, transfer.version != lastUploaded else { return }
            let id = UUID().uuidString
            pending = (id, transfer.version, .now)
            try await send(.object(["type": .string("append"), "id": .string(id),
                                    "snapshot": try SpikeJSON(data: JSONEncoder().encode(transfer))]), on: socket)
        } catch {
            if epoch == generation { lastError = error.localizedDescription; socket.cancel(with: .goingAway, reason: nil) }
        }
    }
}
