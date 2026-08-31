import AppKit
import CoreGraphics
import Foundation
import ImageIO
import PDFKit
import Testing
@testable import HitSlopHost

@Test @MainActor func staticCaptureHidesControlsRestoresTheDocumentAndUsesTheRequestedGeometry() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load()
    try await session.waitUntilReady()

    let preview = try await SlopRenderer.previewPNGData(session: session)
    let previewImage = try #require(CGImageSourceCreateWithData(preview as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(previewImage.width == 320)
    #expect(previewImage.height == 240)

    let exported = try await SlopRenderer.exportPNGData(session: session)
    let exportImage = try #require(CGImageSourceCreateWithData(exported as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(exportImage.width == 640)
    #expect(exportImage.height == 1920)
    // Core Graphics' backing buffer is bottom-up after drawing the image.
    let bottom = try rgba(exportImage, x: 320, y: 20)
    #expect(bottom.blue > 180)
    #expect(bottom.red < 80)

    let state = try await session.webView.evaluateJavaScript("({capture:document.documentElement.getAttribute('data-slop-capture'),display:getComputedStyle(document.querySelector('button')).display})") as? [String: Any]
    #expect(state?["capture"] is NSNull)
    #expect(state?["display"] as? String == "block")

    let pdf = try await SlopRenderer.exportPDFData(session: session)
    let provider = try #require(CGDataProvider(data: pdf as CFData))
    let document = try #require(CGPDFDocument(provider))
    let cgPage = try #require(document.page(at: 1))
    #expect(Int(cgPage.getBoxRect(.mediaBox).width) == 320)
    #expect(Int(cgPage.getBoxRect(.mediaBox).height) == 960)
    let pdfDocument = try #require(PDFDocument(data: pdf))
    let pdfPage = try #require(pdfDocument.page(at: 0))
    let pdfText = try #require(pdfPage.string)
    #expect(pdfText.contains("Bottom content"))
    #expect(!pdfText.contains("Control"))
    let rightRange = (pdfText as NSString).range(of: "Right column")
    let rightSelection = try #require(pdfPage.selection(for: rightRange))
    #expect(rightSelection.bounds(for: pdfPage).minX > 150)
}

private func rendererPackage() throws -> URL {
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-renderer-\(UUID().uuidString)", isDirectory: true)
    let root = parent.appendingPathComponent("renderer.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let html = #"""
    <!doctype html><html><head><style>
    *{box-sizing:border-box}html,body{margin:0;width:320px;min-height:960px;background:#f3efe6}button{display:block;width:100%;height:80px;border:0;background:#f00}.grid{display:grid;grid-template-columns:1fr 1fr}.tail{position:absolute;top:900px;width:100%;height:60px;background:#05f;color:#fff}
    </style></head><body><button data-slop-export="hide">Control</button><div class="grid"><span>Left column</span><span>Right column</span></div><div class="tail">Bottom content</div><script>window.slop.ready()</script></body></html>
    """#
    try Data(html.utf8).write(to: root.appendingPathComponent("app.html"))
    let manifest = #"{"$schema":"https://hitslop.app/schemas/v1/manifest.schema.json","slug":"renderer-test","title":"Renderer Test","description":"Static capture fixture.","categories":["developer-tools"],"presentation":{"width":320,"height":240}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    return root
}

private func rgba(_ image: CGImage, x: Int, y: Int) throws -> (red: UInt8, green: UInt8, blue: UInt8, alpha: UInt8) {
    var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
    let context = try #require(CGContext(
        data: &bytes,
        width: image.width,
        height: image.height,
        bitsPerComponent: 8,
        bytesPerRow: image.width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ))
    context.translateBy(x: 0, y: CGFloat(image.height))
    context.scaleBy(x: 1, y: -1)
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    let offset = (y * image.width + x) * 4
    return (bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}
