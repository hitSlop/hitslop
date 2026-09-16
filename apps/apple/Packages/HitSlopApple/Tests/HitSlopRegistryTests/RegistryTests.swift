import Foundation
import Testing
import HitSlopCore
@testable import HitSlopRegistry

private func fixture() throws -> RegistryTemplate {
    let hash = String(repeating: "a", count: 64)
    let asset = ["url": "https://api.hitslop.com/api/artifact?key=artifacts/sha256/\(hash).slop.zip", "sha256": hash, "bytes": 1024] as [String: Any]
    let value: [String: Any] = [
        "id": "publisher-key-id1_counter", "slug": "counter", "title": "Counter",
        "description": "Count one useful thing", "categories": ["utilities"],
        "author": ["name": "Counter Author"], "creationCount": 0,
        "release": ["number": 1, "publishedAt": "2026-01-01T00:00:00Z"],
        "preview": asset, "icon": asset, "download": asset,
    ]
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    return try decoder.decode(RegistryTemplate.self, from: JSONSerialization.data(withJSONObject: value))
}

@Test func catalogUsesGeneratedPublicContract() throws {
    let template = try fixture()
    #expect(template.author.url == nil)
    #expect(template.searchText.contains("counter author"))
    #expect(template.searchText.contains("utilities"))
    #expect(template.searchText.contains("count one useful thing"))
    let remote = try template.remoteTemplate()
    #expect(remote.publisherKeyID == "publisher-key-id1")
    #expect(remote.artifactSha256 == String(repeating: "a", count: 64))
}

@Test func catalogRejectsMismatchedArtifactIdentity() throws {
    var template = try fixture()
    template.download.sha256 = String(repeating: "b", count: 64)
    #expect(throws: (any Error).self) { try template.remoteTemplate() }
    template = try fixture()
    template.id = "bad_counter"
    #expect(throws: (any Error).self) { try template.remoteTemplate() }
}
