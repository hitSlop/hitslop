import CryptoKit
import Darwin
import Foundation
import HitSlopCore

public enum SlopCloud {
    public static let containerIdentifier = "iCloud.com.hitslop.app"

    public static var containerURL: URL? {
        FileManager.default.url(forUbiquityContainerIdentifier: containerIdentifier)
    }

    public static var documentsURL: URL? {
        containerURL?.appendingPathComponent("Documents", isDirectory: true)
    }

    public static var isAvailable: Bool { containerURL != nil }

    public static func isUbiquitous(_ url: URL) -> Bool {
        let standardized = url.standardizedFileURL
        if (try? standardized.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem) == true { return true }
        guard let documents = documentsURL?.standardizedFileURL else { return false }
        return standardized.path.hasPrefix(documents.path)
    }

    public static func defaultCreationDirectory() -> URL {
        #if os(iOS)
        if let documents = documentsURL {
            try? FileManager.default.createDirectory(at: documents, withIntermediateDirectories: true)
            return documents
        }
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        #else
        return FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]
        #endif
    }

    public static func uniqueDocumentURL(slug: String, in directory: URL? = nil) -> URL {
        let folder = directory ?? defaultCreationDirectory()
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let base = folder.appendingPathComponent("\(slug).slop", isDirectory: true)
        if !FileManager.default.fileExists(atPath: base.path) { return base }
        for number in 2...10_000 {
            let candidate = folder.appendingPathComponent("\(slug) \(number).slop", isDirectory: true)
            if !FileManager.default.fileExists(atPath: candidate.path) { return candidate }
        }
        return folder.appendingPathComponent("\(slug) \(UUID().uuidString).slop", isDirectory: true)
    }

    public static func downloadIfNeeded(_ url: URL) async throws {
        let values = try url.resourceValues(forKeys: [.isUbiquitousItemKey])
        guard values.isUbiquitousItem == true else { return }
        try FileManager.default.startDownloadingUbiquitousItem(at: url)
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(20))
        while clock.now < deadline {
            let status = try url.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey, .ubiquitousItemDownloadingErrorKey])
            if let error = status.ubiquitousItemDownloadingError { throw error }
            if status.ubiquitousItemDownloadingStatus == URLUbiquitousItemDownloadingStatus.current { return }
            try await Task.sleep(for: .milliseconds(150))
        }
        throw SlopPackageError.invalid("timed out downloading iCloud document")
    }
}

