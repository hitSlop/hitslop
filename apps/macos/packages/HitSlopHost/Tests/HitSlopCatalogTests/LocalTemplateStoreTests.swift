import Foundation
import Testing
@testable import HitSlopCatalog

@Test @MainActor func discoversAndDuplicatesLocalTemplate() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let wrapper = root.appendingPathComponent("tiny-counter", isDirectory: true)
    let package = wrapper.appendingPathComponent("template.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: package.appendingPathComponent("build"), withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: package.appendingPathComponent("build/index.html"))
    try Data("{}\n".utf8).write(to: package.appendingPathComponent("data.json"))
    let manifest = """
    {"format":"hitslop/1","runtime":"web","slug":"tiny-counter","title":"Tiny Counter","description":"Counts a very small thing.","author":{"name":"Test"},"categories":["Widgets"],"stores":[{"id":"state","kind":"json","path":"data.json"}],"window":{"width":320,"height":240}}
    """
    try Data(manifest.utf8).write(to: package.appendingPathComponent("manifest.json"))
    try Data("png".utf8).write(to: wrapper.appendingPathComponent("cover.png"))
    let install = """
    {"format":"hitslop-template-install/1","package":"template.slop","preview":"cover.png","artifactSha256":"\(String(repeating: "a", count: 64))","installedAt":"2026-08-29T18:00:00Z"}
    """
    try Data(install.utf8).write(to: wrapper.appendingPathComponent("install.json"))

    let store = LocalTemplateStore(templatesURL: root)
    #expect(store.templates.count == 1)
    #expect(store.templates.first?.manifest.title == "Tiny Counter")
    #expect(store.issues.isEmpty)

    let destination = root.appendingPathComponent("created.slop", isDirectory: true)
    try DocumentFactory(catalogURL: URL(string: "https://hitslop.app")!).create(from: store.templates[0], at: destination)
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("document.json").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("build/index.html").path))
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
