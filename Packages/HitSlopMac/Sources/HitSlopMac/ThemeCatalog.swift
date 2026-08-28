import Foundation
import SlopCore

struct SlopThemeManifest: Codable, Sendable {
    static let format = "slop-theme/1"

    struct Preview: Codable, Sendable {
        let colors: [String]
    }

    let format: String
    let id: String
    let displayName: String
    let version: String
    let summary: String
    let preview: Preview
}

struct SlopThemeDescriptor: Identifiable, Sendable {
    let id: String
    let packageURL: URL?
    let manifest: SlopThemeManifest
    let css: Data

    var displayName: String { manifest.displayName }
    var colors: [String] { manifest.preview.colors }

    static let `default` = SlopThemeDescriptor(
        id: "default",
        packageURL: nil,
        manifest: SlopThemeManifest(
            format: SlopThemeManifest.format,
            id: "default",
            displayName: "Default",
            version: "1.0.0",
            summary: "Use the mini app's authored appearance.",
            preview: .init(colors: ["#f4f0e5", "#292720", "#a74332", "#8d887b"])
        ),
        css: Data("/* Default document theme. */\n".utf8)
    )
}

enum SlopThemeCatalog {
    static func all() -> [SlopThemeDescriptor] {
        var result = [SlopThemeDescriptor.default]
        if let root = Bundle.module.resourceURL?.appendingPathComponent("Themes") {
            result.append(contentsOf: load(from: root))
        }
        result.append(contentsOf: load(from: userDirectory))
        var seen = Set<String>()
        return result.filter { seen.insert($0.id).inserted }
    }

    static var userDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("hitSlop/Themes", isDirectory: true)
    }

    static func apply(_ theme: SlopThemeDescriptor, to packageURL: URL) throws {
        var manifest = try SlopManifestIO.read(from: packageURL)
        let stylesheetURL = packageURL.appendingPathComponent(manifest.appearance.stylesheet)
        try theme.css.write(to: stylesheetURL, options: .atomic)
        manifest.appearance.themeID = theme.id
        try SlopManifestIO.write(manifest, to: packageURL)
    }

    static func saveCurrentTheme(from packageURL: URL, displayName: String) throws -> URL {
        let cleanName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else {
            throw SlopHostError.invalidPackage("Theme name must not be empty")
        }
        try FileManager.default.createDirectory(at: userDirectory, withIntermediateDirectories: true)
        let id = cleanName.lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        guard !id.isEmpty else {
            throw SlopHostError.invalidPackage("Theme name must include at least one letter or number")
        }
        let destination = userDirectory.appendingPathComponent("\(id).sloptheme", isDirectory: true)
        guard !FileManager.default.fileExists(atPath: destination.path) else {
            throw SlopHostError.invalidPackage("A theme named \(cleanName) already exists")
        }
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        let package = try SlopPackage(rootURL: packageURL)
        try FileManager.default.copyItem(
            at: package.themeURL,
            to: destination.appendingPathComponent("theme.css")
        )
        let themeManifest = SlopThemeManifest(
            format: SlopThemeManifest.format,
            id: id,
            displayName: cleanName,
            version: "1.0.0",
            summary: "Saved from \(package.manifest.title).",
            preview: .init(colors: ["#f4f0e5", "#292720", "#a74332", "#8d887b"])
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        var data = try encoder.encode(themeManifest)
        data.append(0x0A)
        try data.write(to: destination.appendingPathComponent("manifest.json"), options: .atomic)
        return destination
    }

    private static func load(from directory: URL) -> [SlopThemeDescriptor] {
        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return urls.filter { $0.pathExtension == "sloptheme" }.compactMap { url in
            guard let manifestData = try? Data(contentsOf: url.appendingPathComponent("manifest.json")),
                  let manifest = try? JSONDecoder().decode(SlopThemeManifest.self, from: manifestData),
                  manifest.format == SlopThemeManifest.format,
                  manifest.preview.colors.count >= 3,
                  let css = try? Data(contentsOf: url.appendingPathComponent("theme.css")),
                  css.count <= 512 * 1_024,
                  String(data: css, encoding: .utf8) != nil
            else { return nil }
            return SlopThemeDescriptor(id: manifest.id, packageURL: url, manifest: manifest, css: css)
        }.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }
}
