import CryptoKit
import Foundation
import ImageIO
import ZIPFoundation

public final class SlopMediaStore: @unchecked Sendable {
    public let directoryURL: URL
    /// Stat-first cache for the change poller: re-read and re-hash entry contents
    /// only when the listing fingerprint (names, sizes, modification dates) changes.
    private let cacheLock = NSLock()
    private var revisionCache: (fingerprint: String, revision: String?)?

    public init(directoryURL: URL) { self.directoryURL = directoryURL }

    public static func isValidName(_ name: String) -> Bool {
        guard (1...64).contains(name.count), let first = name.first, first.isASCII, first.isLowercase, first.isLetter else { return false }
        return name.allSatisfy { character in
            character.isASCII && (character.isLowercase && character.isLetter || character.isNumber || character == "-")
        }
    }

    public func url(for name: String) throws -> URL {
        guard Self.isValidName(name) else { throw SlopPackageError.invalid("invalid media name") }
        return directoryURL.appendingPathComponent(name, isDirectory: false)
    }

    public func open(_ name: String) throws -> (exists: Bool, revision: String?) {
        let url = try url(for: name)
        guard FileManager.default.fileExists(atPath: url.path) else { return (false, nil) }
        let data = try Data(contentsOf: url)
        _ = try Self.mediaMIMEType(data)
        return (true, Self.revision(data))
    }

    @discardableResult public func write(_ name: String, base64: String) throws -> String {
        guard let data = Data(base64Encoded: base64) else { throw SlopPackageError.invalid("media data is not valid base64") }
        _ = try Self.mediaMIMEType(data)
        let destination = try url(for: name)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try data.write(to: destination, options: .atomic)
        return Self.revision(data)
    }

    public func remove(_ name: String) throws {
        let url = try url(for: name)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }

    public func directoryRevision() throws -> String? {
        guard FileManager.default.fileExists(atPath: directoryURL.path) else { cacheRevision(nil); return nil }
        let keys: Set<URLResourceKey> = [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey]
        let urls = try FileManager.default.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: Array(keys)).sorted { $0.lastPathComponent < $1.lastPathComponent }
        guard !urls.isEmpty else { cacheRevision(nil); return nil }
        var fingerprint = ""
        for url in urls {
            let values = try url.resourceValues(forKeys: keys)
            guard values.isRegularFile == true, values.isSymbolicLink != true, Self.isValidName(url.lastPathComponent) else { throw SlopPackageError.invalid("invalid media store entry") }
            fingerprint += "\(url.lastPathComponent)|\(values.fileSize ?? -1)|\(values.contentModificationDate?.timeIntervalSinceReferenceDate ?? 0)\n"
        }
        cacheLock.lock()
        if let cached = revisionCache, cached.fingerprint == fingerprint {
            defer { cacheLock.unlock() }
            return cached.revision
        }
        cacheLock.unlock()
        var hasher = SHA256()
        for url in urls {
            let data = try Data(contentsOf: url)
            _ = try Self.mediaMIMEType(data)
            hasher.update(data: Data(url.lastPathComponent.utf8)); hasher.update(data: data)
        }
        let revision = hasher.finalize().map { String(format: "%02x", $0) }.joined()
        cacheRevision((fingerprint, revision))
        return revision
    }

    private func cacheRevision(_ entry: (fingerprint: String, revision: String?)?) {
        cacheLock.lock()
        revisionCache = entry
        cacheLock.unlock()
    }

    public static func imageMIMEType(_ data: Data) throws -> String {
        guard let mime = detectedImageMIMEType(data) else { throw SlopPackageError.invalid("selected file is not an image") }
        return mime
    }

    public static func mediaMIMEType(_ data: Data) throws -> String {
        guard data.count <= 25 * 1024 * 1024 else { throw SlopPackageError.invalid("media exceeds 25 MiB") }
        if let mime = detectedImageMIMEType(data) { return mime }
        try validateZIP(data)
        return "application/zip"
    }

    private static func detectedImageMIMEType(_ data: Data) -> String? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceCreateImageAtIndex(source, 0, nil) != nil,
              let type = CGImageSourceGetType(source) as String? else {
            return nil
        }
        switch type {
        case "public.png": return "image/png"
        case "public.jpeg": return "image/jpeg"
        case "com.compuserve.gif": return "image/gif"
        case "org.webmproject.webp": return "image/webp"
        default: return "image/*"
        }
    }

    private static func validateZIP(_ data: Data) throws {
        let compressedLimit = 10 * 1024 * 1024
        let entryLimit: UInt64 = 25 * 1024 * 1024
        let totalLimit: UInt64 = 50 * 1024 * 1024
        guard data.count <= compressedLimit else { throw SlopPackageError.invalid("ZIP media exceeds 10 MB") }
        let archive: Archive
        do { archive = try Archive(data: data, accessMode: .read, pathEncoding: nil) }
        catch { throw SlopPackageError.invalid("selected file is not supported media") }
        let entries = Array(archive)
        guard !entries.isEmpty else { throw SlopPackageError.invalid("ZIP media is empty or encrypted") }
        guard entries.count <= 256 else { throw SlopPackageError.invalid("ZIP media contains more than 256 entries") }
        var total: UInt64 = 0
        var hasFile = false
        for entry in entries {
            guard entry.type != .symlink else { throw SlopPackageError.invalid("ZIP media cannot contain symlinks") }
            guard entry.uncompressedSize <= entryLimit else { throw SlopPackageError.invalid("ZIP media entry exceeds 25 MB") }
            total += entry.uncompressedSize
            guard total <= totalLimit else { throw SlopPackageError.invalid("ZIP media expands beyond 50 MB") }
            if entry.type == .file { hasFile = true }
        }
        guard hasFile else { throw SlopPackageError.invalid("ZIP media contains no files") }
    }

    private static func revision(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
