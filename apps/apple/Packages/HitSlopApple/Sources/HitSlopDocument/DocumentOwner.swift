import Foundation
import CryptoKit
import HitSlopCore
import HitSlopCoreBinding

/// Contract-4 document ownership. The serial storage queue owns every core call.
/// Renderer lifetimes never determine the lifetime of this object or its writer lock.
public final class DocumentOwner: @unchecked Sendable {
  public let package: SlopPackage
  let storage: Storage
  private var core: NativeDocument
  public private(set) var session: String
  public let documentID: String
  var onPublication: (@Sendable (String) -> Void)?
  var onSaveStatus: (@Sendable (String, String?, Int) -> Void)?
  private var sequence = 0
  private var autosave: DispatchWorkItem?
  private let schemaKey: String
  private var generation: String
  private var savedVersion: String
  private var saveFailure: String?
  private var dirty = false
  private var closed = false
  private var invalidated = false
  private var replies: [String: (String, String)] = [:]
  private var replyOrder: [String] = []
  private var retiredRequests = Set<String>()
  private var replyBytes = 0

  public init(package: SlopPackage, mode: StorageMode = .document) throws {
    self.package = package
    guard FileManager.default.fileExists(atPath: package.rootURL.appendingPathComponent("assets/runtime.json").path) else { throw failure("Missing runtime requirements") }
    let requirements = try JSONSerialization.jsonObject(with: SlopFile.read(
      package.rootURL.appendingPathComponent("assets/runtime.json"), within: package.rootURL,
      maximumBytes: 64 * 1024))
    guard PlatformContract.valid(requirements, against: runtimeRequirementsSchema),
      let object = requirements as? [String: Any], object["runtimeContract"] as? Int == 4,
      object["minRuntimeRevision"] as? Int == 1 else {
      throw failure("Unsupported runtime contract; contract 4 is required (no migration)")
    }
    let descriptor = try SlopFile.read(package.dataSchemaURL, within: package.rootURL, maximumBytes: 1_048_576)
    let canonical = try JSONSerialization.data(withJSONObject: JSONSerialization.jsonObject(with: descriptor), options: [.sortedKeys, .withoutEscapingSlashes])
    schemaKey = String(decoding: canonical, as: UTF8.self)
    storage = try Storage(root: package.rootURL, mode: mode, storageRevision: 2)
    do {
      let loaded = try storage.call(["method": "load"])
      documentID = loaded["docId"] as! String
      generation = loaded["generation"] as! String
      if let encoded = loaded["checkpoint"] as? String {
        guard loaded["schemaKey"] as? String == schemaKey, let bytes = Data(base64Encoded: encoded) else {
          throw failure("Document schema differs from saved state")
        }
        core = try NativeDocument.open(schemaJson: schemaKey, checkpoint: bytes)
        for update in loaded["updates"] as? [String] ?? [] {
          guard let bytes = Data(base64Encoded: update) else { throw failure("Invalid stored update") }
          _ = try core.importUpdates(bytes: bytes)
        }
      } else {
        let initial = try SlopFile.read(package.initialURL, within: package.rootURL)
        core = try NativeDocument.create(schemaJson: schemaKey, initialJson: String(decoding: initial, as: UTF8.self))
        let result = try storage.call(["method": "checkpoint", "generation": generation,
          "schemaKey": schemaKey, "bytes": core.checkpoint().base64EncodedString()])
        generation = result["generation"] as! String
      }
      savedVersion = try core.version()
      let frame = try JSONSerialization.jsonObject(with: Data(core.snapshot().utf8)) as! [String: Any]
      session = frame["session"] as! String
      sequence = frame["sequence"] as! Int
    } catch {
      storage.close()
      throw error
    }
  }

  private func enqueue<T: Sendable>(allowInvalidated: Bool = false, _ action: @escaping @Sendable () throws -> T) async throws -> T {
    try await withCheckedThrowingContinuation { continuation in
      storage.queue.async {
        do {
          guard !self.closed else { throw failure("Document owner is closed") }
          guard allowInvalidated || !self.invalidated else { throw failure("Owner invalidated; explicit recovery is required") }
          continuation.resume(returning: try action())
        } catch {
          let description = String(describing: error)
          if description.contains("engine_panic") || description.contains("owner_poisoned") {
            self.invalidated = true
            self.publishStatus("save-failed", "Owner invalidated: reload saved state explicitly; accepted unsaved edits may be lost.", self.sequence)
          }
          continuation.resume(throwing: error)
        }
      }
    }
  }

