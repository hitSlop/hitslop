import AppKit
import Foundation
import HitSlopCore
import HitSlopHost
import HitSlopRuntime
import Testing
@testable import HitSlopCatalog

@Test @MainActor func discoversAndDuplicatesInstalledTemplate() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let package = try writeTemplate(named: "tiny-counter", in: root)

    let store = LocalTemplateStore(templatesURL: root)
    #expect(store.templates.count == 1)
    #expect(store.templates.first?.manifest.title == "Tiny Counter")
    #expect(store.templates.first?.iconURL.lastPathComponent == "Icon.png")
    #expect(store.issues.isEmpty)

    let destination = root.appendingPathComponent("created.slop", isDirectory: true)
    try DocumentFactory(catalogURL: URL(string: "https://hitslop.app")!).create(fromLocalPackage: store.templates[0].packageURL, at: destination)
    SlopPreviewWriter.installExistingPreview(for: destination)
    #expect(try Data(contentsOf: package.appendingPathComponent("manifest.json")) == Data(contentsOf: destination.appendingPathComponent("manifest.json")))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("app.html").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("QuickLook/Preview.png").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("QuickLook/Icon.png").path))
    let updatedPreview = Data("updated preview".utf8)
    try SlopPreviewWriter.write(updatedPreview, to: destination)
    #expect(try Data(contentsOf: destination.appendingPathComponent("QuickLook/Preview.png")) == updatedPreview)
    #expect(try Data(contentsOf: destination.appendingPathComponent("QuickLook/Icon.png")) == iconPNG)
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("Icon\r").path))
    SlopPreviewWriter.installFinderIcon(iconPNG, for: destination)
    #expect(try Data(contentsOf: destination.appendingPathComponent("QuickLook/Icon.png")) == iconPNG)
    #expect(!FileManager.default.fileExists(atPath: package.appendingPathComponent("Icon\r").path))
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("stores").path))
}

@Test @MainActor func ignoresHostedCacheWhenListingTemplates() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    _ = try writeTemplate(named: "tiny-counter", in: root)
    _ = try writeTemplate(named: "cached-slop", in: root.appendingPathComponent("cache/publisher/cached-slop", isDirectory: true), fileName: "1.slop")

    let store = LocalTemplateStore(templatesURL: root)
    #expect(store.templates.map(\.manifest.slug) == ["tiny-counter"])
    #expect(store.issues.isEmpty)
}

private let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
private let iconPNG = try! makeIconPNG()

private func writeTemplate(named slug: String, in directory: URL, fileName: String? = nil) throws -> URL {
    let package = directory.appendingPathComponent(fileName ?? "\(slug).slop", isDirectory: true)
    try FileManager.default.createDirectory(at: package.appendingPathComponent("QuickLook"), withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: package.appendingPathComponent("app.html"))
    let manifest = #"{"$schema":"https://hitslop.app/schemas/v1/manifest.schema.json","slug":"\#(slug)","title":"Tiny Counter","description":"Counts a very small thing.","categories":["utilities","personal"],"presentation":{"width":320,"height":240}}"#
    try Data(manifest.utf8).write(to: package.appendingPathComponent("manifest.json"))
    let skill = package.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.createDirectory(at: skill.deletingLastPathComponent(), withIntermediateDirectories: true)
    try SlopPackage.canonicalDocumentSkillData().write(to: skill)
    try png.write(to: package.appendingPathComponent("QuickLook/Preview.png"))
    try iconPNG.write(to: package.appendingPathComponent("QuickLook/Icon.png"))
    return package
}

private func makeIconPNG() throws -> Data {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 512, pixelsHigh: 512, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    return bitmap.representation(using: .png, properties: [:])!
}
