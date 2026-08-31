import Foundation

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
