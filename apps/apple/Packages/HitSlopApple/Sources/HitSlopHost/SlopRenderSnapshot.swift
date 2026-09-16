import Foundation
import HitSlopCore
import HitSlopRuntime

/// Rendering may initialize stores and run guest startup code, but only in this disposable copy.
final class SlopRenderSnapshot {
    let url: URL
    private let directory: URL
    init(packageURL: URL) throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-capture-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        do {
            url = try SlopDuplicator.duplicate(from: packageURL, to: directory.appendingPathComponent("document.slop"))
            let source = packageURL.appendingPathComponent("state/document.sqlite")
            if FileManager.default.fileExists(atPath: source.path) {
                let target = url.appendingPathComponent("state/document.sqlite")
                try FileManager.default.removeItem(at: target)
                try? FileManager.default.removeItem(at: url.appendingPathComponent("state/document.sqlite-journal"))
                try SlopSyncStorage(root: packageURL).backup(to: target)
                // A file copy and a database backup may observe different commits.
                // Regenerate the projection from the backed-up history on open.
                let projection = url.appendingPathComponent("stores/data.json")
                if FileManager.default.fileExists(atPath: projection.path) { try FileManager.default.removeItem(at: projection) }
            }
        }
        catch { try? FileManager.default.removeItem(at: directory); throw error }
    }
    func remove() { try? FileManager.default.removeItem(at: directory) }
    deinit { remove() }
}
