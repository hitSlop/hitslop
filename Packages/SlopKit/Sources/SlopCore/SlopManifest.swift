import CryptoKit
import Foundation

public enum SlopHostError: LocalizedError, Equatable {
    case invalidPackage(String)
    case sqlite(String)
    case invalidBridgeValue(String)
    case json(String)
    case build(String)

    public var errorDescription: String? {
        switch self {
        case .invalidPackage(let message): message
        case .sqlite(let message): "SQLite: \(message)"
        case .invalidBridgeValue(let message): message
        case .json(let message): "JSON: \(message)"
        case .build(let message): "Build: \(message)"
        }
    }
}

public struct SlopManifest: Codable, Equatable, Sendable {
    public static let supportedFormat = "slop-wasm/1"
    public static let hostRuntime = "elementary-ui-0.7/slop-runtime-1"

    public struct Window: Codable, Equatable, Sendable {
        public var width: Double
        public var height: Double
        public var shape: WindowShape
    }

    public struct WindowShape: Codable, Equatable, Sendable {
        public enum Kind: String, Codable, Equatable, Sendable {
            case roundedRect
            case capsule
            case circle
        }

        public var kind: Kind
        public var radius: Double?

        public init(kind: Kind, radius: Double? = nil) {
            self.kind = kind
            self.radius = radius
        }
    }

    public struct Catalog: Codable, Equatable, Sendable {
        public var summary: String
        public var categories: [String]
        public var tags: [String]
    }

    public struct Appearance: Codable, Equatable, Sendable {
        public var stylesheet: String
        public var themeID: String
    }

    public struct Source: Codable, Equatable, Sendable {
        public var path: String
        public var files: [String]
    }

    public struct Artifact: Codable, Equatable, Sendable {
        public var entry: String
        public var sourceHash: String
        public var artifactHash: String
    }

    public enum StoreKind: String, Codable, Equatable, Sendable {
        case json
        case sqlite
    }

    public struct Store: Codable, Equatable, Sendable {
        public var id: String
        public var kind: StoreKind
        public var path: String
        public var maxBytes: Int?
    }

    public var format: String
    public var id: String
    public var title: String
    public var catalog: Catalog
    public var runtime: String
    public var dependencies: [String]
    public var window: Window
    public var appearance: Appearance
    public var source: Source
    public var artifact: Artifact
    public var stores: [Store]
}

public struct SlopPackage: Sendable {
    public let rootURL: URL
    public let manifestURL: URL
    public let manifest: SlopManifest
    public let entryURL: URL
    public let webRootURL: URL
    public let sourceRootURL: URL
    public let sourceURLs: [URL]
    public let styleURL: URL?
    public let themeURL: URL

    public init(rootURL: URL) throws {
        let root = rootURL.standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard root.pathExtension.lowercased() == "slop",
              FileManager.default.fileExists(atPath: root.path, isDirectory: &isDirectory),
              isDirectory.boolValue
        else {
            throw SlopHostError.invalidPackage("Expected a .slop package directory at \(root.path)")
        }

        let manifestURL = root.appendingPathComponent("manifest.json")
        let manifest: SlopManifest
        do {
            manifest = try JSONDecoder().decode(SlopManifest.self, from: Data(contentsOf: manifestURL))
        } catch {
            throw SlopHostError.invalidPackage("Could not decode manifest.json: \(error.localizedDescription)")
        }

        guard manifest.format == SlopManifest.supportedFormat else {
            throw SlopHostError.invalidPackage("Unsupported format \(manifest.format)")
        }
        guard !manifest.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !manifest.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw SlopHostError.invalidPackage("Manifest id and title must not be empty")
        }
        guard manifest.runtime == SlopManifest.hostRuntime else {
            throw SlopHostError.invalidPackage("Unsupported runtime \(manifest.runtime)")
        }
        guard Set(manifest.dependencies).isSubset(of: ["slop-kit-0.1", "slop-kit-0.2"]) else {
            throw SlopHostError.invalidPackage("Manifest requests an unknown dependency")
        }
        guard manifest.window.width >= 320, manifest.window.height >= 320,
              manifest.window.width <= 2_400, manifest.window.height <= 2_400
        else {
            throw SlopHostError.invalidPackage("Manifest window dimensions are outside the supported range")
        }
        switch manifest.window.shape.kind {
        case .roundedRect:
            guard let radius = manifest.window.shape.radius,
                  radius >= 0,
                  radius <= min(manifest.window.width, manifest.window.height) / 2
            else {
                throw SlopHostError.invalidPackage("Rounded rectangle windows require a valid radius")
            }
        case .capsule:
            guard manifest.window.shape.radius == nil else {
                throw SlopHostError.invalidPackage("Capsule windows do not accept a radius")
            }
        case .circle:
            guard manifest.window.shape.radius == nil,
                  manifest.window.width == manifest.window.height
            else {
                throw SlopHostError.invalidPackage("Circle windows must be square and do not accept a radius")
            }
        }
        guard !manifest.catalog.summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !manifest.catalog.categories.isEmpty,
              manifest.catalog.categories.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
              manifest.catalog.tags.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
        else {
            throw SlopHostError.invalidPackage("Template catalog metadata must include a summary and categories")
        }
        guard !manifest.source.files.isEmpty, manifest.source.files.count <= 128 else {
            throw SlopHostError.invalidPackage("Manifest must declare between 1 and 128 source files")
        }
        guard Set(manifest.stores.map(\.id)).count == manifest.stores.count,
              manifest.stores.allSatisfy({ !$0.id.isEmpty })
        else {
            throw SlopHostError.invalidPackage("Store identifiers must be non-empty and unique")
        }

