import Foundation
import Testing
@testable import HitSlopRuntime

@Test func jsonStoreUsesOptimisticRevisionsAndAtomicWrites() throws {
    let directory = temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("data.json")
    let store = SlopJSONStore(url: url)

    let initial = try store.open(["count": 0])
    let revision = try store.write(["count": 1], expectedRevision: initial.revision)
    #expect(revision != initial.revision)
    #expect((try store.read().value as? [String: Int])?["count"] == 1)
    #expect(throws: Error.self) { try store.write(["count": 2], expectedRevision: initial.revision) }
}

private func temporaryDirectory() -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-storage-\(UUID().uuidString)", isDirectory: true)
    try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

@Test func sharedDataConformanceFixtures() throws {
    let url = try #require(Bundle.module.url(forResource: "data-conformance", withExtension: "json", subdirectory: "Fixtures"))
    let fixtures = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [[String: Any]])
    for fixture in fixtures {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let schemaURL = directory.appendingPathComponent("schema.json")
        try JSONSerialization.data(withJSONObject: fixture["schema"]!).write(to: schemaURL)
        let cases = try #require(fixture["cases"] as? [[String: Any]])
        let validValue = try #require(cases.first { $0["valid"] as? Bool == true }?["value"])
        for (index, item) in cases.enumerated() {
            let dataURL = directory.appendingPathComponent("case-\(index).json")
            let store = SlopJSONStore(url: dataURL, schemaURL: schemaURL)
            let value = item["value"]!
            if item["valid"] as? Bool == true {
                let result = try store.open(value)
                let expected = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed])
                let actual = try JSONSerialization.data(withJSONObject: result.value, options: [.sortedKeys, .fragmentsAllowed])
                #expect(actual == expected)
                let revision = try store.write(value, expectedRevision: result.revision)
                let read = try store.read()
                #expect(read.revision == revision)
                #expect(try JSONSerialization.data(withJSONObject: read.value, options: [.sortedKeys, .fragmentsAllowed]) == expected)
            } else {
                #expect(throws: Error.self) { _ = try store.open(value) }
                #expect(!FileManager.default.fileExists(atPath: dataURL.path))
                let baseline = try store.open(validValue)
                let original = try Data(contentsOf: dataURL)
                #expect(throws: Error.self) { _ = try store.write(value, expectedRevision: baseline.revision) }
                #expect(try Data(contentsOf: dataURL) == original)
                let invalid = try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
                try invalid.write(to: dataURL, options: .atomic)
                #expect(throws: Error.self) { _ = try store.read() }
                #expect(try Data(contentsOf: dataURL) == invalid)
            }
        }
    }
}

@Test func nativeJSONSchemaRejectsInvalidWritesWithoutChangingFile() throws {
    let directory = temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let schema = directory.appendingPathComponent("data.schema.json")
    try Data(#"{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}"#.utf8).write(to: schema)
    let url = directory.appendingPathComponent("data.json")
    let store = SlopJSONStore(url: url, schemaURL: schema)
    let snapshot = try store.open(["count": 2])
    #expect(throws: Error.self) { _ = try store.write(["count": "wrong"], expectedRevision: snapshot.revision) }
    #expect((try store.read().value as? [String: Int])?["count"] == 2)
}

@Test func invalidThemeKeepsLastValidStylesheet() throws {
    let directory = temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let defaults = directory.appendingPathComponent("defaults.css"), override = directory.appendingPathComponent("theme.css")
    try Data(":root { --slop-accent: red; }".utf8).write(to: defaults)
    let store = SlopThemeStore(url: override, defaultURL: defaults)
    let valid = Data(":root { --slop-accent: blue; }".utf8)
    try valid.write(to: override)
    #expect(store.stylesheet() == valid)
    try Data("body { display: none; }".utf8).write(to: override)
    #expect(store.stylesheet() == valid)
    try Data(":root { --slop-unknown: green; }".utf8).write(to: override)
    #expect(store.stylesheet() == valid)
    try FileManager.default.removeItem(at: override)
    #expect(store.stylesheet().isEmpty)
}
