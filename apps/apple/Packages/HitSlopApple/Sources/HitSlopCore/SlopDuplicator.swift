import Foundation

public enum SlopDuplicator {
    @discardableResult public static func duplicate(from sourceURL: URL, to requestedDestination: URL) throws -> URL {
        let source = try SlopPackage(rootURL: sourceURL)
        let destination = requestedDestination.pathExtension.lowercased() == "slop" ? requestedDestination : requestedDestination.appendingPathExtension("slop")
        let fileManager = FileManager.default
        guard !fileManager.fileExists(atPath: destination.path) else { throw CocoaError(.fileWriteFileExists) }
        do {
            try fileManager.copyItem(at: source.rootURL, to: destination)
            if fileManager.fileExists(atPath: source.sqliteStoreURL.path) {
                let target = destination.appendingPathComponent("stores/data.sqlite")
                let snapshot = target.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).sqlite")
                try SlopSQLiteSnapshot.copy(from: source.sqliteStoreURL, to: snapshot)
                if fileManager.fileExists(atPath: target.path) { try fileManager.removeItem(at: target) }
                try fileManager.moveItem(at: snapshot, to: target)
                try? fileManager.removeItem(atPath: target.path + "-wal")
                try? fileManager.removeItem(atPath: target.path + "-shm")
            }
            try makeWritable(destination)
            _ = try SlopPackage(rootURL: destination)
            return destination
        } catch {
            try? makeWritable(destination)
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

    public static func makeWritable(_ root: URL) throws {
        try setWriteBits(root, adding: true)
    }

    public static func makeImmutable(_ root: URL) throws {
        try setWriteBits(root, adding: false)
    }

    private static func setWriteBits(_ root: URL, adding: Bool) throws {
        var urls = [root]
        if let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey]) {
            urls += enumerator.compactMap { $0 as? URL }
        }
        for url in adding ? urls : urls.reversed() {
            let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
            guard values.isSymbolicLink != true else { throw SlopPackageError.invalid("symlinks are not allowed") }
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            guard let value = attributes[.posixPermissions] as? NSNumber else { continue }
            let next = adding
                ? value.intValue | (values.isDirectory == true ? 0o700 : 0o600)
                : value.intValue & ~0o222
            try FileManager.default.setAttributes([.posixPermissions: next], ofItemAtPath: url.path)
        }
    }
}
