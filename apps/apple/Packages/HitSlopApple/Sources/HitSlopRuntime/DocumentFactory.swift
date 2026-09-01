import Foundation
import HitSlopCore

@MainActor public struct DocumentFactory: Sendable {
    public let catalogURL: URL
    public let templatesRoot: URL

    public init(catalogURL: URL, templatesRoot: URL = DocumentFactory.defaultTemplatesRoot) {
        self.catalogURL = catalogURL
        self.templatesRoot = templatesRoot
    }

    public static var defaultTemplatesRoot: URL {
        #if os(macOS)
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/templates", isDirectory: true)
        #else
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("hitSlop/templates", isDirectory: true)
        #endif
    }

    public func isManagedTemplatePackage(_ url: URL) -> Bool {
        Self.isManagedTemplatePackage(url, templatesRoot: templatesRoot)
    }

    /// Catalog masters live under the templates root. Resolve POSIX symlinks so
    /// a link outside the tree cannot open one as a document.
    public static func isManagedTemplatePackage(_ url: URL, templatesRoot: URL = defaultTemplatesRoot) -> Bool {
        let candidate = url.standardizedFileURL.resolvingSymlinksInPath().pathComponents
        let root = templatesRoot.standardizedFileURL.resolvingSymlinksInPath().pathComponents
        guard candidate.count > root.count else { return false }
        return zip(root, candidate).allSatisfy { $0.caseInsensitiveCompare($1) == .orderedSame }
    }

    @discardableResult public func create(from template: SlopRemoteTemplate, at destination: URL) async throws -> Bool {
        let cached = templatesRoot.appendingPathComponent("cache/\(template.publisherKeyID)/\(template.slug)/\(template.release).slop", isDirectory: true)
        var downloaded = false
        if (try? SlopPackage(rootURL: cached)) == nil {
            try FileManager.default.createDirectory(at: cached.deletingLastPathComponent(), withIntermediateDirectories: true)
            var components = URLComponents(url: catalogURL.appendingPathComponent("api/artifact"), resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "key", value: template.artifactKey)]
            let (archive, response) = try await URLSession.shared.download(from: components.url!)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw SlopPackageError.invalid("template download failed") }
            downloaded = true
            try SlopArchive.extract(archive, to: cached, expectedSHA256: template.artifactSha256)
        }
        try SlopPackage(rootURL: cached).validateAsTemplate()
        try SlopDuplicator.makeImmutable(cached)
        try SlopDuplicator.duplicate(from: cached, to: destination)
        return downloaded
    }

    public func create(fromLocalPackage packageURL: URL, at destination: URL) throws {
        try SlopPackage(rootURL: packageURL).validateAsTemplate()
        try SlopDuplicator.duplicate(from: packageURL, to: destination)
    }
}
