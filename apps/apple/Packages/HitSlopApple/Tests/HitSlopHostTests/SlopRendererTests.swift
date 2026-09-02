import AppKit
import CoreGraphics
import Foundation
import ImageIO
import HitSlopCore
import PDFKit
import Testing
@testable import HitSlopHost

@Test @MainActor func staticCaptureHidesControlsRestoresTheDocumentAndUsesTheRequestedGeometry() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root, renderTargetsEnabled: true)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load()
    try await session.waitUntilReady()

    let preview = try await SlopRenderer.previewPNGData(session: session)
    let previewImage = try #require(CGImageSourceCreateWithData(preview as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(previewImage.width == 320)
    #expect(previewImage.height == 240)
    #expect(try rgba(previewImage, x: 160, y: 120).alpha == 255)
    #expect(session.webView.value(forKey: "drawsBackground") as? Bool == true)

    let icon = try #require(try await SlopRenderer.targetPNGData(session: session, target: .icon))
    let iconImage = try #require(CGImageSourceCreateWithData(icon as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(iconImage.width == 512)
    #expect(iconImage.height == 512)
    #expect(try rgba(iconImage, x: 0, y: 0).alpha == 0)
    #expect(try rgba(iconImage, x: 256, y: 256).alpha == 255)
    #expect(session.webView.value(forKey: "drawsBackground") as? Bool == true)

    let exported = try await SlopRenderer.exportPNGData(session: session)
    let exportImage = try #require(CGImageSourceCreateWithData(exported as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(exportImage.width == 640)
    #expect(exportImage.height == 1920)
    // Core Graphics' backing buffer is bottom-up after drawing the image.
    let bottom = try rgba(exportImage, x: 320, y: 20)
    #expect(bottom.blue > 180)
    #expect(bottom.red < 80)

    let state = try await session.webView.evaluateJavaScript("({capture:document.documentElement.getAttribute('data-slop-capture'),display:getComputedStyle(document.querySelector('button')).display,target:getComputedStyle(document.querySelector('[data-slop-render=icon]')).display,background:getComputedStyle(document.body).backgroundColor})") as? [String: Any]
    #expect(state?["capture"] is NSNull)
    #expect(state?["display"] as? String == "block")
    #expect(state?["target"] as? String == "none")
    #expect(state?["background"] as? String == "rgb(243, 239, 230)")

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

@Test @MainActor func iconTargetLargerThanTheWindowStillRendersAt512AndRestoresTheViewport() async throws {
    let root = try rendererPackage(targetSize: 512)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root, renderTargetsEnabled: true)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load()
    try await session.waitUntilReady()
    #expect(session.webView.frame.size == CGSize(width: 320, height: 240))

    let icon = try #require(try await SlopRenderer.targetPNGData(session: session, target: .icon))
    let iconImage = try #require(CGImageSourceCreateWithData(icon as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(iconImage.width == 512)
    #expect(iconImage.height == 512)
    #expect(try rgba(iconImage, x: 0, y: 0).alpha == 0)
    #expect(try rgba(iconImage, x: 256, y: 256).alpha == 255)
    #expect(session.webView.frame.size == CGSize(width: 320, height: 240))
}

@Test @MainActor func optionalRenderTargetsReportMissingAndRejectDuplicates() async throws {
    let missingRoot = try rendererPackage(includeTargets: false)
    defer { try? FileManager.default.removeItem(at: missingRoot.deletingLastPathComponent()) }
    #expect(try await SlopRenderer.targetPNGData(packageURL: missingRoot, target: .icon) == nil)

    let duplicateRoot = try rendererPackage(duplicateIcon: true)
    defer { try? FileManager.default.removeItem(at: duplicateRoot.deletingLastPathComponent()) }
    await #expect(throws: SlopPackageError.self) {
        _ = try await SlopRenderer.targetPNGData(packageURL: duplicateRoot, target: .icon)
    }
}