  public func state() async throws -> String { try await enqueue { try self.core.snapshot() } }

  /// Same-session retries are idempotent. Evicted IDs are refused, never executed twice.
  public func apply(id: String, session: String, batch: String, current: Bool = false) async throws -> String {
    try await enqueue {
      guard self.storage.mode == .document else { throw failure("Read-only capture cannot edit") }
      guard self.session == session else { throw failure("session_changed") }
      guard !id.isEmpty, id.utf8.count <= 128 else { throw failure("Invalid request ID") }
      guard batch.utf8.count <= 4 * 1024 * 1024 else { throw failure("Request exceeds size limit") }
      let canonicalBytes = try JSONSerialization.data(withJSONObject:
        JSONSerialization.jsonObject(with: Data(batch.utf8)), options: [.sortedKeys, .withoutEscapingSlashes])
      let canonical = (current ? "command:" : "batch:") + SHA256.hash(data: canonicalBytes).map { String(format: "%02x", $0) }.joined()
      if let (previous, reply) = self.replies[id] {
        guard canonical == previous else { throw failure("Request ID reused with different content") }
        return reply
      }
      guard !self.retiredRequests.contains(id) else { throw failure("unknown_outcome: request result expired; read state") }
      guard self.retiredRequests.count + self.replies.count < 100_000 else {
        throw failure("Request history limit reached; save and reopen the document")
      }
      let reply = try current ? self.core.commandCurrent(batchJson: batch) : self.core.apply(batchJson: batch)
      self.didEdit(reply)
      self.replies[id] = (canonical, reply)
      self.replyOrder.append(id)
      self.replyBytes += reply.utf8.count
      while self.replyOrder.count > 256 || self.replyBytes > 8 * 1024 * 1024 {
        let retired = self.replyOrder.removeFirst()
        self.replyBytes -= self.replies.removeValue(forKey: retired)!.1.utf8.count
        self.retiredRequests.insert(retired)
      }
      return reply
    }
  }

