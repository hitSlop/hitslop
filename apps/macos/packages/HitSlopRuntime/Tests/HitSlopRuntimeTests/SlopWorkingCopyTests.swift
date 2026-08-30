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
    try Data(#"{"count":7}"#.utf8).write(to: working.appendingPathComponent("stores/state.json"))

    let sqlite = working.appendingPathComponent("stores/main.sqlite")
    let database = try SlopDatabase(url: sqlite)
    _ = try database.transaction([
        ("CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT NOT NULL)", []),
        ("INSERT INTO items (title) VALUES (?)", ["cloud"]),
    ]) {}
    database.close()

    try SlopWorkingCopy.pushStores(from: working, to: presented)

    let json = try Data(contentsOf: presented.appendingPathComponent("stores/state.json"))
    #expect(String(data: json, encoding: .utf8)?.contains("7") == true)
    #expect(!FileManager.default.fileExists(atPath: presented.appendingPathComponent("stores/main.sqlite").path + "-wal"))

    let flushed = try SlopDatabase(url: presented.appendingPathComponent("stores/main.sqlite"))
    defer { flushed.close() }
    let rows = try flushed.query("SELECT title FROM items", parameters: [])
    #expect(rows.first?["title"] as? String == "cloud")
}

private func makePackage(in root: URL) throws -> URL {
    try FileManager.default.createDirectory(at: root.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: root.appendingPathComponent("app.html"))
    try Data("{}\n".utf8).write(to: root.appendingPathComponent("stores/state.json"))
    let sqlite = root.appendingPathComponent("stores/main.sqlite")
    FileManager.default.createFile(atPath: sqlite.path, contents: nil)
    let seed = try SlopDatabase(url: sqlite)
    seed.close()
    let manifest = """
    {"slug":"cloud-fixture","title":"Cloud Fixture","description":"Working copy fixture.","author":{"name":"Test"},"categories":["Widgets"],"stores":{"state":{"kind":"json"},"main":{"kind":"sqlite"}},"window":{"width":320,"height":240,"shape":{"kind":"roundedRect","radius":22}},"document":{"id":"11111111-1111-1111-1111-111111111111"}}
    """
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    return root
}
