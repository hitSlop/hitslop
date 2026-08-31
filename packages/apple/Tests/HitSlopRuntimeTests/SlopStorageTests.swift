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
