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
    let manifest = #"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","author":{"name":"Fixture Author","url":"https://example.com"},"slug":"renderer-test","title":"Renderer Test","description":"Static capture fixture.","categories":["developer-tools"],"presentation":{"width":320,"height":240}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.createDirectory(at: skill.deletingLastPathComponent(), withIntermediateDirectories: true)
    try SlopPackage.canonicalDocumentSkillData().write(to: skill)
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

@Test @MainActor func capturePreparationFailureRestoresSelectionAndNestedScroll() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load(); try await session.waitUntilReady()
    _ = try await session.webView.evaluateJavaScript(#"""
      document.body.insertAdjacentHTML('afterbegin','<textarea id="edit">abcdef</textarea><div id="scroll" style="height:40px;overflow:auto"><div style="height:300px">Nested</div></div>');
      document.querySelector('#edit').focus(); document.querySelector('#edit').setSelectionRange(1,4);
      document.querySelector('#scroll').scrollTop=90;
      window.unregisterFailure = window.__hitslopCapture.onPrepare(() => {throw new Error('Chart failed')}); void 0;
    """#)
    do {
        _ = try await SlopRenderer.exportPNGData(session: session)
        Issue.record("Expected chart preparation to fail")
    } catch { #expect(error.localizedDescription.contains("Chart failed")) }
    let state = try #require(try await session.webView.evaluateJavaScript("({capture:document.documentElement.getAttribute('data-slop-capture'),active:document.activeElement.id,start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd,scroll:document.querySelector('#scroll').scrollTop})") as? [String: Any])
    #expect(state["capture"] is NSNull)
    #expect(state["active"] as? String == "edit")
    #expect(state["start"] as? Int == 1)
    #expect(state["end"] as? Int == 4)
    #expect(state["scroll"] as? Int == 90)
    #expect(session.webView.frame.size == CGSize(width: 320, height: 240))
    _ = try await session.webView.evaluateJavaScript("window.unregisterFailure()")
    _ = try await SlopRenderer.exportPDFData(session: session)
}

@Test @MainActor func dedicatedExportWaitsForAsyncContentAndPreservesCurrentView() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load(); try await session.waitUntilReady()
    _ = try await session.webView.evaluateJavaScript(#"""
      window.selectedView = 'Filed';
      const target = document.createElement('section'); target.style.display='none'; document.body.append(target);
      window.__hitslopCapture.registerTarget('export', {
        element:target,
        prepare:async()=>{
          target.style.cssText='display:block;width:100%;height:1200px;background:white';
          await new Promise(r=>setTimeout(r,180));
          target.innerHTML='<p>'+window.selectedView+'</p><p style="position:absolute;top:1150px">Final selected item</p>';
        },
        restore:()=>{target.style.display='none';target.replaceChildren()}
      }); void 0;
    """#)
    let pdf = try #require(PDFDocument(data: try await SlopRenderer.exportPDFData(session: session)))
    #expect(pdf.pageCount == 1)
    #expect(pdf.string?.contains("Filed") == true)
    #expect(pdf.string?.contains("Final selected item") == true)
    #expect(pdf.string?.contains("Control") == false)
    let imageData = try await SlopRenderer.exportPNGData(session: session)
    let image = try #require(CGImageSourceCreateWithData(imageData as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(image.width == 640)
    #expect(image.height == 2400)
    #expect(try rgba(image, x: 0, y: 0).alpha == 255) // No native rounded mask on dedicated exports.
    #expect(try await session.webView.evaluateJavaScript("document.querySelector('button').textContent") as? String == "Control")
}

@Test @MainActor func longVectorExportIsNotSubjectToRasterLimits() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load(); try await session.waitUntilReady()
    _ = try await session.webView.evaluateJavaScript("document.body.style.minHeight='18000px';document.querySelector('.tail').style.top='17900px'")
    await #expect(throws: SlopPackageError.self) { _ = try await SlopRenderer.exportPNGData(session: session) }
    let pdf = try #require(PDFDocument(data: try await SlopRenderer.exportPDFData(session: session)))
    #expect(pdf.pageCount == 1)
    #expect(pdf.page(at: 0)?.bounds(for: .mediaBox).height == 14400)
    #expect(pdf.page(at: 0)?.bounds(for: .mediaBox).width == 256)
    #expect(pdf.string?.contains("Bottom content") == true)
    let page = try #require(pdf.page(at: 0))
    let text = try #require(page.string)
    let selection = try #require(page.selection(for: (text as NSString).range(of: "Bottom content")))
    #expect(selection.bounds(for: page).minY >= 0)
    #expect(selection.bounds(for: page).maxY < 120)

}

@Test @MainActor func iconFailureDoesNotDiscardPreviewAndRenderingDoesNotInitializeOriginalStores() async throws {
    let root = try rendererPackage(duplicateIcon: true)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let app = root.appendingPathComponent("app.html")
    var html = try String(contentsOf: app, encoding: .utf8)
    html = html.replacingOccurrences(of: "window.slop.ready()", with: "window.slop.json.open({captureCount:1}).then(()=>window.slop.ready())")
    try Data(html.utf8).write(to: app)
    let assets = try await SlopRenderer.documentAssetsPNGData(packageURL: root)
    #expect(assets.previewPNG != nil)
    #expect(assets.finderIconPNG == nil)
    #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("stores").path))
    _ = try await SlopRenderer.exportPDFData(packageURL: root)
    #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("stores").path))
}

@Test @MainActor func overlappingExportsSerializeAndRestoreTheEditor() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load(); try await session.waitUntilReady()
    let first = Task { @MainActor in try await SlopRenderer.exportPNGData(session: session) }
    let second = Task { @MainActor in try await SlopRenderer.exportPDFData(session: session) }
    #expect(try await first.value.count > 0)
    #expect(try await second.value.count > 0)
    #expect(session.webView.frame.size == CGSize(width: 320, height: 240))
    #expect(try await session.webView.evaluateJavaScript("document.documentElement.getAttribute('data-slop-capture')") is NSNull)
}

@Test @MainActor func backgroundCaptureKeepsExistingJSONMediaAndThemeUnchanged() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    session.load(); try await session.waitUntilReady()
    _ = try await session.webView.callAsyncJavaScript(#"""
      await slop.json.open({count:1});
      await slop.media.write('photo','iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','image/png');
      return true;
    """#, arguments: [:], in: nil, contentWorld: .page)
    try await session.flush(); session.close()
    try Data(":root{--slop-ink:#123456}".utf8).write(to: root.appendingPathComponent("stores/theme.css"))
    let paths = ["stores/data.json", "stores/media/photo", "stores/theme.css"]
    let originals = try paths.map { try Data(contentsOf: root.appendingPathComponent($0)) }
    let app = root.appendingPathComponent("app.html")
    let html = try String(contentsOf: app, encoding: .utf8).replacingOccurrences(of: "window.slop.ready()", with: #"""
      (async()=>{const s=await slop.json.read();await slop.json.write({count:99},s.revision);await slop.media.remove('photo');slop.ready()})()
    """#)
    try Data(html.utf8).write(to: app)
    let assets = try await SlopRenderer.documentAssetsPNGData(packageURL: root)
    #expect(assets.previewPNG != nil)
    #expect(assets.finderIconPNG != nil)
    for (index, path) in paths.enumerated() { #expect(try Data(contentsOf: root.appendingPathComponent(path)) == originals[index]) }
}

@Test @MainActor func captureTimeoutAbortsPreparationAndRestoresEditor() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    session.load(); try await session.waitUntilReady()
    _ = try await session.webView.evaluateJavaScript(#"""
      window.__hitslopCapture.onPrepare((mode,signal)=>new Promise(()=>{signal.addEventListener('abort',()=>{window.wasAborted=true})})); void 0;
    """#)
    await #expect(throws: (any Error).self) { _ = try await SlopRenderer.exportPDFData(session: session) }
    #expect(try await session.webView.evaluateJavaScript("window.wasAborted") as? Bool == true)
    #expect(try await session.webView.evaluateJavaScript("document.documentElement.getAttribute('data-slop-capture')") is NSNull)
}

@Test @MainActor func invalidatedCloseJobCannotReplacePreview() async throws {
    let root = try rendererPackage()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    SlopDocumentAssetRefreshQueue.schedule(snapshot: try SlopRenderSnapshot(packageURL: root), presentedURL: root)
    try await Task.sleep(for: .milliseconds(100))
    SlopDocumentAssetRefreshQueue.invalidate(root)
    await SlopDocumentAssetRefreshQueue.finishForTermination()
    #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("QuickLook/Preview.png").path))
    let app = root.appendingPathComponent("app.html")
    let stalled = try String(contentsOf: app, encoding: .utf8).replacingOccurrences(of: "window.slop.ready()", with: "void 0")
    try Data(stalled.utf8).write(to: app)
    SlopDocumentAssetRefreshQueue.schedule(snapshot: try SlopRenderSnapshot(packageURL: root), presentedURL: root)
    let started = ContinuousClock.now
    await SlopDocumentAssetRefreshQueue.finishForTermination(grace: .milliseconds(100))
    #expect(ContinuousClock.now - started < .seconds(1))
    #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("QuickLook/Preview.png").path))
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func compiledChecklistExportsSelectedViewLongContentAndDynamicIcon() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let snapshot = try SlopRenderSnapshot(packageURL: source)
    defer { snapshot.remove() }
    let stores = snapshot.url.appendingPathComponent("stores")
    try FileManager.default.createDirectory(at: stores, withIntermediateDirectories: true)
    let tasks: [[String: Any]] = (0..<120).map { ["id":"task-\($0)","text":"Task \($0) with a second line\nand extra detail", "done":$0 == 0,"archived":false] } + [["id":"filed","text":"Only filed item","done":true,"archived":true]]
    try JSONSerialization.data(withJSONObject: ["title":"A long checklist", "tasks":tasks]).write(to: stores.appendingPathComponent("data.json"))
    let session = try SlopRuntimeSession(packageURL: snapshot.url, renderTargetsEnabled: true)
    defer { session.close() }
    let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = session.webView
    session.load(); try await session.waitUntilReady()
    let long = try #require(PDFDocument(data: try await SlopRenderer.exportPDFData(session: session)))
    #expect(long.pageCount == 1)
    #expect(long.string?.contains("Task 119") == true)
    #expect(long.string?.contains("Only filed item") == false)
    _ = try await session.webView.callAsyncJavaScript("document.querySelector('[role=tab][data-value=filed]')?.click(); const tabs=[...document.querySelectorAll('[role=tab]')]; tabs.find(e=>e.textContent.includes('Filed')).click(); await new Promise(r=>setTimeout(r,0)); return true", arguments: [:], in: nil, contentWorld: .page)
    let filed = try #require(PDFDocument(data: try await SlopRenderer.exportPDFData(session: session)))
    #expect(filed.string?.contains("Only filed item") == true)
    #expect(filed.string?.contains("Task 119") == false)
    #expect(filed.string?.contains("Restore") == false)
    let png = try await SlopRenderer.exportPNGData(session: session)
    let image = try #require(CGImageSourceCreateWithData(png as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
    #expect(image.width == 960)
    let firstIcon = try #require(try await SlopRenderer.targetPNGData(session: session, target: .icon))
    _ = try await session.webView.callAsyncJavaScript("const s=await slop.json.read(); s.value.tasks.forEach(t=>t.done=true); await slop.json.write(s.value,s.revision); await new Promise(r=>setTimeout(r,100)); return true", arguments: [:], in: nil, contentWorld: .page)
    let completedIcon = try #require(try await SlopRenderer.targetPNGData(session: session, target: .icon))
    #expect(firstIcon != completedIcon)
}
