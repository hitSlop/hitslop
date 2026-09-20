import Foundation
import SQLite3

public enum SlopDuplicator {
    @discardableResult public static func duplicate(from sourceURL: URL, to requestedDestination: URL) throws -> URL {
        try SlopLocalDocument.requireLocal(requestedDestination)
        let source = try SlopPackage(rootURL: sourceURL)
        let destination = requestedDestination.pathExtension.lowercased() == "slop" ? requestedDestination : requestedDestination.appendingPathExtension("slop")
        let fileManager = FileManager.default
        guard !fileManager.fileExists(atPath: destination.path) else { throw CocoaError(.fileWriteFileExists) }
        do {
            try fileManager.createDirectory(at: destination, withIntermediateDirectories: false)
            for entry in try fileManager.contentsOfDirectory(at: source.rootURL, includingPropertiesForKeys:nil) where entry.lastPathComponent != "state" {
                try fileManager.copyItem(at:entry,to:destination.appendingPathComponent(entry.lastPathComponent))
            }
            let sourceDB = source.rootURL.appendingPathComponent("state/document.sqlite")
            if fileManager.fileExists(atPath:sourceDB.path) {
                let state = destination.appendingPathComponent("state")
                try fileManager.createDirectory(at:state,withIntermediateDirectories:false)
                try backup(sourceDB,to:state.appendingPathComponent("document.sqlite"))
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

    private static func backup(_ source:URL,to destination:URL) throws {
        var input:OpaquePointer?, output:OpaquePointer?
        defer { sqlite3_close(input);sqlite3_close(output) }
        guard sqlite3_open_v2(source.path,&input,SQLITE_OPEN_READONLY,nil) == SQLITE_OK,
              sqlite3_open_v2(destination.path,&output,SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE,nil) == SQLITE_OK else { throw SlopPackageError.invalid("Cannot snapshot document") }
        sqlite3_busy_timeout(input,5000);sqlite3_busy_timeout(output,5000)
        guard let backup = sqlite3_backup_init(output,"main",input,"main") else { throw SlopPackageError.invalid("Cannot start document snapshot") }
        let result = sqlite3_backup_step(backup,-1)
        let finished = sqlite3_backup_finish(backup)
        guard result == SQLITE_DONE, finished == SQLITE_OK else { throw SlopPackageError.invalid("Document snapshot was busy or failed") }
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
