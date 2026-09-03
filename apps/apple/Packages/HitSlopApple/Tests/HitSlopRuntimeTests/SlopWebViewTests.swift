#if os(macOS)
import AppKit
import Foundation
import HitSlopCore
import ImageIO
import Testing
@testable import HitSlopRuntime

@MainActor private final class WindowResizeDelegate: SlopRuntimeSessionDelegate {
    var requested: CGSize?
    func runtimeSession(_ session: SlopRuntimeSession, resizeContentTo size: CGSize) throws -> CGSize {
        requested = size
        return CGSize(width: size.width - 5, height: size.height)
    }
}

@Test @MainActor func unskinnedRuntimeUsesOpaqueWebViewBacking() throws {
    let root = try webViewPackage(skinned: false)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    #expect(!session.usesTransparentBackground)
    #expect(session.webView.value(forKey: "drawsBackground") as? Bool == true)
    let hostScripts = session.webView.configuration.userContentController.userScripts.map(\.source)
    #expect(hostScripts.contains { $0.contains("scrollbar-width:none") && $0.contains("::-webkit-scrollbar") })
}

@Test @MainActor func skinnedRuntimeUsesTransparentWebViewBacking() throws {
    let root = try webViewPackage(skinned: true)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    #expect(session.usesTransparentBackground)
    #expect(session.webView.value(forKey: "drawsBackground") as? Bool == false)
}

@Test @MainActor func transparentStandardRuntimeUsesTransparentWebViewBacking() throws {
    let root = try webViewPackage(skinned: false, transparent: true)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    #expect(session.usesTransparentBackground)
    #expect(session.webView.value(forKey: "drawsBackground") as? Bool == false)
    #expect(!session.package.isSkinned)
    #expect(!session.package.isResizable)
}

@Test @MainActor func runtimeRejectsWindowDragWithoutCurrentMouseDown() throws {
    let root = try webViewPackage(skinned: false, transparent: true)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let session = try SlopRuntimeSession(packageURL: root)
    let window = NSWindow(contentRect: .init(x: 0, y: 0, width: 320, height: 240), styleMask: .borderless, backing: .buffered, defer: false)
    defer { session.close() }

    #expect(throws: SlopPackageError.self) { try session.performWindowDrag(on: window) }
}

