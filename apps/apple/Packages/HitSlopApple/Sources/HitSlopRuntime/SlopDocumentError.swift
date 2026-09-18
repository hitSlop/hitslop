import Foundation
import HitSlopCore

public struct SlopDocumentError: LocalizedError, Sendable {
  public let message: String
  let limitMessage: String?
  public init(_ message: String) {
    self.message = message
    limitMessage = nil
  }
  init(limit: SlopLimitError) {
    message = limit.message
    limitMessage = limit.message
  }
  public var errorDescription: String? { message }
}
