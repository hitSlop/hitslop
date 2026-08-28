import AppKit
import Foundation
@testable import SlopMacSupport
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
}
