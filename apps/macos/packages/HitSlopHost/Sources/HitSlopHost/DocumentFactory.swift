import Foundation
import HitSlopCore
import HitSlopRegistry

public struct DocumentFactory: Sendable {
    public let catalogURL: URL
    public init(catalogURL: URL) { self.catalogURL = catalogURL }

    @discardableResult public func create(from template: RegistryTemplate, at destination: URL) async throws -> Bool {
        guard let artifactKey = template.currentArtifactKey, let expectedHash = template.currentArtifactSha256 else { throw SlopPackageError.invalid("template has no current artifact") }
        let cacheRoot = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/templates/\(template.publisherKeyId)/\(template.slug)", isDirectory: true)
        let cached = cacheRoot.appendingPathComponent("releases/\(template.currentReleaseNumber).slop", isDirectory: true)
        let artifactHash = expectedHash; var downloaded = false
        if (try? SlopPackage(rootURL: cached)) == nil {
            try FileManager.default.createDirectory(at: cached.deletingLastPathComponent(), withIntermediateDirectories: true)
            var components = URLComponents(url: catalogURL.appendingPathComponent("api/artifact"), resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "key", value: artifactKey)]
            let (archive, response) = try await URLSession.shared.download(from: components.url!)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw SlopPackageError.invalid("template download failed") }
            downloaded = true; try SlopArchive.extract(archive, to: cached, expectedSHA256: expectedHash)
            let pointer = try JSONSerialization.data(withJSONObject: ["release": template.currentReleaseNumber, "sha256": expectedHash], options: [.prettyPrinted, .sortedKeys]); try pointer.write(to: cacheRoot.appendingPathComponent("current.json"), options: .atomic)
        }
        let temporary = destination.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).slop", isDirectory: true)
        try FileManager.default.copyItem(at: cached, to: temporary)
        try DocumentProvenance(template: .init(publisherKeyId: template.publisherKeyId, slug: template.slug, release: template.currentReleaseNumber, artifactSha256: artifactHash)).write(to: temporary)
        if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: temporary); throw CocoaError(.fileWriteFileExists) }
        try FileManager.default.moveItem(at: temporary, to: destination)
        return downloaded
    }
}
