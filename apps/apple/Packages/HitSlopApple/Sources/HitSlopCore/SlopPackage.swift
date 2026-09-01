import CryptoKit
import DynamicJSON
import Foundation
import ImageIO
import ZIPFoundation

public enum SlopPackageError: LocalizedError {
    case missing(String), invalid(String), unsafeArchive(String)
    public var errorDescription: String? {
        switch self { case .missing(let value): "Missing \(value)"; case .invalid(let value): "Invalid hitSlop package: \(value)"; case .unsafeArchive(let value): "Unsafe archive entry: \(value)" }
    }
}

public enum SlopStoreKind: String, Sendable { case json, sqlite, media }

public struct SlopPackage: Sendable {
    public let rootURL: URL
    public let manifestData: Data
    public let manifest: SlopManifest

    public init(rootURL: URL) throws {
        let fileManager = FileManager.default
        let root = rootURL.standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard root.pathExtension.lowercased() == "slop" else { throw SlopPackageError.invalid("document must have a .slop extension") }
        guard fileManager.fileExists(atPath: root.path, isDirectory: &isDirectory), isDirectory.boolValue else { throw SlopPackageError.invalid("document is not a directory") }
        self.rootURL = root
        let manifestURL = root.appendingPathComponent("manifest.json")
        guard fileManager.fileExists(atPath: manifestURL.path) else { throw SlopPackageError.missing("manifest.json") }
        manifestData = try Data(contentsOf: manifestURL)
        try Self.validateManifest(manifestData)
        manifest = try JSONDecoder().decode(SlopManifest.self, from: manifestData)

        guard fileManager.fileExists(atPath: entryURL.path) else { throw SlopPackageError.missing("app.html") }
        guard String(data: try Data(contentsOf: entryURL), encoding: .utf8) != nil else { throw SlopPackageError.invalid("app.html must be UTF-8") }
        let topLevel = try fileManager.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        let allowedTopLevel = Set(["manifest.json", "app.html", "assets", "stores", "QuickLook", "Icon\r"])
        if let unknown = topLevel.first(where: { !allowedTopLevel.contains($0.lastPathComponent) }) { throw SlopPackageError.invalid("unexpected runtime entry \(unknown.lastPathComponent)") }
        let forbidden = Set(["package.json", "bun.lock", "bun.lockb", "node_modules", "source", "src", "build", "document.json", ".build", ".hitslop", "style.css"])
        if let enumerator = fileManager.enumerator(at: root, includingPropertiesForKeys: [.isSymbolicLinkKey]) {
            for case let url as URL in enumerator {
                guard try url.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw SlopPackageError.invalid("runtime documents cannot contain symlinks") }
                if forbidden.contains(url.lastPathComponent.lowercased()) { throw SlopPackageError.invalid("runtime documents cannot contain \(url.lastPathComponent)") }
            }
        }
        try validateStores()
        try validateQuickLook()
        _ = try skinURL()
    }

    public var entryURL: URL { rootURL.appendingPathComponent("app.html") }
    public var previewURL: URL { rootURL.appendingPathComponent("QuickLook/Preview.png") }
    public var thumbnailURL: URL { rootURL.appendingPathComponent("QuickLook/Thumbnail.png") }
    public var storesURL: URL { rootURL.appendingPathComponent("stores", isDirectory: true) }
    public var jsonStoreURL: URL { storesURL.appendingPathComponent("data.json") }
    public var sqliteStoreURL: URL { storesURL.appendingPathComponent("data.sqlite") }
    public var mediaStoresURL: URL { storesURL.appendingPathComponent("media", isDirectory: true) }
    public var isSkinned: Bool { manifest.presentation.skin != nil }
    public var usesTransparentBackground: Bool { isSkinned || manifest.presentation.background == .transparent }
    public var isResizable: Bool { isSkinned ? false : manifest.presentation.resizable ?? true }
    public var shape: Shape { manifest.presentation.shape ?? .rounded }

    public func skinURL() throws -> URL? {
        guard let path = manifest.presentation.skin else { return nil }
        let url = try Self.containedURL(root: rootURL, relativePath: path)
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true else { throw SlopPackageError.invalid("window skin must be a regular file") }
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), CGImageSourceGetType(source) as String? == "public.png", let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw SlopPackageError.invalid("window skin must be a valid PNG") }
        guard image.width == manifest.presentation.width, image.height == manifest.presentation.height else { throw SlopPackageError.invalid("window skin must be exactly \(manifest.presentation.width)x\(manifest.presentation.height) pixels") }
        guard image.colorSpace?.model == .rgb else { throw SlopPackageError.invalid("window skin must be an RGBA PNG") }
        guard ![.none, .noneSkipFirst, .noneSkipLast].contains(image.alphaInfo) else { throw SlopPackageError.invalid("window skin must contain alpha") }
        return url
    }

    public func storeURL(kind: SlopStoreKind) -> URL {
        switch kind { case .json: jsonStoreURL; case .sqlite: sqliteStoreURL; case .media: mediaStoresURL }
    }

    public func validateAsTemplate(requirePreview: Bool = true) throws {
        if FileManager.default.fileExists(atPath: storesURL.path) { throw SlopPackageError.invalid("templates cannot contain stores") }
        if FileManager.default.fileExists(atPath: rootURL.appendingPathComponent("Icon\r").path) { throw SlopPackageError.invalid("templates cannot contain a Finder custom icon") }
        if requirePreview {
            for url in [previewURL, thumbnailURL] {
                let relativePath = "QuickLook/\(url.lastPathComponent)"
                guard FileManager.default.fileExists(atPath: url.path) else { throw SlopPackageError.missing(relativePath) }
                let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
                guard values.isRegularFile == true, (values.fileSize ?? 0) <= 5 * 1024 * 1024,
                      let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                      CGImageSourceGetType(source) as String? == "public.png",
                      CGImageSourceCreateImageAtIndex(source, 0, nil) != nil else {
                    throw SlopPackageError.invalid("\(relativePath) must be a PNG no larger than 5 MB")
                }
            }
        }
    }

    public static func isSafeRelativePath(_ path: String) -> Bool {
        !path.hasPrefix("/") && !path.contains("\\") && !path.split(separator: "/").contains("..") && !path.isEmpty
    }

    public static func containedURL(root: URL, relativePath: String) throws -> URL {
        guard isSafeRelativePath(relativePath) else { throw SlopPackageError.invalid("unsafe path \(relativePath)") }
        let root = root.standardizedFileURL.resolvingSymlinksInPath()
        let url = root.appendingPathComponent(relativePath).standardizedFileURL.resolvingSymlinksInPath()
        let prefix = root.path.hasSuffix("/") ? root.path : root.path + "/"
        guard url.path == root.path || url.path.hasPrefix(prefix) else { throw SlopPackageError.invalid("unsafe path \(relativePath)") }
        return url
    }

    public func assetURL(path: String) throws -> URL {
        let relative = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard relative.hasPrefix("assets/") else { throw SlopPackageError.invalid("resource is not guest-readable: \(path)") }
        return try Self.containedURL(root: rootURL, relativePath: relative)
    }

    public func mediaURL(name: String) throws -> URL { try SlopMediaStore(directoryURL: mediaStoresURL).url(for: name) }

    private static func validateManifest(_ data: Data) throws {
        guard String(data: data, encoding: .utf8) != nil else { throw SlopPackageError.invalid("manifest.json must be UTF-8") }
        guard let schemaURL = Bundle.module.url(forResource: "manifest.schema", withExtension: "json") else { throw SlopPackageError.invalid("bundled manifest schema is missing") }
        let schema = try JSONSchema(data: Data(contentsOf: schemaURL))
        let result = try JSON(data: data).validate(with: schema)
        guard result.isValid else { throw SlopPackageError.invalid("manifest.json does not match v1 schema: \(result)") }
    }

    private func validateStores() throws {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: storesURL.path) else { return }
        let allowed = Set(["data.json", "data.sqlite", "data.sqlite-wal", "data.sqlite-shm", "media"])
        for url in try fileManager.contentsOfDirectory(at: storesURL, includingPropertiesForKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey]) {
            guard allowed.contains(url.lastPathComponent) else { throw SlopPackageError.invalid("unexpected store file \(url.lastPathComponent)") }
            let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey])
            if url.lastPathComponent == "media" {
                guard values.isDirectory == true, values.isSymbolicLink != true else { throw SlopPackageError.invalid("media store must be a directory") }
                _ = try SlopMediaStore(directoryURL: url).directoryRevision()
            } else {
                guard values.isRegularFile == true, values.isSymbolicLink != true else { throw SlopPackageError.invalid("store must be a regular file: \(url.lastPathComponent)") }
            }
        }
        if fileManager.fileExists(atPath: jsonStoreURL.path) { _ = try JSONSerialization.jsonObject(with: Data(contentsOf: jsonStoreURL), options: [.fragmentsAllowed]) }
    }

    private func validateQuickLook() throws {
        let directory = rootURL.appendingPathComponent("QuickLook", isDirectory: true)
        guard FileManager.default.fileExists(atPath: directory.path) else { return }
        let allowed = Set(["Preview.png", "Thumbnail.png"])
        for url in try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) where !allowed.contains(url.lastPathComponent) {
            throw SlopPackageError.invalid("unexpected QuickLook entry \(url.lastPathComponent)")
        }
    }
}

