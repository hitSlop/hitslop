import CoreGraphics
import Foundation
import ImageIO
import Testing
@testable import HitSlopCore

@Test func rejectsTraversal() { #expect(!SlopPackage.isSafeRelativePath("../data.json")); #expect(SlopPackage.isSafeRelativePath("stores/data.json")) }
@Test func hashIsStable() { #expect(SlopArchive.sha256(of: Data("hello".utf8)) == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824") }

@Test func validatesRequiredShapeAndRuntimeBoundary() throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try Data("{}".utf8).write(to: root.appendingPathComponent("package.json"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func rejectsUnexpectedRootEntriesAndAllowsFinderIcon() throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try Data().write(to: root.appendingPathComponent("Icon\r"))
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try Data().write(to: root.appendingPathComponent("notes.txt"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func duplicationCreatesIdentityAndPreservesLineage() throws {
    let source = try fixture()
    let temporary = source.deletingLastPathComponent()
    defer { try? FileManager.default.removeItem(at: temporary) }
    let lineage = SlopTemplateLineage(artifactSha256: String(repeating: "a", count: 64), publisherKeyID: "1234567890abcdef", release: 4)
    try SlopDocumentMetadata.write(to: source, template: lineage)
    let destination = temporary.appendingPathComponent("copy.slop")
    try SlopDuplicator.duplicate(from: source, to: destination)
    let first = try SlopPackage(rootURL: source).manifest.document, second = try SlopPackage(rootURL: destination).manifest.document
    #expect(first?.id != second?.id)
    #expect(second?.template?.release == 4)
    #expect(try Data(contentsOf: destination.appendingPathComponent("stores/state.json")) == Data("{}\n".utf8))
}

@Test func validatesImageMaskPixelsAndAlpha() throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try FileManager.default.createDirectory(at: root.appendingPathComponent("assets"), withIntermediateDirectories: true)
    try writeMask(to: root.appendingPathComponent("assets/window-mask.png"), width: 320, height: 240)
    let manifest = #"{"slug":"tiny-counter","title":"Tiny Counter","description":"Counts things.","author":{"name":"Test"},"categories":["Widgets"],"stores":{"state":{"kind":"json"}},"window":{"width":320,"height":240,"resizable":false,"shape":{"kind":"imageMask","path":"assets/window-mask.png"}}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }

    try writeMask(to: root.appendingPathComponent("assets/window-mask.png"), width: 319, height: 240)
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

private func fixture() throws -> URL {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-core-\(UUID().uuidString)", isDirectory: true)
    let root = directory.appendingPathComponent("tiny-counter.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data("<html><head></head><body></body></html>".utf8).write(to: root.appendingPathComponent("app.html"))
    try Data("{}\n".utf8).write(to: root.appendingPathComponent("stores/state.json"))
    let manifest = #"{"slug":"tiny-counter","title":"Tiny Counter","description":"Counts things.","author":{"name":"Test"},"categories":["Widgets"],"stores":{"state":{"kind":"json"}},"window":{"width":320,"height":240,"shape":{"kind":"roundedRect","radius":22}}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    return root
}

private func writeMask(to url: URL, width: Int, height: Int) throws {
    let bytes = Data(repeating: 255, count: width * height * 4)
    guard let provider = CGDataProvider(data: bytes as CFData),
          let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent),
          let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
        throw SlopPackageError.invalid("could not create test mask")
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw SlopPackageError.invalid("could not write test mask") }
}
