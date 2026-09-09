import AppKit
import Foundation
import HitSlopCore
import Testing
@testable import HitSlopHost

@Test func documentWindowStyleMaskStaysBorderlessAndMiniaturizable() {
    let resizable = slopDocumentWindowStyleMask(resizable: true)
    #expect(resizable.contains(.borderless))
    #expect(resizable.contains(.miniaturizable))
    #expect(resizable.contains(.resizable))

    let fixed = slopDocumentWindowStyleMask(resizable: false)
    #expect(fixed.contains(.borderless))
    #expect(fixed.contains(.miniaturizable))
    #expect(!fixed.contains(.resizable))
}

@Test @MainActor func documentWindowUsesTheSlopIconForMiniwindowAndDockMenu() throws {
    let root = try documentWindowFixture(resizable: true)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let controller = try SlopDocumentWindowController(packageURL: root)
    defer { controller.close() }
    let window = try #require(controller.window)

    #expect(window.styleMask.contains(.borderless))
    #expect(window.styleMask.contains(.miniaturizable))
    #expect(window.styleMask.contains(.resizable))
    #expect(window.representedURL?.standardizedFileURL == root.standardizedFileURL)
    #expect(window.miniwindowTitle == "Miniwindow Fixture")
    #expect(window.miniwindowImage != nil)
    #expect(controller.documentTitle == "Miniwindow Fixture")
    #expect(controller.dockMenuImage.size == NSSize(width: 16, height: 16))
}

@Test @MainActor func nonResizableDocumentWindowStillMiniaturizes() throws {
    let root = try documentWindowFixture(resizable: false)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let controller = try SlopDocumentWindowController(packageURL: root)
    defer { controller.close() }
    let window = try #require(controller.window)

    #expect(window.styleMask.contains(.miniaturizable))
    #expect(!window.styleMask.contains(.resizable))
}

@Test func dockMenuImageFallsBackToTheWorkspaceIcon() {
    let missing = URL(fileURLWithPath: "/tmp/hitslop-missing-icon-\(UUID().uuidString)")
    let image = slopDockMenuImage(iconURL: missing.appendingPathComponent("QuickLook/Icon.png"), fallbackURL: missing)
    #expect(image.size == NSSize(width: 16, height: 16))
}

private func documentWindowFixture(resizable: Bool) throws -> URL {
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-document-window-\(UUID().uuidString)", isDirectory: true)
    let root = parent.appendingPathComponent("fixture.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root.appendingPathComponent("QuickLook"), withIntermediateDirectories: true)
    try Data("<!doctype html><html><body><script>window.slop.ready()</script></body></html>".utf8).write(to: root.appendingPathComponent("app.html"))
    let resizableJSON = resizable ? "true" : "false"
    let manifest = #"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","author":{"name":"Fixture Author","url":"https://example.com"},"slug":"miniwindow-fixture","title":"Miniwindow Fixture","description":"Tests document miniaturize chrome.","categories":["utilities"],"presentation":{"width":320,"height":240,"resizable":\#(resizableJSON)}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.createDirectory(at: skill.deletingLastPathComponent(), withIntermediateDirectories: true)
    try SlopPackage.canonicalDocumentSkillData().write(to: skill)
    let bitmap = try #require(NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 512, pixelsHigh: 512, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0))
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor.systemOrange.setFill()
    NSBezierPath(ovalIn: NSRect(x: 64, y: 64, width: 384, height: 384)).fill()
    NSGraphicsContext.restoreGraphicsState()
    try #require(bitmap.representation(using: .png, properties: [:])).write(to: root.appendingPathComponent("QuickLook/Icon.png"))
    return root
}
