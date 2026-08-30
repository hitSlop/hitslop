import CoreGraphics
import Foundation
import HitSlopCore
import ImageIO
import Testing
@testable import HitSlopHost

@Test @MainActor func imageMaskHitTestingUsesVisualTopAndTenPercentAlpha() throws {
    let root = try maskedFixture()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let mask = try SlopWindowMask(package: SlopPackage(rootURL: root))
    let bounds = CGRect(x: 0, y: 0, width: 240, height: 180)
    #expect(mask.contains(CGPoint(x: 120, y: 170), in: bounds))
    #expect(!mask.contains(CGPoint(x: 120, y: 10), in: bounds))

    let layer = mask.makeLayer()
    mask.update(layer, bounds: bounds)
    var rendered = [UInt8](repeating: 0, count: 240 * 180 * 4)
    let context = CGContext(data: &rendered, width: 240, height: 180, bitsPerComponent: 8, bytesPerRow: 240 * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
    layer.render(in: context)
    let alphaAtTop = rendered[(170 * 240 + 120) * 4 + 3]
    let alphaAtBottom = rendered[(10 * 240 + 120) * 4 + 3]
    #expect(alphaAtTop > 25)
    #expect(alphaAtBottom <= 25)
}

private func maskedFixture() throws -> URL {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-host-mask-\(UUID().uuidString)", isDirectory: true)
    let root = directory.appendingPathComponent("asymmetric.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root.appendingPathComponent("assets"), withIntermediateDirectories: true)
    try Data("<html></html>".utf8).write(to: root.appendingPathComponent("app.html"))
    let manifest = #"{"slug":"asymmetric","title":"Asymmetric","description":"Tests image mask orientation.","author":{"name":"Test"},"categories":["Widgets"],"stores":{},"window":{"width":240,"height":180,"resizable":false,"shape":{"kind":"imageMask","path":"assets/window-mask.png"}}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))

    let width = 240, height = 180
    var pixels = [UInt8](repeating: 255, count: width * height * 4)
    for y in height / 2..<height {
        for x in 0..<width { pixels[(y * width + x) * 4 + 3] = 0 }
    }
    let data = Data(pixels)
    guard let provider = CGDataProvider(data: data as CFData),
          let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent),
          let destination = CGImageDestinationCreateWithURL(root.appendingPathComponent("assets/window-mask.png") as CFURL, "public.png" as CFString, 1, nil) else {
        throw SlopPackageError.invalid("could not create asymmetric test mask")
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw SlopPackageError.invalid("could not write asymmetric test mask") }
    return root
}
