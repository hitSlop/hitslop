import Foundation
import HitSlopSQLiteArchive

/// Test credentials remain in the native host. One socket per open document,
/// independent of how many local query stores the renderer observes.
public actor CollectionsConnection {
    private let document: CollectionsDocument
    private let endpoint: URL
    private let credential: String
    private var socket: URLSessionWebSocketTask?
    private var ready = false
    private var sending = false
    private var sent: [[String: Any]] = []
    public private(set) var status = "offline"
    public init(document: CollectionsDocument, endpoint: URL, credential: String) { self.document = document; self.endpoint = endpoint; self.credential = credential }
    private func request(_ value: [String: Any]) async throws -> Any {
        let input = try JSONSerialization.data(withJSONObject: value)
        let output = try await document.request(input)
        return try JSONSerialization.jsonObject(with: output, options: [.fragmentsAllowed])
    }
    private func pump() async throws {
        guard ready, !sending else { return }; sending = true
        do {
            let batches = try await request(["method": "outbox"]) as! [[String: Any]]
            if batches.isEmpty { sending = false; return }
            sent = batches
            // Relay accepts JSON text frames only.
            let value: [String: Any] = ["type": "appendMany", "protocol": 2, "documentId": document.identity, "schema": document.fingerprint, "batches": batches]
            try await socket!.send(.string(String(decoding: JSONSerialization.data(withJSONObject: value), as: UTF8.self)))
        } catch { sending = false; throw error }
    }
    private func sendText(_ value: [String: Any]) async throws {
        guard let socket else { throw SQLiteFailure("Not connected") }
        try await socket.send(.string(String(decoding: JSONSerialization.data(withJSONObject: value), as: UTF8.self)))
    }
    public func run() async {
        while !Task.isCancelled {
            do { try await session() }
            catch { status = error.localizedDescription }
            socket?.cancel(with: .goingAway, reason: nil); socket = nil; ready = false; sending = false
            if Task.isCancelled { break }
            try? await Task.sleep(for: .seconds(1))
        }
    }
    private func session() async throws {
        var url = URLComponents(url: endpoint.appendingPathComponent("rooms/\(document.identity)/socket"), resolvingAgainstBaseURL: false)!
        url.scheme = url.scheme == "https" ? "wss" : "ws"
        var req = URLRequest(url: url.url!); req.setValue("Bearer \(credential)", forHTTPHeaderField: "Authorization")
        let session = URLSession(configuration: .ephemeral), task = session.webSocketTask(with: req)
        socket = task; task.resume(); status = "connecting"
        let observer = Task { for await _ in await document.changes() { do { try await pump() } catch { task.cancel(with: .goingAway, reason: nil) } } }
        defer { observer.cancel(); session.invalidateAndCancel() }
        try await withTaskCancellationHandler {
            while !Task.isCancelled {
                let frame = try await task.receive(), bytes: Data
                switch frame { case .string(let s): bytes = Data(s.utf8); case .data(let d): bytes = d; @unknown default: throw SQLiteFailure("Unsupported frame") }
                let value = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
                switch value["type"] as? String {
                case "welcome":
                    let cursor = try await request(["method": "cursor"])
                    try await sendText(["type": "hello", "protocol": 2, "documentId": document.identity, "schema": document.fingerprint, "after": cursor, "batchSize": 32])
                case "updates":
                    guard let updates = value["updates"] as? [[String: Any]], let last = updates.last, let sequence = last["sequence"] else { throw SQLiteFailure("Invalid replay") }
                    _ = try await request(["method": "receive", "documentId": value["documentId"] ?? "", "schema": value["schema"] ?? "", "updates": updates])
                    try await sendText(["type": "applied", "sequence": sequence])
                case "ready": ready = true; status = "connected"; try await pump()
                case "acks":
                    guard let acks = value["acks"] as? [[String: Any]], acks.count == sent.count, !acks.isEmpty else { throw SQLiteFailure("Unexpected acknowledgements") }
                    for (ack, batch) in zip(acks, sent) { guard ack["id"] as? String == batch["id"] as? String, ack["hash"] as? String == batch["hash"] as? String, let sequence = ack["sequence"] as? Int, sequence >= 2 else { throw SQLiteFailure("Invalid acknowledgement") } }
                    _ = try await request(["method": "ack", "acks": acks]); sent = []; sending = false; try await pump()
                case "error": throw SQLiteFailure(value["message"] as? String ?? "Relay error")
                default: throw SQLiteFailure("Unsupported relay frame")
                }
            }
        } onCancel: { task.cancel(with: .goingAway, reason: nil) }
    }
}