        let entry = try Self.resolve(relativePath: manifest.artifact.entry, inside: root)
        guard FileManager.default.fileExists(atPath: entry.path) else {
            throw SlopHostError.invalidPackage("Missing entry file: \(manifest.artifact.entry)")
        }
        if entry.pathExtension.lowercased() != "wasm" {
            throw SlopHostError.invalidPackage("Host runtime documents must declare a WASM artifact entry")
        }
        let sourceRoot = try Self.resolve(relativePath: manifest.source.path, inside: root)
        let sourceURLs = try manifest.source.files.map { file -> URL in
            guard file.hasSuffix(".swift") || file.hasSuffix(".css") else {
                throw SlopHostError.invalidPackage("Unsupported source file type: \(file)")
            }
            let url = try Self.resolve(relativePath: file, inside: sourceRoot)
            guard FileManager.default.fileExists(atPath: url.path) else {
                throw SlopHostError.invalidPackage("Missing source file: \(file)")
            }
            return url
        }
        for (path, url) in zip(manifest.source.files, sourceURLs) where path.hasSuffix(".swift") {
            let source = try String(contentsOf: url, encoding: .utf8)
            guard !source.contains("@main") else {
                throw SlopHostError.invalidPackage("Document source must not declare @main; the compiler injects the entry point")
            }
        }
        guard manifest.source.files.contains(where: { $0.hasSuffix(".swift") }) else {
            throw SlopHostError.invalidPackage("At least one Swift source file is required")
        }
        let themeURL = try Self.resolve(relativePath: manifest.appearance.stylesheet, inside: root)
        guard themeURL.pathExtension.lowercased() == "css",
              FileManager.default.fileExists(atPath: themeURL.path)
        else {
            throw SlopHostError.invalidPackage("Missing CSS appearance stylesheet: \(manifest.appearance.stylesheet)")
        }
        let themeData = try Data(contentsOf: themeURL)
        guard themeData.count <= 512 * 1_024,
              String(data: themeData, encoding: .utf8) != nil
        else {
            throw SlopHostError.invalidPackage("Appearance stylesheet must be UTF-8 CSS no larger than 512 KiB")
        }
        guard !manifest.appearance.themeID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw SlopHostError.invalidPackage("Appearance themeID must not be empty")
        }
        for store in manifest.stores {
            let url = try Self.resolve(relativePath: store.path, inside: root)
            guard FileManager.default.fileExists(atPath: url.path) else {
                throw SlopHostError.invalidPackage("Missing \(store.kind.rawValue) store: \(store.path)")
            }
        }

        self.rootURL = root
        self.manifestURL = manifestURL
        self.manifest = manifest
        self.entryURL = entry
        self.webRootURL = entry.deletingLastPathComponent().standardizedFileURL.resolvingSymlinksInPath()
        self.sourceRootURL = sourceRoot
        self.sourceURLs = sourceURLs
        self.styleURL = zip(manifest.source.files, sourceURLs).first(where: { $0.0 == "styles.css" })?.1
        self.themeURL = themeURL
    }

    public var usesHostRuntime: Bool { manifest.runtime == SlopManifest.hostRuntime }

    public var isSourceCurrent: Bool {
        (try? canonicalSourceHash()) == manifest.artifact.sourceHash
    }

    public var defaultSQLiteStoreID: String? {
        manifest.stores.first(where: { $0.kind == .sqlite })?.id
    }

    public var defaultJSONStoreID: String? {
        manifest.stores.first(where: { $0.kind == .json })?.id
    }

    public func store(id: String, kind: SlopManifest.StoreKind? = nil) throws -> SlopManifest.Store {
        guard let store = manifest.stores.first(where: { $0.id == id }), kind == nil || store.kind == kind else {
            throw SlopHostError.invalidBridgeValue("Unknown \(kind?.rawValue ?? "storage") store: \(id)")
        }
        return store
    }

    public func storeURL(id: String, kind: SlopManifest.StoreKind? = nil) throws -> URL {
        let descriptor = try store(id: id, kind: kind)
        return try Self.resolve(relativePath: descriptor.path, inside: rootURL)
    }

    public func webAssetURL(path: String) throws -> URL {
        let relative = path == "/" || path.isEmpty
            ? entryURL.lastPathComponent
            : String(path.drop(while: { $0 == "/" }))
        return try Self.resolve(relativePath: relative, inside: webRootURL)
    }

    public func documentAssetURL(path: String) throws -> URL {
        let relative = String(path.drop(while: { $0 == "/" }))
        guard relative.hasPrefix("assets/") else {
            throw SlopHostError.invalidPackage("Unknown host-runtime resource: \(path)")
        }
        return try Self.resolve(relativePath: relative, inside: rootURL)
    }

    public func canonicalSourceHash() throws -> String {
        var hasher = SHA256()
        hasher.update(data: Data(manifest.runtime.utf8))
        for dependency in manifest.dependencies.sorted() {
            hasher.update(data: Data(dependency.utf8))
        }
        for (path, url) in zip(manifest.source.files, sourceURLs).sorted(by: { $0.0 < $1.0 }) {
            hasher.update(data: Data(path.utf8))
            hasher.update(data: try Data(contentsOf: url))
        }
        return "sha256:" + hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    public static func hash(directory: URL) throws -> String {
        let files = try FileManager.default.subpathsOfDirectory(atPath: directory.path)
            .sorted()
            .filter { path in
                var isDirectory: ObjCBool = false
                return FileManager.default.fileExists(
                    atPath: directory.appendingPathComponent(path).path,
                    isDirectory: &isDirectory
                ) && !isDirectory.boolValue
            }
        var hasher = SHA256()
        for path in files {
            hasher.update(data: Data(path.utf8))
            hasher.update(data: try Data(contentsOf: directory.appendingPathComponent(path)))
        }
        return "sha256:" + hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private static func resolve(relativePath: String, inside root: URL) throws -> URL {
        guard !relativePath.isEmpty,
              !relativePath.hasPrefix("/"),
              !relativePath.contains("\\")
        else {
            throw SlopHostError.invalidPackage("Package paths must be non-empty relative POSIX paths")
        }
        let components = relativePath.split(separator: "/", omittingEmptySubsequences: false)
        guard !components.contains(".."), !components.contains(""),
              !components.contains(".build"), !components.contains("node_modules")
        else {
            throw SlopHostError.invalidPackage("Forbidden package path: \(relativePath)")
        }
        let candidate = root.appendingPathComponent(relativePath).standardizedFileURL.resolvingSymlinksInPath()
        let rootPath = root.standardizedFileURL.resolvingSymlinksInPath().path
        guard candidate.path == rootPath || candidate.path.hasPrefix(rootPath + "/") else {
            throw SlopHostError.invalidPackage("Package path escapes its allowed root: \(relativePath)")
        }
        return candidate
    }
}

public enum SlopManifestIO {
    public static func read(from packageURL: URL) throws -> SlopManifest {
        let url = packageURL.appendingPathComponent("manifest.json")
        return try JSONDecoder().decode(SlopManifest.self, from: Data(contentsOf: url))
    }

    public static func write(_ manifest: SlopManifest, to packageURL: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        var data = try encoder.encode(manifest)
        data.append(0x0A)
        try data.write(to: packageURL.appendingPathComponent("manifest.json"), options: .atomic)
    }
}

public enum SlopMIME {
    public static func type(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html": "text/html"
        case "js", "mjs": "text/javascript"
        case "css": "text/css"
        case "wasm": "application/wasm"
        case "json": "application/json"
        case "svg": "image/svg+xml"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "webp": "image/webp"
        case "woff2": "font/woff2"
        default: "application/octet-stream"
        }
    }
}
