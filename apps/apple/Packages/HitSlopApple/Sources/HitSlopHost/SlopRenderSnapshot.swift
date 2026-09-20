import Foundation
import HitSlopCore
import HitSlopRuntime

/// Rendering may initialize stores and run guest startup code, but only in this disposable copy.
final class SlopRenderSnapshot: @unchecked Sendable {
    let url: URL
    private let directory: URL
    private let lock = NSLock()
    private var users = 0
    private var retainedForFailedTeardown = false
    private var removed = false

    static func prepare(packageURL: URL) async throws -> SlopRenderSnapshot {
        let snapshot = try await SlopPreparation.run { try SlopRenderSnapshot(packageURL: packageURL) }
        if Task.isCancelled { snapshot.remove(); throw CancellationError() }
        return snapshot
    }
    init(packageURL: URL) throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-capture-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        do {
            url = try SlopDuplicator.duplicate(from: packageURL, to: directory.appendingPathComponent("document.slop"))

        }
        catch { try? FileManager.default.removeItem(at: directory); throw error }
    }
    func beginUse() throws {
        lock.lock()
        defer { lock.unlock() }
        guard !removed, !retainedForFailedTeardown else {
            throw SlopPackageError.invalid("capture snapshot is no longer available")
        }
        users += 1
    }
    func endUse(teardownSucceeded: Bool) {
        lock.lock()
        defer { lock.unlock() }
        users -= 1
        if !teardownSucceeded { retainedForFailedTeardown = true }
    }
    func remove() {
        lock.lock()
        defer { lock.unlock() }
        guard users == 0, !retainedForFailedTeardown, !removed else { return }
        do { try FileManager.default.removeItem(at: directory); removed = true }
        catch { print("[hitSlop capture] Could not remove snapshot: \(error.localizedDescription)") }
    }
    deinit { remove() }
}