  public func text(_ request: String) async throws -> String {
    try await enqueue {
      guard self.storage.mode == .document else { throw failure("Read-only capture cannot edit") }
      let reply = try self.core.text(requestJson: request)
      self.didEdit(reply)
      return reply
    }
  }
  public func releaseDraft(_ draft: String) async throws {
    try await enqueue { try self.core.releaseDraft(draft: draft) }
  }
  public func replaceJSON(_ json: String) async throws -> Never {
    throw failure("unsupported_operation: JSON replacement is not supported in contract 4 yet")
  }
  private func publishStatus(_ status: String, _ error: String?, _ sequence: Int) {
    if status == "save-failed" { saveFailure = error }
    else if status == "saved" { saveFailure = nil }
    onSaveStatus?(saveFailure == nil ? status : "save-failed", saveFailure, sequence)
  }
  func republishStatus() async throws {
    try await enqueue(allowInvalidated: true) {
      self.onSaveStatus?(self.saveFailure == nil ? (self.dirty ? "pending" : "saved") : "save-failed", self.saveFailure, self.sequence)
    }
  }
  private func didEdit(_ publication: String) {
    dirty = true
    if let reply = try? JSONSerialization.jsonObject(with: Data(publication.utf8)) as? [String: Any], let patch = reply["patch"] as? [String: Any], let next = patch["sequence"] as? Int { sequence = next }
    onPublication?(publication)
    publishStatus("pending", nil, sequence)
    autosave?.cancel()
    let task = DispatchWorkItem { [weak self] in
      guard let self, !self.closed, !self.invalidated else { return }
      do { try self.save() } catch { self.publishStatus("save-failed", error.localizedDescription, self.sequence) }
    }
    autosave = task
    storage.queue.asyncAfter(deadline: .now() + .milliseconds(150), execute: task)
  }
  private func save(checkpoint forceCheckpoint: Bool = false) throws {
    guard dirty || forceCheckpoint else { return }
    let version = try core.version()
    let meta = try storage.call(["method": "metadata"])
    let updates = dirty ? try core.exportSince(version: savedVersion) : Data()
    let rows = meta["updateRows"] as? Int64 ?? 0
    let bytes = (meta["checkpointBytes"] as? Int64 ?? 0) + (meta["updateBytes"] as? Int64 ?? 0)
    let canAppend = dirty && rows < Storage.maximumRows && bytes + Int64(updates.count) <= Storage.maximumBytes
    let wantsCheckpoint = forceCheckpoint || !canAppend || rows >= 256 || (meta["updateBytes"] as? Int64 ?? 0) >= 4 * 1024 * 1024
    var request: [String: Any] = ["method": "append", "generation": generation, "updates": [updates.base64EncodedString()]]
    if wantsCheckpoint {
      let checkpoint = try core.checkpoint()
      // SQLite also bounds the complete checkpoint row (including its schema key).
      if Int64(checkpoint.count + schemaKey.utf8.count + 512) <= Storage.maximumBytes {
        request = ["method": "checkpoint", "generation": generation, "schemaKey": schemaKey, "bytes": checkpoint.base64EncodedString()]
      } else if forceCheckpoint || !canAppend {
        throw failure("Document is full (32 MiB limit); saved state is intact. Retry saving or explicitly discard unsaved edits.")
      }
      // Optional maintenance must not prevent an update that still fits the log.
    }
    do {
      generation = try storage.call(request)["generation"] as! String
    } catch {
      // A successful SQLite commit may lose its reply. Under the held writer lock,
      // only this write can advance the generation by one.
      let observed = try storage.call(["method": "metadata"])["generation"] as? String
      guard let number = Int64(generation), observed == String(number + 1) else { throw error }
      generation = observed!
    }
    savedVersion = version
    dirty = false
    publishStatus("saved", nil, sequence)
  }
  public func flush() async throws {
    try await enqueue {
      do { try self.save() }
      catch { self.publishStatus("save-failed", error.localizedDescription, self.sequence); throw error }
    }
  }
  public func compact() async throws {
    try await enqueue {
      guard self.storage.mode == .document else { throw failure("Read-only capture cannot compact") }
      try self.save(checkpoint: true)
    }
  }
  public func detachRenderer() async throws { try await enqueue { try self.core.detachRenderer() } }
  public func discardPending() async throws {
    try await enqueue(allowInvalidated: true) {
      let loaded = try self.storage.call(["method": "load"])
      guard let encoded = loaded["checkpoint"] as? String, let bytes = Data(base64Encoded: encoded) else { throw failure("Missing durable checkpoint") }
      let restored = try NativeDocument.open(schemaJson: self.schemaKey, checkpoint: bytes)
      for update in loaded["updates"] as? [String] ?? [] {
        guard let bytes = Data(base64Encoded: update) else { throw failure("Invalid stored update") }
        _ = try restored.importUpdates(bytes: bytes)
      }
      self.core = restored
      self.invalidated = false
      self.generation = loaded["generation"] as! String
      self.savedVersion = try restored.version()
      let frame = try JSONSerialization.jsonObject(with: Data(restored.snapshot().utf8)) as! [String: Any]
      self.session = frame["session"] as! String
      self.sequence = frame["sequence"] as! Int
      self.dirty = false
      self.replies.removeAll(); self.replyOrder.removeAll(); self.retiredRequests.removeAll(); self.replyBytes = 0
      self.publishStatus("saved", nil, self.sequence)
    }
  }
  /// Ancillary storage stays host-owned; document bytes are never exposed to JS.
  func ancillary(_ bytes: Data) async throws -> Data {
    try await enqueue {
      let request = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
      guard let method = request["method"] as? String,
        ["attachments.put", "attachments.read", "attachments.list", "theme.load", "theme.save"].contains(method)
      else { throw failure("Unsupported ancillary request") }
      return try JSONSerialization.data(withJSONObject: self.storage.call(request))
    }
  }
  public func close() async throws {
    try await enqueue {
      try self.save()
      self.autosave?.cancel()
      self.storage.close()
      self.closed = true
    }
  }
}
