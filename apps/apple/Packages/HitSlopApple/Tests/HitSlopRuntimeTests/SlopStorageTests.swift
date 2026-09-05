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

@Test func sqliteStoreOwnsTransactionsAndRejectsConnectionControl() throws {
    let directory = temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("data.sqlite")
    FileManager.default.createFile(atPath: url.path, contents: nil)
    let database = try SlopDatabase(url: url)
    defer { database.close() }

    _ = try database.transaction([
        ("CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT NOT NULL)", []),
        ("INSERT INTO items (title) VALUES (?)", ["one"]),
    ])
    let rows = try database.query("SELECT count(*) AS count FROM items", parameters: [])
    #expect(rows.first?["count"] as? Int64 == 1)
    #expect(throws: Error.self) { try database.query("PRAGMA journal_mode", parameters: []) }
    #expect(throws: Error.self) { try database.execute("BEGIN", parameters: []) }
    #expect(throws: Error.self) { try database.execute("ATTACH DATABASE ':memory:' AS outside", parameters: []) }
    #expect(throws: Error.self) { try database.query("SELECT 1; SELECT 2", parameters: []) }
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
        for (index, item) in cases.enumerated() {
            let dataURL = directory.appendingPathComponent("case-\(index).json")
            let store = SlopJSONStore(url: dataURL, schemaURL: schemaURL)
            let value = item["value"]!
            if item["valid"] as? Bool == true {
                let result = try store.open(value)
                let expected = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed])
                let actual = try JSONSerialization.data(withJSONObject: result.value, options: [.sortedKeys, .fragmentsAllowed])
                #expect(actual == expected)
            } else {
                #expect(throws: Error.self) { _ = try store.open(value) }
                #expect(!FileManager.default.fileExists(atPath: dataURL.path))
            }
        }
    }
}

@Test func sqliteAuthorizerRejectsCommentedControlAndPreservesTransactions() throws {
    let directory = temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let database = try SlopDatabase(url: directory.appendingPathComponent("data.sqlite"))
    defer { database.close() }
    #expect(throws: Error.self) { _ = try database.query("/* guest */ PRAGMA journal_mode", parameters: []) }
    #expect(throws: Error.self) { _ = try database.execute("/* guest */ COMMIT", parameters: []) }
    _ = try database.transaction([("CREATE TABLE items (id INTEGER PRIMARY KEY, bytes BLOB)", [])])
    #expect(throws: Error.self) { _ = try database.transaction([
        ("INSERT INTO items VALUES (1, ?)", [["$blob": "AQID"]]),
        ("INSERT INTO missing_table VALUES (1)", []),
    ]) }
    #expect(try database.query("SELECT * FROM items", parameters: []).isEmpty)
    _ = try database.transaction([("INSERT INTO items VALUES (1, ?)", [["$blob": "AQID"]])])
    #expect((try database.query("SELECT bytes FROM items", parameters: []).first?["bytes"] as? [String: String])?["$blob"] == "AQID")
    #expect(throws: Error.self) { _ = try database.query("SELECT 9223372036854775807 AS unsafe", parameters: []) }
    #expect(throws: Error.self) { _ = try database.query("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10001) SELECT x FROM n", parameters: []) }
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
