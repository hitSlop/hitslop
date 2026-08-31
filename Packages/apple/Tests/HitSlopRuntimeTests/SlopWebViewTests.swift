#if os(macOS)
import AppKit
import Foundation
import ImageIO
import Testing
@testable import HitSlopRuntime

@Test @MainActor func unskinnedRuntimeUsesOpaqueWebViewBacking() throws {
    let root = try webViewPackage(skinned: false)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    #expect(!session.usesTransparentBackground)
    #expect(session.webView.value(forKey: "drawsBackground") as? Bool == true)
}

@Test @MainActor func skinnedRuntimeUsesTransparentWebViewBacking() throws {
    let root = try webViewPackage(skinned: true)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    #expect(session.usesTransparentBackground)
    #expect(session.webView.value(forKey: "drawsBackground") as? Bool == false)
}

private func webViewPackage(skinned: Bool) throws -> URL {
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-webview-\(UUID().uuidString)", isDirectory: true)
    let root = parent.appendingPathComponent("fixture.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: root.appendingPathComponent("app.html"))
    let presentation = skinned
        ? #"{"width":320,"height":240,"skin":"assets/skin.png"}"#
        : #"{"width":320,"height":240}"#
    let manifest = #"{"$schema":"https://hitslop.app/schemas/v1/manifest.schema.json","slug":"webview-fixture","title":"WebView Fixture","description":"Runtime opacity fixture.","categories":["utilities"],"presentation":\#(presentation)}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    if skinned {
        let assets = root.appendingPathComponent("assets", isDirectory: true)
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        try writeRGBA(to: assets.appendingPathComponent("skin.png"), width: 320, height: 240)
    }
    return root
}

private func writeRGBA(to url: URL, width: Int, height: Int) throws {
    let bytes = [UInt8](repeating: 255, count: width * height * 4)
    guard let provider = CGDataProvider(data: Data(bytes) as CFData),
          let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent),
          let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
        throw CocoaError(.fileWriteUnknown)
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw CocoaError(.fileWriteUnknown) }
}
#endif