@Test @MainActor func documentAssetsRenderInAHiddenSessionWithoutTouchingTheEditor() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let visibleSession = try SlopRuntimeSession(packageURL: root)
    defer { visibleSession.close() }
    let window = NSWindow(contentRect: visibleSession.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = visibleSession.webView
    visibleSession.load()
    try await visibleSession.waitUntilReady()
    _ = try await visibleSession.webView.evaluateJavaScript("""
        window.__captureMutations = [];
        new MutationObserver(() => window.__captureMutations.push(document.documentElement.getAttribute('data-slop-capture')))
          .observe(document.documentElement, { attributes: true, attributeFilter: ['data-slop-capture'] });
        document.querySelector('button').focus();
        """)

    let assets = try await SlopRenderer.documentAssetsPNGData(packageURL: root)
    let preview = try #require(assets.previewPNG)
    let previewImage = try #require(CGImageSourceCreateWithData(preview as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(previewImage.width == 320)
    #expect(previewImage.height == 240)
    let icon = try #require(assets.finderIconPNG)
    let iconImage = try #require(CGImageSourceCreateWithData(icon as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(iconImage.width == 512)
    #expect(iconImage.height == 512)
    #expect(try rgba(iconImage, x: 0, y: 0).alpha == 0)

    let state = try await visibleSession.webView.evaluateJavaScript("({capture:document.documentElement.getAttribute('data-slop-capture'),active:document.activeElement?.tagName,mutations:window.__captureMutations,targets:document.querySelectorAll('[data-slop-render]').length,background:getComputedStyle(document.body).backgroundColor})") as? [String: Any]
    #expect(state?["capture"] is NSNull)
    #expect(state?["active"] as? String == "BUTTON")
    #expect((state?["mutations"] as? [Any])?.isEmpty == true)
    #expect((state?["targets"] as? NSNumber)?.intValue == 0)
    #expect(state?["background"] as? String == "rgb(243, 239, 230)")
    #expect(visibleSession.webView.value(forKey: "drawsBackground") as? Bool == true)
}

private func rendererPackage(includeTargets: Bool = true, duplicateIcon: Bool = false, targetSize: Int = 200) throws -> URL {
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-renderer-\(UUID().uuidString)", isDirectory: true)
    let root = parent.appendingPathComponent("renderer.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let renderTargets = includeTargets ? #"""
    <template id="render-target-template">
      <section data-slop-render="icon"><span></span></section>
      \#(duplicateIcon ? #"<section data-slop-render="icon"></section>"# : "")
    </template>
    """# : ""
    let installRenderTargets = includeTargets ? #"""
    const targetTemplate = document.querySelector('#render-target-template');
    if (document.documentElement.hasAttribute('data-slop-renderer')) document.body.append(targetTemplate.content.cloneNode(true));
    targetTemplate.remove();
    """# : ""
    let rootWidth = targetSize > 320 ? "100%" : "320px"
    let html = #"""
    <!doctype html><html><head><style>
    *{box-sizing:border-box}html,body{margin:0;width:\#(rootWidth);min-height:960px;background:#f3efe6}button{display:block;width:100%;height:80px;border:0;background:#f00}.grid{display:grid;grid-template-columns:1fr 1fr}.tail{position:absolute;top:900px;width:100%;height:60px;background:#05f;color:#fff}[data-slop-render]{display:none;width:\#(targetSize)px;height:\#(targetSize)px;place-items:center;background:transparent}[data-slop-render] span{display:block;width:120px;height:120px}html[data-slop-capture=icon] body>:not([data-slop-render=icon]){display:none}html[data-slop-capture=icon] [data-slop-render=icon]{display:grid}html[data-slop-capture=icon] [data-slop-render=icon] span{background:#60a}
    </style></head><body><button data-slop-export="hide">Control</button><div class="grid"><span>Left column</span><span>Right column</span></div><div class="tail">Bottom content</div>\#(renderTargets)<script>\#(installRenderTargets)window.slop.ready()</script></body></html>
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
