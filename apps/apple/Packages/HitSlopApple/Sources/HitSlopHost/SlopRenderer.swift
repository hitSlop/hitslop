import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import WebKit

@MainActor public enum SlopRenderer {
    private enum CaptureOutput { case previewPNG, exportPNG, pdf }
    private static let maximumDimension: CGFloat = 16_384
    private static let maximumArea: CGFloat = 24_000_000
    private static let exportPNGScale: CGFloat = 2

    public static func previewPNGData(packageURL: URL) async throws -> Data {
        try await render(packageURL: packageURL, output: .previewPNG)
    }

    public static func exportPNGData(packageURL: URL) async throws -> Data {
        try await render(packageURL: packageURL, output: .exportPNG)
    }

    public static func exportPDFData(packageURL: URL) async throws -> Data {
        try await render(packageURL: packageURL, output: .pdf)
    }

    public static func previewPNGData(session: SlopRuntimeSession) async throws -> Data {
        try await capture(session: session, output: .previewPNG)
    }

    public static func exportPNGData(session: SlopRuntimeSession) async throws -> Data {
        try await capture(session: session, output: .exportPNG)
    }

    public static func exportPDFData(session: SlopRuntimeSession) async throws -> Data {
        try await capture(session: session, output: .pdf)
    }

    private static func render(packageURL: URL, output: CaptureOutput) async throws -> Data {
        let session = try SlopRuntimeSession(packageURL: packageURL)
        defer { session.close() }
        let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = session.webView
        window.orderOut(nil)
        session.load()
        try await session.waitUntilReady()
        return try await capture(session: session, output: output)
    }

    private static func capture(session: SlopRuntimeSession, output: CaptureOutput) async throws -> Data {
        let token = UUID().uuidString
        let documentHeight = try await prepare(session.webView, token: token)
        let originalFrame = session.webView.frame

        let width = max(1, session.webView.bounds.width)
        let isPreview = if case .previewPNG = output { true } else { false }
        let height = isPreview ? max(1, session.webView.bounds.height) : max(session.webView.bounds.height, documentHeight)
        let pixelScale: CGFloat = if case .exportPNG = output { exportPNGScale } else { 1 }
        let outputWidth = width * pixelScale
        let outputHeight = height * pixelScale
        guard outputWidth <= maximumDimension, outputHeight <= maximumDimension, outputWidth * outputHeight <= maximumArea else {
            try? await restore(session.webView, token: token)
            throw SlopPackageError.invalid("static capture is too large (\(Int(outputWidth))×\(Int(outputHeight))); keep it within 16384px per side and 24 megapixels")
        }

        do {
            if !isPreview, height != session.webView.bounds.height {
                session.webView.frame = CGRect(origin: originalFrame.origin, size: CGSize(width: width, height: height))
                try await settle(session.webView)
            }
            let data: Data
            switch output {
            case .previewPNG, .exportPNG:
                let configuration = WKSnapshotConfiguration()
                configuration.rect = CGRect(x: 0, y: 0, width: width, height: height)
                configuration.snapshotWidth = NSNumber(value: Double(outputWidth))
                let image = try await session.webView.takeSnapshot(configuration: configuration)
                data = try SlopPreviewImage.png(from: image, package: session.package, scale: pixelScale)
            case .pdf:
                _ = try await session.webView.callAsyncJavaScript(
                    #"""
                    const style = document.querySelector(`[data-hitslop-capture-style="${token}"]`);
                    if (style) style.textContent += `@page{size:${width}px ${height}px;margin:0}`;
                    """#,
                    arguments: ["token": token, "width": width, "height": height],
                    in: nil,
                    contentWorld: .page
                )
                try await settle(session.webView)
                let configuration = WKPDFConfiguration()
                configuration.rect = CGRect(x: 0, y: 0, width: width, height: height)
                configuration.allowTransparentBackground = false
                data = try await session.webView.pdf(configuration: configuration)
            }
            session.webView.frame = originalFrame
            try await restore(session.webView, token: token)
            return data
        } catch {
            session.webView.frame = originalFrame
            try? await restore(session.webView, token: token)
            throw error
        }
    }

    private static func prepare(_ webView: WKWebView, token: String) async throws -> CGFloat {
        let value = try await webView.callAsyncJavaScript(
            #"""
            const root = document.documentElement;
            const states = window.__hitslopCaptureStates ??= new Map();
            const style = document.createElement('style');
            style.dataset.hitslopCaptureStyle = token;
            style.textContent = 'html[data-slop-capture="static"] [data-slop-export="hide"]{display:none!important}';
            states.set(token, {
              capture: root.getAttribute('data-slop-capture'),
              active: document.activeElement instanceof HTMLElement ? document.activeElement : null,
              scrollX: window.scrollX,
              scrollY: window.scrollY,
              style
            });
            document.head.append(style);
            states.get(token).active?.blur();
            root.setAttribute('data-slop-capture', 'static');
            window.scrollTo(0, 0);
            await new Promise(resolve => {
              let finished = false;
              const finish = () => { if (!finished) { finished = true; resolve(); } };
              requestAnimationFrame(() => requestAnimationFrame(finish));
              setTimeout(finish, 100);
            });
            const body = document.body;
            return {
              height: Math.ceil(Math.max(
                root.scrollHeight, root.offsetHeight, root.clientHeight,
                body?.scrollHeight ?? 0, body?.offsetHeight ?? 0, body?.clientHeight ?? 0
              ))
            };
            """#,
            arguments: ["token": token],
            in: nil,
            contentWorld: .page
        )
        guard let result = value as? [String: Any], let height = result["height"] as? NSNumber else {
            throw SlopPackageError.invalid("could not measure the document for static capture")
        }
        return CGFloat(truncating: height)
    }

    private static func settle(_ webView: WKWebView) async throws {
        _ = try await webView.callAsyncJavaScript(
            #"""
            await new Promise(resolve => {
              let finished = false;
              const finish = () => { if (!finished) { finished = true; resolve(); } };
              requestAnimationFrame(() => requestAnimationFrame(finish));
              setTimeout(finish, 100);
            });
            """#,
            arguments: [:],
            in: nil,
            contentWorld: .page
        )
    }

    private static func restore(_ webView: WKWebView, token: String) async throws {
        _ = try await webView.callAsyncJavaScript(
            #"""
            const states = window.__hitslopCaptureStates;
            const state = states?.get(token);
            if (!state) return;
            const root = document.documentElement;
            if (state.capture === null) root.removeAttribute('data-slop-capture');
            else root.setAttribute('data-slop-capture', state.capture);
            state.style.remove();
            window.scrollTo(state.scrollX, state.scrollY);
            state.active?.focus({ preventScroll: true });
            states.delete(token);
            """#,
            arguments: ["token": token],
            in: nil,
            contentWorld: .page
        )
    }

    public static func openDevelopmentURL(_ url: URL, size: CGSize) {
        let view = WKWebView(frame: .init(origin: .zero, size: size))
        view.load(URLRequest(url: url))
        let window = NSWindow(contentRect: view.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.title = "hitSlop Dev"
        window.contentView = view
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
}
