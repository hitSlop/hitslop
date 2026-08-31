import Foundation
import HitSlopCore
import Testing
@testable import HitSlopRuntime

@Test func workingCopyFlushesJSONAndSQLiteStores() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let presented = try makePackage(in: root.appendingPathComponent("presented.slop", isDirectory: true))
    let workingRoot = root.appendingPathComponent("working", isDirectory: true)

    let working = try SlopWorkingCopy.materialize(from: presented, into: workingRoot)
    try FileManager.default.createDirectory(at: working.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data(#"{"count":7}"#.utf8).write(to: working.appendingPathComponent("stores/data.json"))

    let sqlite = working.appendingPathComponent("stores/data.sqlite")
    let database = try SlopDatabase(url: sqlite)
    _ = try database.transaction([
        ("CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT NOT NULL)", []),
        ("INSERT INTO items (title) VALUES (?)", ["cloud"]),
    ])
    database.close()

    try SlopWorkingCopy.pushStores(from: working, to: presented)

    let json = try Data(contentsOf: presented.appendingPathComponent("stores/data.json"))
    #expect(String(data: json, encoding: .utf8)?.contains("7") == true)
    #expect(!FileManager.default.fileExists(atPath: presented.appendingPathComponent("stores/data.sqlite").path + "-wal"))

    let flushed = try SlopDatabase(url: presented.appendingPathComponent("stores/data.sqlite"))
    defer { flushed.close() }
    let rows = try flushed.query("SELECT title FROM items", parameters: [])
    #expect(rows.first?["title"] as? String == "cloud")
}

private func makePackage(in root: URL) throws -> URL {
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: root.appendingPathComponent("app.html"))
    let manifest = """
    {"$schema":"https://hitslop.app/schemas/v1/manifest.schema.json","slug":"cloud-fixture","title":"Cloud Fixture","description":"Working copy fixture.","categories":["utilities"],"presentation":{"width":320,"height":240}}
    """
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    return root
}
