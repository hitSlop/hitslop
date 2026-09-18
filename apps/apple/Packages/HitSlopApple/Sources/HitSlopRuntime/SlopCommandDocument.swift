import CryptoKit
import Darwin
import Foundation
import HitSlopCore
@_exported import HitSlopDocumentEngine

public enum SlopDocumentMode: String, Codable, Sendable { case local, promoting, shared }

public struct SlopCommandFrame: Equatable, Sendable {
  public var snapshot: StateSnapshot
  public var connected: Bool
  public var writable: Bool
  public var error: String?
  public var projectionError: String?
  public var proposalPath: String?
  public var handoffFrom: String?
  public var lease: StateLease?
  public var wireJSON = ""
  public var data: String { snapshot.data }
  public func json() throws -> String {
    struct Status: Encodable {
      let connected: Bool, writable: Bool
      let error: String?, projectionError: String?
    }
    let status = Status(
      connected: connected, writable: writable,
      error: error == nil ? nil : "Document changes need attention in hitSlop",
      projectionError: projectionError == nil ? nil : "Document file needs attention in hitSlop")
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    let header = String(decoding: try encoder.encode(status), as: UTF8.self).dropLast()
    let handoff = handoffFrom.map { ",\"handoffFrom\":\($0)" } ?? ""
    let leaseJSON = lease.map { ",\"lease\":\($0.json)" } ?? ""
    return "\(header)\(handoff)\(leaseJSON),\"snapshot\":\(snapshot.json)}"
  }
}

