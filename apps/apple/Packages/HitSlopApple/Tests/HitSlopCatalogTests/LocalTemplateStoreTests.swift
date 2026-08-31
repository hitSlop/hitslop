import Foundation
import HitSlopCore
import HitSlopHost
import HitSlopRuntime
import Testing
@testable import HitSlopCatalog

@Test @MainActor func discoversAndDuplicatesInstalledTemplate() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let package = root.appendingPathComponent("installed/tiny-counter.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: package.appendingPathComponent("QuickLook"), withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: package.appendingPathComponent("app.html"))
    let manifest = #"{"$schema":"https://hitslop.app/schemas/v1/manifest.schema.json","slug":"tiny-counter","title":"Tiny Counter","description":"Counts a very small thing.","categories":["utilities","personal"],"presentation":{"width":320,"height":240}}"#
    try Data(manifest.utf8).write(to: package.appendingPathComponent("manifest.json"))
    let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
    try png.write(to: package.appendingPathComponent("QuickLook/Preview.png"))
    try png.write(to: package.appendingPathComponent("QuickLook/Thumbnail.png"))

    let store = LocalTemplateStore(templatesURL: root)
    #expect(store.templates.count == 1)
    #expect(store.templates.first?.manifest.title == "Tiny Counter")
    #expect(store.issues.isEmpty)

    let destination = root.appendingPathComponent("created.slop", isDirectory: true)
    try DocumentFactory(catalogURL: URL(string: "https://hitslop.app")!).create(fromLocalPackage: store.templates[0].packageURL, at: destination)
    SlopPreviewWriter.installExistingPreview(for: destination)
    #expect(try Data(contentsOf: package.appendingPathComponent("manifest.json")) == Data(contentsOf: destination.appendingPathComponent("manifest.json")))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("app.html").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("QuickLook/Preview.png").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("QuickLook/Thumbnail.png").path))
    let updatedPreview = Data("updated preview".utf8)
    try SlopPreviewWriter.write(updatedPreview, to: destination)
    #expect(try Data(contentsOf: destination.appendingPathComponent("QuickLook/Preview.png")) == updatedPreview)
    #expect(try Data(contentsOf: destination.appendingPathComponent("QuickLook/Thumbnail.png")) == png)
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("Icon\r").path))
    #expect(!FileManager.default.fileExists(atPath: package.appendingPathComponent("Icon\r").path))
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("stores").path))
}

@Test @MainActor func reportsLegacyInstallWithoutCrashing() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    try FileManager.default.createDirectory(at: root.appendingPathComponent("old-wrapper"), withIntermediateDirectories: true)
    let store = LocalTemplateStore(templatesURL: root)
    #expect(store.templates.isEmpty)
    #expect(store.issues == ["Legacy template installs were found. Reinstall them with `slop install`."])
}
