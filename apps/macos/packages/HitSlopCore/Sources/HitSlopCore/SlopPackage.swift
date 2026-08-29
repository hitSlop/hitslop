import CryptoKit
import Foundation
import ZIPFoundation

public enum SlopPackageError: LocalizedError {
    case missing(String), invalid(String), unsafeArchive(String)
    public var errorDescription: String? {
        switch self { case .missing(let value): "Missing \(value)"; case .invalid(let value): "Invalid hitSlop package: \(value)"; case .unsafeArchive(let value): "Unsafe archive entry: \(value)" }
    }
}

public struct SlopPackage: Sendable {
    public let rootURL: URL
    public let manifestData: Data
    public let manifest: SlopManifest

    public init(rootURL: URL) throws {
        self.rootURL = rootURL.standardizedFileURL
        let manifestURL = rootURL.appendingPathComponent("manifest.json")
        guard FileManager.default.fileExists(atPath: manifestURL.path) else { throw SlopPackageError.missing("manifest.json") }
        manifestData = try Data(contentsOf: manifestURL)
        manifest = try JSONDecoder().decode(SlopManifest.self, from: manifestData)
        guard FileManager.default.fileExists(atPath: entryURL.path) else { throw SlopPackageError.missing("build/index.html") }
        for store in manifest.stores {
            guard Self.isSafeRelativePath(store.path) else { throw SlopPackageError.invalid("unsafe store path \(store.path)") }
            guard FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(store.path).path) else { throw SlopPackageError.missing(store.path) }
        }
    }

    public var entryURL: URL { rootURL.appendingPathComponent("build/index.html") }
    public var styleURL: URL { rootURL.appendingPathComponent("style.css") }
    public func store(id: String, kind: SlopStoreKind) throws -> URL {
        guard let store = manifest.stores.first(where: { $0.id == id && $0.kind == kind }) else { throw SlopPackageError.invalid("unknown \(kind.rawValue) store \(id)") }
        let url = rootURL.appendingPathComponent(store.path).standardizedFileURL
        guard url.path.hasPrefix(rootURL.path) else { throw SlopPackageError.invalid("unsafe store path \(store.path)") }
        return url
    }
    public func storeRecord(id: String, kind: SlopStoreKind) throws -> SlopStore {
        guard let store = manifest.stores.first(where: { $0.id == id && $0.kind == kind }) else { throw SlopPackageError.invalid("unknown \(kind.rawValue) store \(id)") }
        return store
    }

    /// Host-side containment check. Schema/publish validation is the authoring gate; this keeps a hand-edited package from walking out of the bundle.
    public static func isSafeRelativePath(_ path: String) -> Bool {
        !path.hasPrefix("/") && !path.split(separator: "/").contains("..") && !path.isEmpty
    }

    public static func containedURL(root: URL, relativePath: String) throws -> URL {
        guard isSafeRelativePath(relativePath) else { throw SlopPackageError.invalid("unsafe path \(relativePath)") }
        let url = root.appendingPathComponent(relativePath).standardizedFileURL
        let rootPath = root.standardizedFileURL.path
        let prefix = rootPath.hasSuffix("/") ? rootPath : rootPath + "/"
        guard url.path == rootPath || url.path.hasPrefix(prefix) else { throw SlopPackageError.invalid("unsafe path \(relativePath)") }
        return url
    }
}

public enum SlopArchive {
    public static func sha256(of data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    public static func extract(_ archiveURL: URL, to destination: URL, expectedSHA256: String? = nil) throws {
        let data = try Data(contentsOf: archiveURL); if let expectedSHA256, sha256(of: data) != expectedSHA256 { throw SlopPackageError.invalid("artifact checksum mismatch") }
        let archive = try Archive(url: archiveURL, accessMode: .read)
        var total: UInt64 = 0
        for entry in archive {
            guard SlopPackage.isSafeRelativePath(entry.path), entry.type != .symlink else { throw SlopPackageError.unsafeArchive(entry.path) }
            total += entry.uncompressedSize; guard total <= 200 * 1024 * 1024 else { throw SlopPackageError.invalid("archive expands beyond 200 MB") }
        }
        let temporary = destination.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).tmp", isDirectory: true)
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        do {
            for entry in archive { _ = try archive.extract(entry, to: temporary.appendingPathComponent(entry.path)) }
            _ = try SlopPackage(rootURL: temporary)
            if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
            try FileManager.default.moveItem(at: temporary, to: destination)
        } catch { try? FileManager.default.removeItem(at: temporary); throw error }
    }
}
