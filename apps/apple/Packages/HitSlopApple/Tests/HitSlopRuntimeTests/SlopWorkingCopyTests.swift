import Foundation
import HitSlopCore
import Testing
@testable import HitSlopRuntime

@Test @MainActor func documentFactoryRecognizesOnlyManagedTemplatePackages() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-template-boundary-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let templates = root.appendingPathComponent("templates", isDirectory: true)
    let factory = DocumentFactory(catalogURL: URL(string: "https://api.hitslop.com")!, templatesRoot: templates)

    #expect(factory.isManagedTemplatePackage(templates.appendingPathComponent("soma-amp.slop")))
    #expect(factory.isManagedTemplatePackage(templates.appendingPathComponent("cache/publisher/soma-amp/1.slop")))
    #expect(factory.isManagedTemplatePackage(templates.deletingLastPathComponent().appendingPathComponent("TEMPLATES/soma-amp.slop")))
    #expect(!factory.isManagedTemplatePackage(templates))
    #expect(!factory.isManagedTemplatePackage(root.appendingPathComponent("templates-backup/soma-amp.slop")))
    #expect(!factory.isManagedTemplatePackage(root.appendingPathComponent("documents/soma-amp.slop")))
}

@Test func workingCopyFlushesJSONSQLiteMediaAndThemeStores() throws {
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
    let media = working.appendingPathComponent("stores/media", isDirectory: true)
    try FileManager.default.createDirectory(at: media, withIntermediateDirectories: true)
    let image = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
    try image.write(to: media.appendingPathComponent("hero"))
    let theme = working.appendingPathComponent("stores/theme.css")
    try Data(":root { --slop-accent: tomato; }\n".utf8).write(to: theme)

    try SlopWorkingCopy.pushStores(from: working, to: presented)

    let json = try Data(contentsOf: presented.appendingPathComponent("stores/data.json"))
    #expect(String(data: json, encoding: .utf8)?.contains("7") == true)
    #expect(!FileManager.default.fileExists(atPath: presented.appendingPathComponent("stores/data.sqlite").path + "-wal"))
    #expect(try Data(contentsOf: presented.appendingPathComponent("stores/media/hero")) == image)
    #expect(try Data(contentsOf: presented.appendingPathComponent("stores/theme.css")) == Data(":root { --slop-accent: tomato; }\n".utf8))

    let flushed = try SlopDatabase(url: presented.appendingPathComponent("stores/data.sqlite"))
    defer { flushed.close() }
    let rows = try flushed.query("SELECT title FROM items", parameters: [])
    #expect(rows.first?["title"] as? String == "cloud")

    try FileManager.default.removeItem(at: theme)
    try SlopWorkingCopy.pushStores(from: working, to: presented)
    #expect(!FileManager.default.fileExists(atPath: presented.appendingPathComponent("stores/theme.css").path))
}

private func makePackage(in root: URL) throws -> URL {
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: root.appendingPathComponent("app.html"))
    let manifest = """
    {"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","slug":"cloud-fixture","title":"Cloud Fixture","description":"Working copy fixture.","categories":["utilities"],"presentation":{"width":320,"height":240}}
    """
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.createDirectory(at: skill.deletingLastPathComponent(), withIntermediateDirectories: true)
    try SlopPackage.canonicalDocumentSkillData().write(to: skill)
    return root
}