@Test @MainActor func runtimeCanFetchNamedMediaThroughItsCustomScheme() async throws {
    let root = try webViewPackage(skinned: false)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let media = root.appendingPathComponent("stores/media", isDirectory: true)
    try FileManager.default.createDirectory(at: media, withIntermediateDirectories: true)
    let zip = Data(base64Encoded: "UEsDBBQAAAAIAG1VIV3uQOUFCQAAAAcAAAAIAAAATUFJTi5CTVBLy6woKS1KBQBQSwECFAAUAAAACABtVSFd7kDlBQkAAAAHAAAACAAAAAAAAAAAAAAAAAAAAAAATUFJTi5CTVBQSwUGAAAAAAEAAQA2AAAALwAAAAAA")!
    try zip.write(to: media.appendingPathComponent("skin"))
    let html = #"""
    <script>
    (async () => {
      try {
        const response = await fetch('/media/skin');
        const bytes = new Uint8Array(await response.arrayBuffer());
        window.fetchResult = { ok: response.ok, type: response.headers.get('content-type'), size: bytes.length, magic: Array.from(bytes.slice(0, 4)).join(',') };
      } catch (error) {
        window.fetchResult = { error: String(error) };
      }
      window.slop.ready();
    })();
    </script>
    """#
    try Data(html.utf8).write(to: root.appendingPathComponent("app.html"))
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    session.load()
    try await session.waitUntilReady()
    let result = try #require(await session.webView.evaluateJavaScript("window.fetchResult") as? [String: Any])
    #expect(result["ok"] as? Bool == true)
    #expect(result["type"] as? String == "application/zip")
    #expect(result["size"] as? Int == zip.count)
    #expect(result["magic"] as? String == "80,75,3,4")
}

@Test @MainActor func runtimeForwardsDynamicWindowResizeAndReturnsAppliedSize() async throws {
    let root = try webViewPackage(skinned: false)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let html = #"""
    <script>
    (async () => {
      window.resizeResult = await window.slop.window.resize({ width: 725, height: 438 });
      window.slop.ready();
    })();
    </script>
    """#
    try Data(html.utf8).write(to: root.appendingPathComponent("app.html"))
    let session = try SlopRuntimeSession(packageURL: root)
    let delegate = WindowResizeDelegate()
    session.delegate = delegate
    defer { session.close() }

    session.load()
    try await session.waitUntilReady()
    #expect(delegate.requested == CGSize(width: 725, height: 438))
    let result = try #require(await session.webView.evaluateJavaScript("window.resizeResult") as? [String: Any])
    #expect((result["width"] as? NSNumber)?.doubleValue == 720)
    #expect((result["height"] as? NSNumber)?.doubleValue == 438)
}

@Test @MainActor func PNGSkinnedRuntimeRejectsDynamicWindowResize() async throws {
    let root = try webViewPackage(skinned: true)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let html = #"""
    <script>
    (async () => {
      try { await window.slop.window.resize({ width: 725, height: 438 }); }
      catch (error) { window.resizeError = String(error); }
      window.slop.ready();
    })();
    </script>
    """#
    try Data(html.utf8).write(to: root.appendingPathComponent("app.html"))
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    session.load()
    try await session.waitUntilReady()
    let error = try #require(await session.webView.evaluateJavaScript("window.resizeError") as? String)
    #expect(error.contains("fixed window size"))
}

@Test @MainActor func runtimeCSPAllowsWebAssemblyWithoutJavaScriptEval() async throws {
    let root = try webViewPackage(skinned: false)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let html = #"""
    <script>
    try {
      new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
      window.wasmResult = 'ok';
    } catch (error) { window.wasmResult = String(error); }
    window.slop.ready();
    </script>
    """#
    try Data(html.utf8).write(to: root.appendingPathComponent("app.html"))
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    session.load()
    try await session.waitUntilReady()
    #expect(try await session.webView.evaluateJavaScript("window.wasmResult") as? String == "ok")
}

@Test @MainActor func runtimeReloadsExternalThemeChangesWithoutReloadingThePage() async throws {
    let root = try webViewPackage(skinned: false)
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let stores = root.appendingPathComponent("stores", isDirectory: true)
    try FileManager.default.createDirectory(at: stores, withIntermediateDirectories: true)
    let theme = stores.appendingPathComponent("theme.css")
    try Data(":root { --slop-test-color: rgb(1, 2, 3); }".utf8).write(to: theme)
    let html = #"""
    <link rel="stylesheet" href="theme.css" data-hitslop-theme>
    <style>body { color: var(--slop-test-color); }</style>
    <script>window.pageMarker = 7; window.slop.ready();</script>
    """#
    try Data(html.utf8).write(to: root.appendingPathComponent("app.html"))
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }

    session.load()
    try await session.waitUntilReady()
    #expect(try await session.webView.evaluateJavaScript("getComputedStyle(document.body).color") as? String == "rgb(1, 2, 3)")

    try Data(":root { --slop-test-color: rgb(4, 5, 6); }".utf8).write(to: theme, options: .atomic)
    let clock = ContinuousClock()
    let deadline = clock.now.advanced(by: .seconds(3))
    var color: String?
    while clock.now < deadline {
        color = try await session.webView.evaluateJavaScript("getComputedStyle(document.body).color") as? String
        if color == "rgb(4, 5, 6)" { break }
        try await Task.sleep(for: .milliseconds(50))
    }
    #expect(color == "rgb(4, 5, 6)")
    #expect(try await session.webView.evaluateJavaScript("window.pageMarker") as? Int == 7)
}

private func webViewPackage(skinned: Bool, transparent: Bool = false) throws -> URL {
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-webview-\(UUID().uuidString)", isDirectory: true)
    let root = parent.appendingPathComponent("fixture.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try Data("<main>Hello</main>".utf8).write(to: root.appendingPathComponent("app.html"))
    let presentation = skinned
        ? #"{"width":320,"height":240,"skin":"assets/skin.png"}"#
        : transparent ? #"{"width":320,"height":240,"resizable":false,"background":"transparent"}"# : #"{"width":320,"height":240}"#
    let manifest = #"{"$schema":"https://hitslop.app/schemas/v1/manifest.schema.json","slug":"webview-fixture","title":"WebView Fixture","description":"Runtime opacity fixture.","categories":["utilities"],"presentation":\#(presentation)}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    try writeCanonicalDocumentSkill(to: root)
    if skinned {
        let assets = root.appendingPathComponent("assets", isDirectory: true)
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        try writeRGBA(to: assets.appendingPathComponent("skin.png"), width: 320, height: 240)
    }
    return root
}

private func writeCanonicalDocumentSkill(to root: URL) throws {
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.createDirectory(at: skill.deletingLastPathComponent(), withIntermediateDirectories: true)
    try SlopPackage.canonicalDocumentSkillData().write(to: skill)
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
