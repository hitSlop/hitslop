import Foundation
import SlopMacSupport
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
}
