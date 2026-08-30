import CryptoKit
import Foundation
import ImageIO
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
        let fileManager = FileManager.default
        let root = rootURL.standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard root.pathExtension.lowercased() == "slop" else { throw SlopPackageError.invalid("document must have a .slop extension") }
        guard fileManager.fileExists(atPath: root.path, isDirectory: &isDirectory), isDirectory.boolValue else { throw SlopPackageError.invalid("document is not a directory") }
        self.rootURL = root
        let manifestURL = root.appendingPathComponent("manifest.json")
        guard FileManager.default.fileExists(atPath: manifestURL.path) else { throw SlopPackageError.missing("manifest.json") }
        manifestData = try Data(contentsOf: manifestURL)
        guard String(data: manifestData, encoding: .utf8) != nil else { throw SlopPackageError.invalid("manifest.json must be UTF-8") }
        manifest = try JSONDecoder().decode(SlopManifest.self, from: manifestData)
        guard manifest.slug.range(of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#, options: .regularExpression) != nil, (2...64).contains(manifest.slug.count) else { throw SlopPackageError.invalid("invalid slug") }
        guard (1...80).contains(manifest.title.count), (1...240).contains(manifest.description.count), (1...80).contains(manifest.author.name.count) else { throw SlopPackageError.invalid("invalid catalog metadata") }
        if let authorURL = manifest.author.url { guard let url = URL(string: authorURL), url.scheme != nil else { throw SlopPackageError.invalid("invalid author URL") } }
        guard (1...2).contains(manifest.categories.count), Set(manifest.categories).count == manifest.categories.count,
              manifest.categories.allSatisfy({ (1...40).contains($0.count) }) else { throw SlopPackageError.invalid("categories must contain one or two unique values") }
        if let tags = manifest.tags {
            guard tags.count <= 8, Set(tags).count == tags.count, tags.allSatisfy({ (1...32).contains($0.count) }) else { throw SlopPackageError.invalid("tags must be unique") }
        }
        if let document = manifest.document {
            guard UUID(uuidString: document.id) != nil else { throw SlopPackageError.invalid("document id must be a UUID") }
            if let template = document.template {
                guard (16...64).contains(template.publisherKeyID.count), template.release > 0,
                      template.artifactSha256.range(of: #"^[a-f0-9]{64}$"#, options: .regularExpression) != nil else {
                    throw SlopPackageError.invalid("invalid template lineage")
                }
            }
        }
        guard (240...4096).contains(manifest.window.width), (180...4096).contains(manifest.window.height) else { throw SlopPackageError.invalid("window dimensions are out of bounds") }
        switch manifest.window.shape.kind {
        case .circle:
            guard manifest.window.width == manifest.window.height else { throw SlopPackageError.invalid("circle windows must have equal width and height") }
            guard manifest.window.shape.path == nil, manifest.window.shape.radius == nil else { throw SlopPackageError.invalid("circle does not accept path or radius") }
        case .capsule:
            guard manifest.window.shape.path == nil, manifest.window.shape.radius == nil else { throw SlopPackageError.invalid("capsule does not accept path or radius") }
        case .roundedRect:
            guard manifest.window.shape.path == nil, let radius = manifest.window.shape.radius, (0...256).contains(radius) else { throw SlopPackageError.invalid("roundedRect requires only a valid radius") }
        case .imageMask:
            guard manifest.window.resizable == false, manifest.window.shape.radius == nil, let path = manifest.window.shape.path else { throw SlopPackageError.invalid("imageMask requires a path and resizable false") }
            guard path.hasPrefix("assets/"), path.lowercased().hasSuffix(".png") else { throw SlopPackageError.invalid("imageMask must reference a PNG under assets/") }
            let url = try Self.containedURL(root: root, relativePath: path)
            let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true else { throw SlopPackageError.invalid("window image mask must be a regular file") }
            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), CGImageSourceGetType(source) as String? == "public.png", let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw SlopPackageError.invalid("window image mask must be a valid PNG") }
            guard image.width == manifest.window.width, image.height == manifest.window.height else { throw SlopPackageError.invalid("window image mask must be exactly \(manifest.window.width)x\(manifest.window.height) pixels") }
            guard ![.none, .noneSkipFirst, .noneSkipLast].contains(image.alphaInfo) else { throw SlopPackageError.invalid("window image mask must contain alpha") }
        }
        guard FileManager.default.fileExists(atPath: entryURL.path) else { throw SlopPackageError.missing("app.html") }
        guard String(data: try Data(contentsOf: entryURL), encoding: .utf8) != nil else { throw SlopPackageError.invalid("app.html must be UTF-8") }
        let topLevel = try fileManager.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        if let legacy = topLevel.first(where: { $0.lastPathComponent == "document.json" || $0.lastPathComponent == "build" }) {
            throw SlopPackageError.invalid("legacy runtime entry \(legacy.lastPathComponent) is not supported")
        }
        if let rootStore = topLevel.first(where: { $0.lastPathComponent != "manifest.json" && ["json", "sqlite"].contains($0.pathExtension.lowercased()) }) {
            throw SlopPackageError.invalid("stores must live under stores/: \(rootStore.lastPathComponent)")
        }
        let allowedTopLevel = Set(["manifest.json", "app.html", "style.css", "assets", "stores", "QuickLook", "AGENTS.md", "Icon\r"])
        if let unknown = topLevel.first(where: { !allowedTopLevel.contains($0.lastPathComponent) }) {
            throw SlopPackageError.invalid("unexpected runtime entry \(unknown.lastPathComponent)")
        }
        let forbidden = Set(["package.json", "bun.lock", "bun.lockb", "node_modules", "source", "src", "build", "document.json", ".build", ".hitslop"])
        if let enumerator = fileManager.enumerator(at: root, includingPropertiesForKeys: [.isSymbolicLinkKey]) {
            for case let url as URL in enumerator {
                guard try url.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw SlopPackageError.invalid("runtime documents cannot contain symlinks") }
                if forbidden.contains(url.lastPathComponent.lowercased()) { throw SlopPackageError.invalid("runtime documents cannot contain \(url.lastPathComponent)") }
            }
        }
        guard manifest.stores.count <= 16 else { throw SlopPackageError.invalid("too many stores") }
        for (id, store) in manifest.stores {
            guard id.range(of: #"^[a-z][a-z0-9-]{0,31}$"#, options: .regularExpression) != nil else { throw SlopPackageError.invalid("invalid store id \(id)") }
            let path = Self.storePath(id: id, kind: store.kind)
            let storeURL = try Self.containedURL(root: root, relativePath: path)
            guard fileManager.fileExists(atPath: storeURL.path) else { throw SlopPackageError.missing(path) }
            let values = try storeURL.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true else { throw SlopPackageError.invalid("store must be a regular file: \(path)") }
            if let maxBytes = store.maxBytes { guard maxBytes > 0, maxBytes <= 1_073_741_824 else { throw SlopPackageError.invalid("invalid maxBytes") } }
            if store.kind == .json {
                let data = try Data(contentsOf: storeURL)
                if let maxBytes = store.maxBytes, data.count > maxBytes { throw SlopPackageError.invalid("store exceeds maxBytes: \(path)") }
                _ = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
            } else if let maxBytes = store.maxBytes {
                let size = [storeURL.path, storeURL.path + "-wal"].reduce(0) { total, path in
                    total + (((try? fileManager.attributesOfItem(atPath: path)[.size]) as? NSNumber)?.intValue ?? 0)
                }
                if size > maxBytes { throw SlopPackageError.invalid("store exceeds maxBytes: \(path)") }
            }
        }
    }

    public var entryURL: URL { rootURL.appendingPathComponent("app.html") }
    public var styleURL: URL { rootURL.appendingPathComponent("style.css") }
    public var previewURL: URL { rootURL.appendingPathComponent("QuickLook/Preview.png") }
    public var thumbnailURL: URL { rootURL.appendingPathComponent("QuickLook/Thumbnail.png") }
    public func imageMaskURL() throws -> URL? {
        guard manifest.window.shape.kind == .imageMask, let path = manifest.window.shape.path else { return nil }
        return try Self.containedURL(root: rootURL, relativePath: path)
    }
    public func store(id: String, kind: SlopStoreKind) throws -> URL {
        guard manifest.stores[id]?.kind == kind else { throw SlopPackageError.invalid("unknown \(kind.rawValue) store \(id)") }
        return try Self.containedURL(root: rootURL, relativePath: Self.storePath(id: id, kind: kind))
    }
    public func storeRecord(id: String, kind: SlopStoreKind) throws -> SlopStore {
        guard let store = manifest.stores[id], store.kind == kind else { throw SlopPackageError.invalid("unknown \(kind.rawValue) store \(id)") }
        return store
    }

    public static func storePath(id: String, kind: SlopStoreKind) -> String {
        "stores/\(id).\(kind == .json ? "json" : "sqlite")"
    }

    /// Host-side containment check. Schema/publish validation is the authoring gate; this keeps a hand-edited package from walking out of the bundle.
    public static func isSafeRelativePath(_ path: String) -> Bool {
        !path.hasPrefix("/") && !path.split(separator: "/").contains("..") && !path.isEmpty
    }

    public static func containedURL(root: URL, relativePath: String) throws -> URL {
        guard isSafeRelativePath(relativePath) else { throw SlopPackageError.invalid("unsafe path \(relativePath)") }
        let root = root.standardizedFileURL.resolvingSymlinksInPath()
        let url = root.appendingPathComponent(relativePath).standardizedFileURL.resolvingSymlinksInPath()
        let rootPath = root.path
        let prefix = rootPath.hasSuffix("/") ? rootPath : rootPath + "/"
        guard url.path == rootPath || url.path.hasPrefix(prefix) else { throw SlopPackageError.invalid("unsafe path \(relativePath)") }
        return url
    }

    public func assetURL(path: String) throws -> URL {
        let relative = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard relative == "style.css" || relative.hasPrefix("assets/") else { throw SlopPackageError.invalid("resource is not guest-readable: \(path)") }
        return try Self.containedURL(root: rootURL, relativePath: relative)
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
        let temporary = destination.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).slop", isDirectory: true)
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        do {
            for entry in archive { _ = try archive.extract(entry, to: temporary.appendingPathComponent(entry.path)) }
            _ = try SlopPackage(rootURL: temporary)
            if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
            try FileManager.default.moveItem(at: temporary, to: destination)
        } catch { try? FileManager.default.removeItem(at: temporary); throw error }
    }
}
