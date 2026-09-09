import Foundation
import HitSlopCore

/// Rendering may initialize stores and run guest startup code, but only in this disposable copy.
final class SlopRenderSnapshot {
    let url: URL
    private let directory: URL
    init(packageURL: URL) throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-capture-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        do { url = try SlopDuplicator.duplicate(from: packageURL, to: directory.appendingPathComponent("document.slop")) }
        catch { try? FileManager.default.removeItem(at: directory); throw error }
    }
    func remove() { try? FileManager.default.removeItem(at: directory) }
    deinit { remove() }
}
