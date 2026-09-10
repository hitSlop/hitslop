import Foundation
import FirebaseFirestore
import Testing
@testable import HitSlopRegistry

private func fixture() throws -> [String: Any] {
    var root = URL(fileURLWithPath: #filePath)
    for _ in 0..<7 { root.deleteLastPathComponent() }
    let url = root.appendingPathComponent("packages/schema/tests/fixtures/registry-template.json")
    var value = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    value["firstPublishedAt"] = Timestamp(date: try #require(formatter.date(from: value["firstPublishedAt"] as! String)))
    var release = value["currentRelease"] as! [String: Any]
    release["publishedAt"] = Timestamp(date: try #require(formatter.date(from: release["publishedAt"] as! String)))
    value["currentRelease"] = release
    return value
}

@Test func registryDecodesSharedFixtureWithoutStoredSearchText() throws {
    let value = try fixture()
    #expect(value["searchText"] == nil)
    let template = try Firestore.Decoder().decode(RegistryTemplate.self, from: value)
    #expect(template.id == "publisher-key-id_counter")
    #expect(template.publisherKeyID == "publisher-key-id")
    #expect(template.currentRelease.publishedAt == template.firstPublishedAt)
    #expect(template.currentRelease.artifact.bytes == 1024)
    #expect(template.currentManifest?.title == "Counter")
    #expect(template.searchText.contains("counter author"))
    #expect(template.searchText.contains("utilities"))
    #expect(template.searchText.contains("count one useful thing"))
}

@Test func registryPreservesUnknownCategoriesAndOptionalAuthorURL() throws {
    var value = try fixture()
    value.removeValue(forKey: "authorURL")
    value["categories"] = ["future-category"]
    let template = try Firestore.Decoder().decode(RegistryTemplate.self, from: value)
    #expect(template.authorURL == nil)
    #expect(template.categories == ["future-category"])
    #expect(template.searchText.contains("future-category"))
}

@Test func registryRejectsMalformedRequiredFields() throws {
    var value = try fixture()
    value.removeValue(forKey: "title")
    #expect(throws: (any Error).self) {
        try Firestore.Decoder().decode(RegistryTemplate.self, from: value)
    }
}