enum SlopWorkingCopy {
    static var root: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("hitSlop/working-copies", isDirectory: true)
    }

    static func materialize(from presented: URL, into workingRoot: URL = root) throws -> URL {
        let identity = sha256(presented.standardizedFileURL.path)
        let destination = workingRoot.appendingPathComponent("\(identity).slop", isDirectory: true)
        try FileManager.default.createDirectory(at: workingRoot, withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try coordinate(reading: presented) { url in
            try FileManager.default.copyItem(at: url, to: destination)
        }
        try snapshotSQLite(in: destination)
        return destination
    }

    static func pushStores(from working: URL, to presented: URL) throws {
        let package = try SlopPackage(rootURL: working)
        try coordinate(writing: presented) { destination in
            for kind in [SlopStoreKind.json, .sqlite] {
                let source = package.storeURL(kind: kind)
                guard FileManager.default.fileExists(atPath: source.path) else { continue }
                let target = destination.appendingPathComponent("stores/data.\(kind == .json ? "json" : "sqlite")")
                try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
                if kind == .sqlite {
                    let temp = target.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).sqlite")
                    try SlopSQLiteSnapshot.copy(from: source, to: temp)
                    guard Darwin.rename(temp.path, target.path) == 0 else { throw SlopPackageError.invalid("could not replace SQLite store: \(String(cString: strerror(errno)))") }
                    try? FileManager.default.removeItem(at: URL(fileURLWithPath: target.path + "-wal"))
                    try? FileManager.default.removeItem(at: URL(fileURLWithPath: target.path + "-shm"))
                } else {
                    try Data(contentsOf: source).write(to: target, options: .atomic)
                }
            }
            let sourceTheme = package.themeOverrideURL
            let targetTheme = destination.appendingPathComponent("stores/theme.css")
            if FileManager.default.fileExists(atPath: sourceTheme.path) {
                try FileManager.default.createDirectory(at: targetTheme.deletingLastPathComponent(), withIntermediateDirectories: true)
                try Data(contentsOf: sourceTheme).write(to: targetTheme, options: .atomic)
            } else if FileManager.default.fileExists(atPath: targetTheme.path) {
                try FileManager.default.removeItem(at: targetTheme)
            }
            let sourceMedia = package.mediaStoresURL
            if FileManager.default.fileExists(atPath: sourceMedia.path) {
                let targetMedia = destination.appendingPathComponent("stores/media", isDirectory: true)
                try FileManager.default.createDirectory(at: targetMedia.deletingLastPathComponent(), withIntermediateDirectories: true)
                let temporary = targetMedia.deletingLastPathComponent().appendingPathComponent(".media-\(UUID().uuidString)", isDirectory: true)
                try FileManager.default.copyItem(at: sourceMedia, to: temporary)
                if FileManager.default.fileExists(atPath: targetMedia.path) { try FileManager.default.removeItem(at: targetMedia) }
                try FileManager.default.moveItem(at: temporary, to: targetMedia)
            }
        }
    }

    private static func snapshotSQLite(in root: URL) throws {
        let package = try SlopPackage(rootURL: root)
        let url = package.sqliteStoreURL
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        let temp = url.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).sqlite")
        try SlopSQLiteSnapshot.copy(from: url, to: temp)
        guard Darwin.rename(temp.path, url.path) == 0 else { throw SlopPackageError.invalid("could not install SQLite working copy: \(String(cString: strerror(errno)))") }
        try? FileManager.default.removeItem(at: URL(fileURLWithPath: url.path + "-wal"))
        try? FileManager.default.removeItem(at: URL(fileURLWithPath: url.path + "-shm"))
    }

    private static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func coordinate(reading url: URL, _ body: (URL) throws -> Void) throws {
        var coordinatorError: NSError?
        var bodyError: Error?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinatorError) { newURL in
            do { try body(newURL) } catch { bodyError = error }
        }
        if let coordinatorError { throw coordinatorError }
        if let bodyError { throw bodyError }
    }

    private static func coordinate(writing url: URL, _ body: (URL) throws -> Void) throws {
        var coordinatorError: NSError?
        var bodyError: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordinatorError) { newURL in
            do { try body(newURL) } catch { bodyError = error }
        }
        if let coordinatorError { throw coordinatorError }
        if let bodyError { throw bodyError }
    }
}

@MainActor public final class SlopOpenedDocument {
    public let presentedURL: URL
    public let session: SlopRuntimeSession
    public let usesWorkingCopy: Bool
    public var onFlushError: ((Error) -> Void)?
    private var flushWork: DispatchWorkItem?

    public static func open(presentedURL: URL) async throws -> SlopOpenedDocument {
        try await SlopCloud.downloadIfNeeded(presentedURL)
        return try SlopOpenedDocument(presentedURL: presentedURL)
    }

    public init(presentedURL: URL) throws {
        let presented = presentedURL.standardizedFileURL
        self.presentedURL = presented
        if SlopCloud.isUbiquitous(presented) {
            let working = try SlopWorkingCopy.materialize(from: presented)
            usesWorkingCopy = true
            session = try SlopRuntimeSession(packageURL: working)
        } else {
            usesWorkingCopy = false
            session = try SlopRuntimeSession(packageURL: presented)
        }
        session.onStoreCommit = { [weak self] in self?.scheduleFlush() }
    }

    public func scheduleFlush() {
        guard usesWorkingCopy else { return }
        flushWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            do { try self.flush() } catch { self.onFlushError?(error) }
        }
        flushWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: work)
    }

    public func flush() throws {
        guard usesWorkingCopy else { return }
        flushWork?.cancel()
        session.checkpoint()
        try SlopWorkingCopy.pushStores(from: session.package.rootURL, to: presentedURL)
    }

    public func close() {
        do { try flush() } catch { onFlushError?(error) }
        session.close()
    }
}
