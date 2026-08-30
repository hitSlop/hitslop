import Foundation
import HitSlopCore

public struct SlopRemoteTemplate: Sendable {
    public let publisherKeyID: String
    public let slug: String
    public let release: Int
    public let artifactKey: String
    public let artifactSha256: String

    public init(publisherKeyID: String, slug: String, release: Int, artifactKey: String, artifactSha256: String) {
        self.publisherKeyID = publisherKeyID
        self.slug = slug
        self.release = release
        self.artifactKey = artifactKey
        self.artifactSha256 = artifactSha256
    }
}

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

    @discardableResult public func create(from template: SlopRemoteTemplate, at destination: URL) async throws -> Bool {
        let cacheRoot = templatesRoot.appendingPathComponent("\(template.publisherKeyID)/\(template.slug)", isDirectory: true)
        let cached = cacheRoot.appendingPathComponent("releases/\(template.release).slop", isDirectory: true)
        var downloaded = false
        if (try? SlopPackage(rootURL: cached)) == nil {
            try FileManager.default.createDirectory(at: cached.deletingLastPathComponent(), withIntermediateDirectories: true)
            var components = URLComponents(url: catalogURL.appendingPathComponent("api/artifact"), resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "key", value: template.artifactKey)]
            let (archive, response) = try await URLSession.shared.download(from: components.url!)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw SlopPackageError.invalid("template download failed") }
            downloaded = true
            try SlopArchive.extract(archive, to: cached, expectedSHA256: template.artifactSha256)
            let pointer = try JSONSerialization.data(withJSONObject: ["release": template.release, "sha256": template.artifactSha256], options: [.prettyPrinted, .sortedKeys])
            try pointer.write(to: cacheRoot.appendingPathComponent("current.json"), options: .atomic)
        }
        try SlopDuplicator.duplicate(
            from: cached,
            to: destination,
            template: .init(artifactSha256: template.artifactSha256, publisherKeyID: template.publisherKeyID, release: template.release)
        )
        return downloaded
    }

    public func create(fromLocalPackage packageURL: URL, at destination: URL) throws {
        try SlopDuplicator.duplicate(from: packageURL, to: destination)
    }
}