/// One serial owner per view. SQLite remains the cross-process commit boundary.
public actor SlopCommandDocument {
  public typealias Sender = @Sendable (String) async throws -> StateResult
  private let root: URL
  private let storage: SlopCommandStorage
  public nonisolated let engine: StateEngine
  private let schema: String
  private var record: SlopCommandStorage.Record
  private var sender: Sender?
  private var mediaTransport: SlopDocumentMediaTransport?
  private var sharedOpening: StateOpening?
  private var closed = false
  var databaseIsClosed: Bool { storage.isClosed }
  private var error: String?
  private var projectionError: String?
  private var projectionTask: Task<Void, Never>?
  private var projectionStarted: ContinuousClock.Instant?
  private var projectionEpoch = 0
  private var published: SlopCommandFrame?
  private var listeners: [UUID: AsyncStream<SlopCommandFrame>.Continuation] = [:]
  private var handoffFrom: String?
  private var activeSharedRequests = 0
  private var connectionId: String?
  public var mode: SlopDocumentMode {
    record.metadata.mode
  }
  public nonisolated static func digest(_ bytes: Data) -> String {
    SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
  }

  public init(
    root: URL, schema source: String, initial: String, schemaFingerprint: String? = nil,
    sharedSeed: StateSnapshot? = nil
  ) throws {
    try SlopLocalDocument.requireLocal(root)
    self.root = root.standardizedFileURL.resolvingSymlinksInPath()
    let engine = try StateEngine()
    try engine.configure(source)
    self.engine = engine
    self.schema = source
    let fingerprint = schemaFingerprint ?? Self.digest(Data(source.utf8))
    storage = try SlopCommandStorage(root: self.root, engine: engine)
    if try storage.load() == nil {
      guard
        !FileManager.default.fileExists(
          atPath: root.appendingPathComponent("stores/data.json").path)
      else {
        throw SlopDocumentError(
          "JSON exists without its command database; preserve it and create a new document explicitly"
        )
      }
      let snapshot: StateSnapshot =
        try sharedSeed
        ?? engine.call("initial", [initial, UUID().uuidString, fingerprint, UUID().uuidString])
      guard snapshot.schemaHash == fingerprint else {
        throw SlopDocumentError("Shared schema mismatch")
      }
      let _: StateSnapshot = try engine.call("snapshot", [snapshot.json])
      try storage.initialize(
        snapshot: snapshot,
        metadata: .init(mode: sharedSeed == nil ? .local : .shared, pendingProjection: true))
    }
    guard let loaded = try storage.load(), loaded.snapshot.schemaHash == fingerprint else {
      throw SlopDocumentError("Document schema changed")
    }
    let _: StateSnapshot = try engine.call("snapshot", [loaded.snapshot.json])
    record = loaded
  }
  public static func open(package: SlopPackage, seed: StateSnapshot? = nil) throws
    -> SlopCommandDocument?
  {
    guard FileManager.default.fileExists(atPath: package.dataSchemaURL.path) else { return nil }
    let bytes = try SlopFile.read(package.dataSchemaURL, within: package.rootURL)
    let schema: String = try StateEngine.utility(.applicationSchema, [try StateEngine.utf8(bytes)])
    let initial = try StateEngine.utf8(
      SlopFile.read(
        package.initialURL, within: package.rootURL, maximumBytes: SlopJSONLimits.documentBytes))
    return try Self(
      root: package.rootURL, schema: schema, initial: initial, schemaFingerprint: digest(bytes),
      sharedSeed: seed)
  }
  private func requireOpen() throws { if closed { throw SlopDocumentError("Document is closed") } }
  private func reload() throws {
    guard let next = try storage.load(), next.snapshot.documentId == record.snapshot.documentId,
      next.snapshot.schemaHash == record.snapshot.schemaHash
    else { throw SlopDocumentError("Document identity changed") }
    if next.snapshot.authority != record.snapshot.authority {
      handoffFrom = record.snapshot.authority
    }
    record = next
  }
  private func metadata(_ update: (inout SlopCommandStorage.Metadata) throws -> Void) throws {
    try requireOpen()
    record = try storage.transaction {
      guard var next = try storage.load() else {
        throw SlopDocumentError("Document is not initialized")
      }
      try update(&next.metadata)
      try storage.saveMetadata(next.metadata)
      return next
    }
  }
  public func benchmarkMeasurements() throws -> [String: Double] { try storage.benchmarkMeasurements() }
  public func frame() throws -> SlopCommandFrame {
    try requireOpen()
    var frame = SlopCommandFrame(
      snapshot: record.snapshot, connected: mode == .local || sender != nil,
      writable: mode == .local
        || (mode == .shared && sender != nil && sharedOpening != nil
          && record.metadata.outstanding.isEmpty),
      error: error,
      projectionError: projectionError, proposalPath: record.metadata.proposalPath,
      handoffFrom: handoffFrom,
      lease: mode == .local
        ? nil : (try sharedOpening?.lease ?? StateLease(id: "disconnected", expiresAt: 0)))
    frame.wireJSON = try frame.json()
    return frame
  }
  private func publish() throws {
    let frame = try frame()
    guard frame != published else { return }
    published = frame
    for listener in listeners.values { listener.yield(frame) }
  }
  public func events() throws -> AsyncStream<SlopCommandFrame> {
    let id = UUID()
    let initial = try frame()
    return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
      listeners[id] = continuation
      continuation.yield(initial)
      continuation.onTermination = { [weak self] _ in Task { await self?.removeListener(id) } }
    }
  }
  private func removeListener(_ id: UUID) { listeners.removeValue(forKey: id) }
  public func openGuest() async throws -> StateOpening {
    try await refreshExternal()
    let open: StateOpening
    if mode == .local {
      open = try storage.open()
    } else {
      open = StateOpening(
        snapshot: record.snapshot,
        lease: try sharedOpening?.lease ?? StateLease(id: "disconnected", expiresAt: 0))
    }
    let frame = try frame()
    return StateOpening(
      snapshot: open.snapshot, lease: open.lease, connected: frame.connected,
      writable: frame.writable)
  }
  public func apply(_ request: String) async throws -> StateResult {
    try requireOpen()
    try reload()
    if mode == .local {
      let outcome = try storage.apply(request)
      record = .init(snapshot: outcome.snapshot, metadata: outcome.metadata)
      error = outcome.result.error?.message
      try publish()
      scheduleProjection()
      return outcome.result
    }
    guard mode == .shared, let sender, sharedOpening != nil else {
      return Self.failure("offline", "Reconnect before editing this shared document")
    }
    let inspected: StateRequest
    do { inspected = try engine.call("request", [request]) } catch {
      return .failure("invalid_request", error.localizedDescription)
    }
    let key = Self.digest(Data(inspected.canonical.utf8))
    if !record.metadata.outstanding.isEmpty && record.metadata.outstanding[key] == nil {
      return Self.failure("unknown_outcome", "Resolve the outstanding request before another edit")
    }
    guard inspected.documentId == record.snapshot.documentId,
      inspected.schemaHash == record.snapshot.schemaHash,
      inspected.authority == record.snapshot.authority
    else {
      return Self.failure("authority_changed", "Reopen the current document authority")
    }
    activeSharedRequests += 1
    defer { activeSharedRequests -= 1 }
    if record.metadata.outstanding[key] == nil {
      let hashes = Set(try engine.call("introduced", [request], as: [String].self))
      if !hashes.isEmpty {
        let connection = connectionId
        let authority = record.snapshot.authority
        do {
          guard let mediaTransport else { throw SlopDocumentError("Media transfer is unavailable") }
          try await mediaTransport.prepare(hashes)
          try requireOpen()
          try reload()
          guard connectionId == connection, mode == .shared, record.snapshot.authority == authority,
            self.sender != nil
          else {
            return Self.failure(
              "authority_changed", "Connection changed while preparing media; retry the edit")
          }
          guard record.metadata.outstanding.isEmpty else {
            return Self.failure(
              "unknown_outcome", "Resolve the outstanding request before another edit")
          }
        } catch {
          self.error = error.localizedDescription
          try? publish()
          return Self.failure(
            "storage_unavailable", "Attachment upload failed; the document was not changed")
        }
      }
    }
    try metadata { meta in meta.outstanding[key] = request }
    do {
      let result = try await sender(request)
      try requireOpen()
      if result.error?.code != "unknown_outcome" && result.error?.code != "offline" {
        try metadata { meta in
          meta.outstanding.removeValue(forKey: key)
        }
      }
      error = result.error?.message
      try publish()
      return result
    } catch {
      self.error = "The last command has an unknown outcome. Reconnect to resolve it."
      try? publish()
      return Self.failure(
        "unknown_outcome", "The request is durable locally; reconnect to resolve its outcome")
    }
  }
  private static func failure(_ code: String, _ message: String) -> StateResult {
    .failure(code, message)
  }

  public func connect(
    opening: StateOpening, connectionId: String = UUID().uuidString,
    media: SlopDocumentMediaTransport? = nil, sender: @escaping Sender
  )
    async throws
  {
    try Task.checkCancellation()
    try requireOpen()
    try reload()
    guard mode == .shared || mode == .promoting else {
      throw SlopDocumentError("Document has no shared authority")
    }
    let expected = mode == .promoting ? record.metadata.promotion! : record.snapshot
    let incoming = opening.snapshot
    let _: StateSnapshot = try engine.call("snapshot", [incoming.json])
    guard incoming.documentId == expected.documentId, incoming.schemaHash == expected.schemaHash,
      incoming.authority == expected.authority
    else { throw SlopDocumentError("Room authority mismatch") }
    if mode == .promoting {
      let previous = record.snapshot.authority
      record = try storage.transaction {
        guard var next = try storage.load(), next.metadata.mode == .promoting,
          next.metadata.promotion?.authority == incoming.authority
        else { throw SlopDocumentError("Promotion changed") }
        next.snapshot = incoming
        next.metadata.mode = .shared
        next.metadata.pendingProjection = true
        next.metadata.promotion = nil
        try storage.save(next)
        return next
      }
      handoffFrom = previous
    } else {
      try receive(incoming)
    }
    self.sender = sender
    self.mediaTransport = media
    sharedOpening = opening
    self.connectionId = connectionId
    // These were sent while connected. Resolving them is not an offline editing queue.
    for request in record.metadata.outstanding.values {
      try Task.checkCancellation()
      guard self.connectionId == connectionId else { throw CancellationError() }
      let result = try await apply(request)
      try Task.checkCancellation()
      if result.error?.code == "unknown_outcome" || result.error?.code == "offline" {
        break
      }
    }
    try publish()
    scheduleProjection()
  }
  public func disconnect(connectionId: String? = nil) throws {
    if let connectionId, self.connectionId != connectionId { return }
    sender = nil
    mediaTransport = nil
    sharedOpening = nil
    self.connectionId = nil
    try publish()
  }
  public func loadMedia(_ hash: String) async throws {
    try requireOpen()
    guard SlopMediaStore.isValidHash(hash) else { throw SlopDocumentError("Invalid media digest") }
    if mode == .shared { try await mediaTransport?.load(hash) }
  }
  public func receive(_ snapshot: StateSnapshot) throws {
    try requireOpen()
    record = try storage.transaction {
      guard var next = try storage.load(), next.metadata.mode == .shared,
        snapshot.documentId == next.snapshot.documentId,
        snapshot.schemaHash == next.snapshot.schemaHash,
        snapshot.authority == next.snapshot.authority
      else { throw SlopDocumentError("Foreign room snapshot") }
      guard snapshot.revision > next.snapshot.revision else { return next }
      let _: StateSnapshot = try engine.call("snapshot", [snapshot.json])
      next.snapshot = snapshot
      next.metadata.pendingProjection = true
      try storage.save(next)
      return next
    }
    try publish()
    scheduleProjection()
  }
  public func prepareSharing() async throws -> StateSnapshot {
    try await flush()
    guard activeSharedRequests == 0, record.metadata.outstanding.isEmpty else {
      throw SlopDocumentError("Resolve outstanding commands before sharing")
    }
    if mode == .promoting { return record.metadata.promotion! }
    guard mode == .local else { throw SlopDocumentError("Document is already shared") }
    record = try storage.transaction {
      guard var next = try storage.load(), next.metadata.mode == .local else {
        throw SlopDocumentError("Document authority changed")
      }
      let seed: StateSnapshot = try engine.call("promote", [next.snapshot.json, UUID().uuidString])
      next.metadata.mode = .promoting
      next.metadata.promotion = seed
      try storage.saveMetadata(next.metadata)
      return next
    }
    let seed = record.metadata.promotion!
    try publish()
    return seed
  }
  public func identity() -> (documentId: String, schema: String) {
    (record.snapshot.documentId, record.snapshot.schemaHash)
  }
  public func sharingSeed() -> StateSnapshot? { record.metadata.promotion }

  private func externalBytes() throws -> Data? {
    let url = root.appendingPathComponent("stores/data.json")
    return FileManager.default.fileExists(atPath: url.path)
      ? try SlopFile.read(url, within: root) : nil
  }
  private func preserve(_ bytes: Data, hash: String, reason: String) throws {
    try requireOpen()
    let directory = root.appendingPathComponent("state/proposals", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let url = directory.appendingPathComponent(hash + ".json")
    try Self.durableWrite(bytes, to: url)
    try metadata { meta in
      meta.proposalHash = hash
      meta.proposalPath = url.path
      meta.proposalReason = reason
    }
    projectionError = reason
  }
  private func importExternal() async throws {
    guard let bytes = try externalBytes() else { return }
    let hash = Self.digest(bytes)
    if record.metadata.materializedHash == hash { return }
    if bytes == (try projection(record.snapshot)) {
      try metadata { $0.materializedHash = hash }
      return
    }
    if record.metadata.proposalHash == hash {
      projectionError = record.metadata.proposalReason
      return
    }
    do {
      var opening = record.metadata.externalOpening
      if opening?.authority != record.snapshot.authority
        || (opening?.lease.expiresAt ?? 0) <= Int(Date().timeIntervalSince1970 * 1000)
      {
        let opened: StateOpening
        if mode == .local {
          opened = try storage.open()
        } else if let sharedOpening {
          opened = sharedOpening
        } else {
          throw SlopDocumentError("Reconnect before applying an external shared edit")
        }
        opening = .init(authority: record.snapshot.authority, lease: opened.lease)
        try metadata { $0.externalOpening = opening }
      }
      let request: String = try engine.call(
        "external",
        [try StateEngine.utf8(bytes), record.snapshot.json, opening!.lease.json, "file:" + hash])
      let result = try await apply(request)
      guard result.ok else {
        throw SlopDocumentError(result.error?.message ?? "External edit was rejected")
      }
      try metadata { meta in
        meta.materializedHash = hash
        meta.proposalHash = nil
        meta.proposalPath = nil
        meta.proposalReason = nil
      }
      projectionError = nil
    } catch { try preserve(bytes, hash: hash, reason: error.localizedDescription) }
  }
  private func projection(_ snapshot: StateSnapshot) throws -> Data {
    struct Header: Encodable {
      let format = 2
      let documentId: String, schemaHash: String
      let baseRevision: Int
    }
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    let header = String(
      decoding: try encoder.encode(
        Header(
          documentId: snapshot.documentId, schemaHash: snapshot.schemaHash,
          baseRevision: snapshot.revision)), as: UTF8.self
    ).dropLast()
    return Data(
      "{\"$slop\":\(header),\"authority\":\(snapshot.authority)},\"data\":\(snapshot.data)}".utf8)
  }
  private func materialize() throws {
    record = try storage.transaction {
      guard var next = try storage.load() else {
        throw SlopDocumentError("Document is not initialized")
      }
      if next.metadata.proposalHash != nil { return next }
      let external = try externalBytes()
      let bytes = try projection(next.snapshot)
      if external != nil && external != bytes
        && external.map(Self.digest) != next.metadata.materializedHash
      {
        throw SlopDocumentError("External JSON changed; preserve it before projecting")
      }
      if external != bytes {
        try Self.durableWrite(bytes, to: root.appendingPathComponent("stores/data.json"))
      }
      next.metadata.materializedHash = Self.digest(bytes)
      next.metadata.pendingProjection = false
      try storage.saveMetadata(next.metadata)
      return next
    }
  }
  private static func durableWrite(_ bytes: Data, to url: URL) throws {
    let directory = url.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let info = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
    guard info.isDirectory == true, info.isSymbolicLink != true else {
      throw SlopDocumentError("Unsafe document directory")
    }
    try bytes.write(to: url, options: .atomic)
    let handle = try FileHandle(forWritingTo: url)
    try handle.synchronize()
    try handle.close()
    let descriptor = Darwin.open(directory.path, O_RDONLY)
    guard descriptor >= 0 else { throw POSIXError(.EIO) }
    defer { Darwin.close(descriptor) }
    guard fsync(descriptor) == 0 else { throw POSIXError(.EIO) }
  }
  private func cancelProjection() {
    projectionTask?.cancel()
    projectionTask = nil
    projectionStarted = nil
    projectionEpoch += 1
  }
  private func scheduleProjection() {
    guard !closed, record.metadata.pendingProjection,
      record.metadata.proposalHash == nil
    else { return }
    let now = ContinuousClock.now
    projectionStarted = projectionStarted ?? now
    let deadline = min(
      now.advanced(by: .milliseconds(250)), projectionStarted!.advanced(by: .seconds(2)))
    projectionTask?.cancel()
    projectionEpoch += 1
    let epoch = projectionEpoch
    projectionTask = Task { [weak self] in
      do { try await Task.sleep(until: deadline, clock: .continuous) } catch { return }
      await self?.finishProjection(epoch)
    }
  }
  private func finishProjection(_ epoch: Int) async {
    guard epoch == projectionEpoch, !closed else { return }
    do { try await flush() } catch {
      projectionError = error.localizedDescription
      try? publish()
    }
  }
  public func refreshExternal() async throws {
    try requireOpen()
    try reload()
    try await importExternal()
    try publish()
    scheduleProjection()
  }
  public func flush() async throws {
    try requireOpen()
    cancelProjection()
    try reload()
    try await importExternal()
    do {
      try materialize()
      if record.metadata.proposalHash == nil { projectionError = nil }
      try publish()
    } catch {
      projectionError = error.localizedDescription
      try? publish()
      throw error
    }
  }
  public func discardExternalProposal() async throws {
    try requireOpen()
    try reload()
    guard let bytes = try externalBytes(), Self.digest(bytes) == record.metadata.proposalHash else {
      try await refreshExternal()
      return
    }
    // Preserved proposal remains in state/proposals; authorize overwriting only these exact bytes.
    try metadata { meta in
      meta.materializedHash = meta.proposalHash
      meta.proposalHash = nil
      meta.proposalPath = nil
      meta.proposalReason = nil
    }
    try await flush()
  }
  public func close() async throws {
    if closed { try await shutDownAndWait(); return }
    try await flush()
    guard activeSharedRequests == 0 else {
      throw SlopDocumentError("Wait for the outstanding command before closing")
    }
    // Unknown shared attempts are already durable and will be resolved on reopen.
    try await shutDownAndWait()
  }
  public func start() async throws { try await flush() }
  func guestRequest(_ method: SlopBridgeMethod, requestJSON: String?, lease: SlopRequestLease)
    async throws -> String
  {
    try lease.check()
    switch method {
    case .documentOpen: return try await openGuest().json
    case .documentExecute:
      guard let requestJSON else { throw SlopBridgeFailure(.invalidRequest, "Missing command") }
      return try await apply(requestJSON).json
    case .documentFlush:
      try await flush()
      return "null"
    default: throw SlopBridgeFailure(.invalidRequest, "Not a document method")
    }
  }
  public func sharingBundle(_ bytes: Data) throws -> Data {
    try requireOpen()
    let url = root.appendingPathComponent("state/share-bootstrap.zip")
    if (try? FileManager.default.attributesOfItem(atPath: url.path)) != nil {
      return try SlopFile.read(url, within: root)
    }
    guard bytes.count <= SlopFile.maximumBytes else {
      throw SlopDocumentError("Shared app exceeds 25 MiB")
    }
    try Self.durableWrite(bytes, to: url)
    return bytes
  }
  public func independentCopy(to destination: URL) async throws -> SlopCommandDocument {
    try SlopLocalDocument.requireLocal(destination)
    guard destination.standardizedFileURL.resolvingSymlinksInPath() != root else {
      throw SlopDocumentError("A duplicate needs a new path")
    }
    try await flush()
    guard record.metadata.proposalHash == nil else {
      throw SlopDocumentError("Review the preserved external proposal before duplicating")
    }
    let package = try SlopPackage(rootURL: destination)
    for url in [package.stateURL, package.jsonStoreURL]
    where FileManager.default.fileExists(atPath: url.path) {
      try FileManager.default.removeItem(at: url)
    }
    return try Self(
      root: destination, schema: schema, initial: record.snapshot.data,
      schemaFingerprint: record.snapshot.schemaHash)
  }
  public func shutDown() {
    invalidate()
    do { try storage.close() }
    catch { print("[hitSlop storage] Close failed: \(error.localizedDescription)") }
    engine.close()
  }
  /// Disposes resources without a guest/projection flush. Capture callers must
  /// await this barrier before removing their temporary package.
  public func shutDownAndWait() async throws {
    invalidate()
    let result = Result { try storage.close() }
    await engine.closeAsync()
    try result.get()
  }
  private func invalidate() {
    cancelProjection()
    closed = true
    sender = nil
    mediaTransport = nil
    for listener in listeners.values { listener.finish() }
    listeners.removeAll()
  }
  public func backupDatabase(to destination: URL) async throws {
    try await flush()
    try storage.backup(to: destination)
  }
}
