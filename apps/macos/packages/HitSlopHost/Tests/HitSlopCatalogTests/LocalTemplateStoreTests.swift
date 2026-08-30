import Foundation
import HitSlopCore
import HitSlopHost
import HitSlopRuntime
import Testing
@testable import HitSlopCatalog

@Test @MainActor func discoversAndDuplicatesLocalTemplate() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let wrapper = root.appendingPathComponent("tiny-counter", isDirectory: true)
    let package = wrapper.appendingPathComponent("template.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: package.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: package.appendingPathComponent("QuickLook"), withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: package.appendingPathComponent("app.html"))
    try Data("{}\n".utf8).write(to: package.appendingPathComponent("stores/state.json"))
    let manifest = """
    {"slug":"tiny-counter","title":"Tiny Counter","description":"Counts a very small thing.","author":{"name":"Test"},"categories":["Widgets"],"stores":{"state":{"kind":"json"}},"window":{"width":320,"height":240,"shape":{"kind":"roundedRect","radius":22}}}
    """
    try Data(manifest.utf8).write(to: package.appendingPathComponent("manifest.json"))
    let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
    try png.write(to: package.appendingPathComponent("QuickLook/Preview.png"))
    try png.write(to: package.appendingPathComponent("QuickLook/Thumbnail.png"))
    let install = """
    {"artifactSha256":"\(String(repeating: "a", count: 64))","installedAt":"2026-08-29T18:00:00Z"}
    """
    try Data(install.utf8).write(to: wrapper.appendingPathComponent("install.json"))

    let store = LocalTemplateStore(templatesURL: root)
    #expect(store.templates.count == 1)
    #expect(store.templates.first?.manifest.title == "Tiny Counter")
    #expect(store.issues.isEmpty)

    let destination = root.appendingPathComponent("created.slop", isDirectory: true)
    try DocumentFactory(catalogURL: URL(string: "https://hitslop.app")!).create(fromLocalPackage: store.templates[0].packageURL, at: destination)
    SlopPreviewWriter.installExistingPreview(for: destination)
    #expect(try SlopPackage(rootURL: destination).manifest.document != nil)
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("app.html").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("QuickLook/Thumbnail.png").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("Icon\r").path))
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("document.json").path))
}

@Test @MainActor func reportsInvalidLocalWrapperWithoutCrashing() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let wrapper = root.appendingPathComponent("broken", isDirectory: true)
    try FileManager.default.createDirectory(at: wrapper, withIntermediateDirectories: true)
    try Data("{}".utf8).write(to: wrapper.appendingPathComponent("install.json"))
    let store = LocalTemplateStore(templatesURL: root)
    #expect(store.templates.isEmpty)
    #expect(store.issues.count == 1)
}
