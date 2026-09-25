import Foundation
import HitSlopCore

/// Owns the storage request/acknowledgement boundary; WebKit lifecycle stays in WasmSession.
@MainActor final class StorageBridge {
  private struct Reply: @unchecked Sendable { let value: [String: Any] }
  private let storage: Storage
  var onFailure: ((SlopFailureContext) -> Void)?
  #if DEBUG
  var beforeWrite: ((String) throws -> Void)?
  var afterWrite: ((String) throws -> Void)?
  #endif

  init(storage: Storage) { self.storage = storage }

  func call(_ encoded: Data, method: String,
    reply: @escaping @MainActor @Sendable (Any?, String?) -> Void
  ) {
    let writes = ["append", "checkpoint", "attachments.put"].contains(method)
    #if DEBUG
    do { if writes { try beforeWrite?(method) } }
    catch { reply(nil, error.localizedDescription); return }
    #endif
    storage.queue.async { [storage, weak self] in
      let result: Result<Reply, Error> = Result {
        guard let request = try JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        else { throw failure("Invalid storage envelope") }
        return Reply(value: try storage.call(request))
      }
      DispatchQueue.main.async { [weak self] in
        do {
          let value = try result.get().value
          #if DEBUG
          // This fault is after a successful commit, not an unsuccessful write.
          if writes { try self?.afterWrite?(method) }
          #endif
          reply(value, nil)
        } catch let error as SlopRejection {
          reply(["rejected": error.localizedDescription], nil)
        } catch {
          if !SlopFailureContext.isCancellation(error) {
            let diagnostic = SlopFailureContext.classify(error)
            self?.onFailure?(diagnostic.reason == .unknown || error is SlopPackageError
              ? .init(reason: .storage) : diagnostic)
          }
          reply(nil, error.localizedDescription)
        }
      }
    }
  }
}
