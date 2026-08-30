import Darwin
import Foundation

public enum SlopDuplicator {
    @discardableResult public static func duplicate(from sourceURL: URL, to requestedDestination: URL, template: SlopTemplateLineage? = nil) throws -> URL {
        let source = try SlopPackage(rootURL: sourceURL)
        let destination = requestedDestination.pathExtension.lowercased() == "slop" ? requestedDestination : requestedDestination.appendingPathExtension("slop")
        let fileManager = FileManager.default
        guard !fileManager.fileExists(atPath: destination.path) else { throw CocoaError(.fileWriteFileExists) }
        do {
            try fileManager.copyItem(at: source.rootURL, to: destination)
            try makeWritable(destination)
            for (id, store) in source.manifest.stores where store.kind == .sqlite {
                let sourceStore = try source.store(id: id, kind: .sqlite)
                let destinationStore = destination.appendingPathComponent(SlopPackage.storePath(id: id, kind: store.kind))
                let snapshot = destinationStore.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).sqlite")
                try SlopSQLiteSnapshot.copy(from: sourceStore, to: snapshot)
                guard Darwin.rename(snapshot.path, destinationStore.path) == 0 else { throw SlopPackageError.invalid("could not install SQLite snapshot") }
            }
            removeSQLiteSidecars(in: destination)
            let lineage = template ?? source.manifest.document?.template
            try SlopDocumentMetadata.write(to: destination, template: lineage)
            _ = try SlopPackage(rootURL: destination)
            return destination
        } catch {
            try? fileManager.removeItem(at: destination)
            throw error
        }
    }

    public static func nextDuplicateURL(for sourceURL: URL) -> URL {
        let directory = sourceURL.deletingLastPathComponent(), base = sourceURL.deletingPathExtension().lastPathComponent
        for number in 1...10_000 {
            let suffix = number == 1 ? " copy" : " copy \(number)"
            let candidate = directory.appendingPathComponent(base + suffix).appendingPathExtension("slop")
            if !FileManager.default.fileExists(atPath: candidate.path) { return candidate }
        }
        return directory.appendingPathComponent(base + " copy \(UUID().uuidString)").appendingPathExtension("slop")
    }

    private static func makeWritable(_ root: URL) throws {
        var urls = [root]
        if let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey]) { urls += enumerator.compactMap { $0 as? URL } }
        for url in urls {
            let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
            guard values.isSymbolicLink != true else { throw SlopPackageError.invalid("symlinks are not allowed") }
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            if let value = attributes[.posixPermissions] as? NSNumber {
                try FileManager.default.setAttributes([.posixPermissions: value.intValue | (values.isDirectory == true ? 0o700 : 0o600)], ofItemAtPath: url.path)
            }
        }
    }

    private static func removeSQLiteSidecars(in root: URL) {
        guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else { return }
        for case let url as URL in enumerator where url.lastPathComponent.hasSuffix("-wal") || url.lastPathComponent.hasSuffix("-shm") { try? FileManager.default.removeItem(at: url) }
    }
}