public enum SlopArchive {
    public static func sha256(of data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    public static func extract(_ archiveURL: URL, to destination: URL, expectedSHA256: String? = nil) throws {
        let data = try Data(contentsOf: archiveURL)
        guard data.count <= 25 * 1024 * 1024 else { throw SlopPackageError.invalid("artifact exceeds 25 MB") }
        if let expectedSHA256, sha256(of: data) != expectedSHA256 { throw SlopPackageError.invalid("artifact checksum mismatch") }
        let archive = try Archive(url: archiveURL, accessMode: .read)
        var total: UInt64 = 0, count = 0
        for entry in archive {
            count += 1; guard count <= 256 else { throw SlopPackageError.invalid("archive contains more than 256 entries") }
            guard Self.safe(entry) else { throw SlopPackageError.unsafeArchive(entry.path) }
            guard entry.uncompressedSize <= 25 * 1024 * 1024 else { throw SlopPackageError.invalid("archive entry exceeds 25 MB") }
            total += entry.uncompressedSize; guard total <= 50 * 1024 * 1024 else { throw SlopPackageError.invalid("archive expands beyond 50 MB") }
        }
        let temporary = destination.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).slop", isDirectory: true)
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        do {
            for entry in archive { _ = try archive.extract(entry, to: temporary.appendingPathComponent(entry.path)) }
            let package = try SlopPackage(rootURL: temporary); try package.validateAsTemplate()
            if FileManager.default.fileExists(atPath: destination.path) {
                try SlopDuplicator.makeWritable(destination)
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.moveItem(at: temporary, to: destination)
            try SlopDuplicator.makeImmutable(destination)
        } catch { try? FileManager.default.removeItem(at: temporary); throw error }
    }

    private static func safe(_ entry: Entry) -> Bool { SlopPackage.isSafeRelativePath(entry.path) && entry.path.count <= 240 && entry.type != .symlink }
}
