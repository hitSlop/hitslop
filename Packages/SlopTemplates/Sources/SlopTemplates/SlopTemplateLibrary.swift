import Foundation
import SlopCore

public struct SlopCatalogItem: Identifiable, Sendable, Equatable {
    public let id: String
    public let url: URL
    public let title: String
    public let summary: String
    public let categories: [String]
    public let tags: [String]
    public let installed: Bool
}

public enum SlopTemplateLibrary {
    public static var bundledTemplatesDirectory: URL? {
        Bundle.module.resourceURL?.appendingPathComponent("Templates", isDirectory: true)
    }

    public static var bundledThemesDirectory: URL? {
        Bundle.module.resourceURL?.appendingPathComponent("Themes", isDirectory: true)
    }

    public static var userTemplatesDirectory: URL {
        applicationSupport.appendingPathComponent("Templates", isDirectory: true)
    }

    public static var userThemesDirectory: URL {
        applicationSupport.appendingPathComponent("Themes", isDirectory: true)
    }

    public static func bundledTemplateURLs() -> [URL] {
        packageURLs(in: bundledTemplatesDirectory, ext: "slop")
    }

    public static func bundledThemeURLs() -> [URL] {
        packageURLs(in: bundledThemesDirectory, ext: "sloptheme")
    }

    public static func allTemplates() -> [SlopCatalogItem] {
        var items: [SlopCatalogItem] = []
        var seen = Set<String>()
        for url in packageURLs(in: userTemplatesDirectory, ext: "slop") {
            guard let item = catalogItem(at: url, installed: true), seen.insert(item.id).inserted else { continue }
            items.append(item)
        }
        for url in bundledTemplateURLs() {
            guard let item = catalogItem(at: url, installed: false), seen.insert(item.id).inserted else { continue }
            items.append(item)
        }
        return items.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    public static func installTemplate(from sourceURL: URL) throws -> URL {
        let source = try SlopPackage(rootURL: sourceURL)
        try FileManager.default.createDirectory(at: userTemplatesDirectory, withIntermediateDirectories: true)
        let destination = userTemplatesDirectory.appendingPathComponent(sourceURL.lastPathComponent, isDirectory: true)
        if FileManager.default.fileExists(atPath: destination.path) {
            throw SlopHostError.invalidPackage("A template named \(sourceURL.lastPathComponent) is already installed")
        }
        try FileManager.default.copyItem(at: source.rootURL, to: destination)
        return destination
    }

    private static var applicationSupport: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("hitSlop", isDirectory: true)
    }

    private static func catalogItem(at url: URL, installed: Bool) -> SlopCatalogItem? {
        guard let package = try? SlopPackage(rootURL: url) else { return nil }
        return SlopCatalogItem(
            id: package.manifest.id,
            url: url,
            title: package.manifest.title,
            summary: package.manifest.catalog.summary,
            categories: package.manifest.catalog.categories,
            tags: package.manifest.catalog.tags,
            installed: installed
        )
    }

    private static func packageURLs(in directory: URL?, ext: String) -> [URL] {
        guard let directory,
              let urls = try? FileManager.default.contentsOfDirectory(
                  at: directory,
                  includingPropertiesForKeys: nil,
                  options: [.skipsHiddenFiles]
              )
        else { return [] }
        return urls.filter { $0.pathExtension.lowercased() == ext }.sorted {
            $0.lastPathComponent.localizedCaseInsensitiveCompare($1.lastPathComponent) == .orderedAscending
        }
    }
}
