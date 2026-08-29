import Foundation

public enum SlopHostError: LocalizedError, Equatable {
    case invalidPackage(String)
    case sqlite(String)
    case invalidBridgeValue(String)
    case json(String)

    public var errorDescription: String? {
        switch self {
        case .invalidPackage(let message): message
        case .sqlite(let message): "SQLite: \(message)"
        case .invalidBridgeValue(let message): message
        case .json(let message): "JSON: \(message)"
        }
    }
}

public struct SlopManifest: Codable, Equatable, Sendable {
    public static let supportedFormat = "slop-web/1"

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
    public var window: Window
    public var stores: [Store]
}

public struct SlopPackage: Sendable {
    public let rootURL: URL
    public let manifestURL: URL
    public let manifest: SlopManifest
    public let entryURL: URL
    public let styleURL: URL

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
        guard Set(manifest.stores.map(\.id)).count == manifest.stores.count,
              manifest.stores.allSatisfy({ !$0.id.isEmpty })
        else {
            throw SlopHostError.invalidPackage("Store identifiers must be non-empty and unique")
        }

        let entry = try Self.resolve(relativePath: "build/index.html", inside: root)
        guard FileManager.default.fileExists(atPath: entry.path) else {
            throw SlopHostError.invalidPackage("Missing entry file: build/index.html")
        }
        for forbidden in ["source", "package.json", "package-lock.json", "node_modules", "vite.config.js", "vite.config.ts"] {
            guard !FileManager.default.fileExists(atPath: root.appendingPathComponent(forbidden).path) else {
                throw SlopHostError.invalidPackage("Runtime packages must not contain authoring files: \(forbidden)")
            }
        }
        let styleURL = try Self.resolve(relativePath: "style.css", inside: root)
        guard styleURL.pathExtension.lowercased() == "css",
              FileManager.default.fileExists(atPath: styleURL.path)
        else {
            throw SlopHostError.invalidPackage("Missing document stylesheet: style.css")
        }
        let styleData = try Data(contentsOf: styleURL)
        guard styleData.count <= 512 * 1_024,
              String(data: styleData, encoding: .utf8) != nil
        else {
            throw SlopHostError.invalidPackage("style.css must be UTF-8 CSS no larger than 512 KiB")
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
        self.styleURL = styleURL
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

    public func documentAssetURL(path: String) throws -> URL {
        let relative = String(path.drop(while: { $0 == "/" }))
        guard relative.hasPrefix("assets/") else {
            throw SlopHostError.invalidPackage("Unknown host-runtime resource: \(path)")
        }
        return try Self.resolve(relativePath: relative, inside: rootURL)
    }

    private static func resolve(relativePath: String, inside root: URL) throws -> URL {
        guard !relativePath.isEmpty,
              !relativePath.hasPrefix("/"),
              !relativePath.contains("\\")
        else {
            throw SlopHostError.invalidPackage("Package paths must be non-empty relative POSIX paths: \(relativePath.debugDescription)")
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
