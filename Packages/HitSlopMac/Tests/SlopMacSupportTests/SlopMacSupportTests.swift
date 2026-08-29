import AppKit
import Foundation
import SlopCore
@testable import SlopMacSupport
@testable import SlopWebRuntime
import XCTest

final class SlopMacSupportTests: XCTestCase {
    func testQuickLookReadersPreferDerivedPackageAssets() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("slop-preview-tests-\(UUID().uuidString).slop")
        defer { try? FileManager.default.removeItem(at: root) }
        let quickLook = root.appendingPathComponent("QuickLook", isDirectory: true)
        try FileManager.default.createDirectory(at: quickLook, withIntermediateDirectories: true)
        let preview = quickLook.appendingPathComponent("Preview.png")
        let thumbnail = quickLook.appendingPathComponent("Thumbnail.png")
        try Data([1]).write(to: preview)
        try Data([2]).write(to: thumbnail)
        XCTAssertEqual(SlopPreviewAssets.previewURL(in: root), preview)
        XCTAssertEqual(SlopPreviewAssets.thumbnailURL(in: root), thumbnail)
    }

    func testDocumentIconUsesRetinaBackingPixels() throws {
        let source = try XCTUnwrap(NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: 480,
            pixelsHigh: 640,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ))
        source.size = NSSize(width: 480, height: 640)
        let png = try XCTUnwrap(source.representation(using: .png, properties: [:]))

        let icon = try XCTUnwrap(SlopPreviewAssets.icon(from: png, cornerRadius: 22))
        let bitmap = try XCTUnwrap(icon.representations.compactMap { $0 as? NSBitmapImageRep }.first)

        XCTAssertEqual(icon.size, NSSize(width: 512, height: 512))
        XCTAssertEqual(bitmap.size, NSSize(width: 512, height: 512))
        XCTAssertEqual(bitmap.pixelsWide, 1024)
        XCTAssertEqual(bitmap.pixelsHigh, 1024)
    }

    func testCirclePreviewClearsTransparentCorners() throws {
        let rep = try XCTUnwrap(NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: 100,
            pixelsHigh: 100,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ))
        rep.size = NSSize(width: 100, height: 100)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        NSColor.red.setFill()
        NSBezierPath(rect: NSRect(x: 0, y: 0, width: 100, height: 100)).fill()
        NSGraphicsContext.restoreGraphicsState()
        let source = try XCTUnwrap(rep.representation(using: .png, properties: [:]))
        let masked = try XCTUnwrap(SlopPreviewAssets.maskedPreview(
            from: source,
            shape: .init(kind: .circle)
        ))
        let result = try XCTUnwrap(NSBitmapImageRep(data: masked))
        XCTAssertEqual(try XCTUnwrap(result.colorAt(x: 0, y: 0)).alphaComponent, 0, accuracy: 0.01)
        XCTAssertGreaterThan(result.colorAt(x: 50, y: 50)?.alphaComponent ?? 0, 0.9)
    }

    func testHostEnforcesStylesheetOrder() throws {
        let html = """
        <html><head>
        <link id="slop-document-styles" href="wrong-style.css">
        <style id="guest-styles">body { color: red; }</style>
        <link id="slop-base-styles" href="wrong-base.css">
        </head><body></body></html>
        """
        let injected = try SlopSchemeHandler.injectingHostStyles(into: html)
        let base = try XCTUnwrap(injected.range(of: "id=\"slop-base-styles\""))
        let guest = try XCTUnwrap(injected.range(of: "id=\"guest-styles\""))
        let style = try XCTUnwrap(injected.range(of: "id=\"slop-document-styles\""))
        XCTAssertLessThan(base.lowerBound, guest.lowerBound)
        XCTAssertLessThan(guest.lowerBound, style.lowerBound)
        XCTAssertFalse(injected.contains("wrong-style.css"))
        XCTAssertFalse(injected.contains("wrong-base.css"))
    }

    func testHostHidesScrollbarChromeWithoutDisablingScrolling() throws {
        let resource = try SlopRuntime.baseStyles()
        let css = try XCTUnwrap(String(data: resource.data, encoding: .utf8))

        XCTAssertTrue(css.contains("scrollbar-width: none"))
        XCTAssertTrue(css.contains("*::-webkit-scrollbar"))
        XCTAssertTrue(css.contains("display: none"))
        XCTAssertFalse(css.contains("overflow: hidden"))
    }

    func testHostUsesCurrentColorInsteadOfSystemBlue() throws {
        let resource = try SlopRuntime.baseStyles()
        let css = try XCTUnwrap(String(data: resource.data, encoding: .utf8))

        XCTAssertFalse(css.contains("AccentColor"))
        XCTAssertTrue(css.contains("accent-color: currentColor"))
        XCTAssertTrue(css.contains(":focus-visible { outline: 1px solid currentColor"))
        XCTAssertFalse(css.contains("--slop-accent"))
    }

    func testHostSupportsOptInNonSelectableAppChrome() throws {
        let resource = try SlopRuntime.baseStyles()
        let css = try XCTUnwrap(String(data: resource.data, encoding: .utf8))

        XCTAssertTrue(css.contains("[data-slop-selection=\"none\"]"))
        XCTAssertTrue(css.contains("[data-slop-selectable]"))
        XCTAssertTrue(css.contains("[contenteditable]:not([contenteditable=\"false\"])"))
        XCTAssertTrue(css.contains("-webkit-user-select: text"))
        XCTAssertFalse(css.contains("body { user-select: none"))
    }
}
