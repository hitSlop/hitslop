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
    public let metadata: SlopManifestMetadata

    public init(rootURL: URL) throws {
        self.rootURL = rootURL.standardizedFileURL
        let manifestURL = rootURL.appendingPathComponent("manifest.json")
        guard FileManager.default.fileExists(atPath: manifestURL.path) else { throw SlopPackageError.missing("manifest.json") }
        manifestData = try Data(contentsOf: manifestURL)
        metadata = try JSONDecoder().decode(SlopManifestMetadata.self, from: manifestData)
        guard metadata.format == "hitslop/1", metadata.runtime == "web" else { throw SlopPackageError.invalid("unsupported format") }
        guard FileManager.default.fileExists(atPath: entryURL.path) else { throw SlopPackageError.missing("build/index.html") }
        for store in metadata.stores {
            guard Self.isSafeRelativePath(store.path) else { throw SlopPackageError.invalid("unsafe store path \(store.path)") }
            guard FileManager.default.fileExists(atPath: rootURL.appendingPathComponent(store.path).path) else { throw SlopPackageError.missing(store.path) }
        }
    }

    public var entryURL: URL { rootURL.appendingPathComponent("build/index.html") }
    public var styleURL: URL { rootURL.appendingPathComponent("style.css") }
    public func store(id: String, kind: SlopStoreMetadata.Kind) throws -> URL {
        guard let store = metadata.stores.first(where: { $0.id == id && $0.kind == kind }) else { throw SlopPackageError.invalid("unknown \(kind.rawValue) store \(id)") }
        return rootURL.appendingPathComponent(store.path)
    }
    public static func isSafeRelativePath(_ path: String) -> Bool { !path.hasPrefix("/") && !path.split(separator: "/").contains("..") && !path.isEmpty }
}

public struct SlopManifestMetadata: Codable, Sendable {
    public let format: String; public let runtime: String; public let slug: String; public let title: String; public let description: String; public let author: SlopAuthorMetadata
    public let categories: [String]; public let tags: [String]?; public let stores: [SlopStoreMetadata]; public let window: SlopWindowMetadata
}
public struct SlopAuthorMetadata: Codable, Sendable { public let name: String; public let url: URL? }
public struct SlopStoreMetadata: Codable, Sendable {
    public enum Kind: String, Codable, Sendable { case json, sqlite }
    public let id: String; public let kind: Kind; public let path: String; public let maxBytes: Int?
}
public struct SlopWindowMetadata: Codable, Sendable { public let width: Int; public let height: Int; public let resizable: Bool? }

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
