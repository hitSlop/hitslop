import Foundation

/// Bounded blocking work (filesystem, SQLite opening, synchronous engine setup)
/// runs here, outside both the UI actor and Swift's cooperative thread pool.
public enum SlopPreparation {
  private static let queue = DispatchQueue(label: "com.hitslop.preparation", qos: .userInitiated)

  public static func run<T: Sendable>(_ work: @escaping @Sendable () throws -> T) async throws -> T {
    try Task.checkCancellation()
    // Always deliver resources produced by work, even after cancellation. The
    // caller owns disposing them before propagating cancellation.
    return try await withCheckedThrowingContinuation { continuation in
      queue.async { continuation.resume(with: Result { try work() }) }
    }
  }
}
