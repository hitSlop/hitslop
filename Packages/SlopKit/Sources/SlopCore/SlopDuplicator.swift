import Darwin
import Foundation

public enum SlopDuplicator {
    public static func duplicate(
        from sourceURL: URL,
        to requestedDestination: URL,
        title: String? = nil,
        fileManager: FileManager = .default
    ) throws -> URL {
        let source = try SlopPackage(rootURL: sourceURL)
        let destination = requestedDestination.pathExtension.lowercased() == "slop"
            ? requestedDestination
            : requestedDestination.appendingPathExtension("slop")
        guard !fileManager.fileExists(atPath: destination.path) else {
            throw SlopHostError.invalidPackage("A document already exists at \(destination.path)")
        }

        var completed = false
        defer {
            if !completed {
                try? fileManager.removeItem(at: destination)
            }
        }

        // The save panel grants access to the selected destination, not to an
        // arbitrary hidden sibling. Copy first so every write occurs inside the
        // user-authorized document package. The source may be a read-only app
        // resource and must never be opened in WAL/write mode.
        try fileManager.copyItem(at: source.rootURL, to: destination)
        try makeWritableRecursively(destination, fileManager: fileManager)

        for store in source.manifest.stores where store.kind == .sqlite {
            let sourceStore = try source.storeURL(id: store.id, kind: .sqlite)
            let destinationStore = destination.appendingPathComponent(store.path)
            let snapshot = destinationStore.deletingLastPathComponent()
                .appendingPathComponent(".\(destinationStore.lastPathComponent).\(UUID().uuidString).snapshot")
            var snapshotInstalled = false
            defer {
                if !snapshotInstalled, fileManager.fileExists(atPath: snapshot.path) {
                    try? fileManager.removeItem(at: snapshot)
                }
            }

            try SlopSQLiteSnapshot.copy(from: sourceStore, to: snapshot)
            try replaceAtomically(snapshot, destinationStore)
            snapshotInstalled = true
        }

        removeSQLiteSidecars(in: destination, fileManager: fileManager)

        let manifestURL = destination.appendingPathComponent("manifest.json")
        var manifest = source.manifest
        manifest.id = UUID().uuidString.lowercased()
        manifest.title = title ?? destination.deletingPathExtension().lastPathComponent
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        var data = try encoder.encode(manifest)
        data.append(0x0A)
        try data.write(to: manifestURL, options: .atomic)
        completed = true
        return destination
    }

    public static func nextDuplicateURL(for sourceURL: URL, fileManager: FileManager = .default) -> URL {
        let directory = sourceURL.deletingLastPathComponent()
        let base = sourceURL.deletingPathExtension().lastPathComponent
        for number in 1...10_000 {
            let suffix = number == 1 ? " copy" : " copy \(number)"
            let candidate = directory.appendingPathComponent(base + suffix).appendingPathExtension("slop")
            if !fileManager.fileExists(atPath: candidate.path) { return candidate }
        }
        return directory.appendingPathComponent(base + " copy \(UUID().uuidString)").appendingPathExtension("slop")
    }

    private static func removeSQLiteSidecars(in root: URL, fileManager: FileManager) {
        guard let enumerator = fileManager.enumerator(at: root, includingPropertiesForKeys: nil) else { return }
        for case let url as URL in enumerator where url.lastPathComponent.hasSuffix("-wal") || url.lastPathComponent.hasSuffix("-shm") {
            try? fileManager.removeItem(at: url)
        }
    }

    private static func makeWritableRecursively(_ root: URL, fileManager: FileManager) throws {
        let resourceKeys: [URLResourceKey] = [.isDirectoryKey, .isSymbolicLinkKey]
        var urls = [root]
        if let enumerator = fileManager.enumerator(
            at: root,
            includingPropertiesForKeys: resourceKeys,
            options: [.skipsPackageDescendants]
        ) {
            urls.append(contentsOf: enumerator.compactMap { $0 as? URL })
        }

        for url in urls {
            let values = try url.resourceValues(forKeys: Set(resourceKeys))
            guard values.isSymbolicLink != true else { continue }
            let attributes = try fileManager.attributesOfItem(atPath: url.path)
            guard let permissions = attributes[.posixPermissions] as? NSNumber else { continue }
            let existing = permissions.intValue
            let required = values.isDirectory == true ? 0o700 : 0o200
            let writable = existing | required
            if writable != existing {
                try fileManager.setAttributes([.posixPermissions: writable], ofItemAtPath: url.path)
            }
        }
    }

    private static func replaceAtomically(_ source: URL, _ destination: URL) throws {
        let result = source.path.withCString { sourcePath in
            destination.path.withCString { destinationPath in
                Darwin.rename(sourcePath, destinationPath)
            }
        }
        guard result == 0 else {
            let message = String(cString: strerror(errno))
            throw SlopHostError.invalidPackage("Could not install database snapshot: \(message)")
        }
    }
}
