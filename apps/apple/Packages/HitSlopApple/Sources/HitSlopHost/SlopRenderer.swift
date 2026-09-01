import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import WebKit

@MainActor private final class SlopDevelopmentWebView: WKWebView {
    private var windowDragEvent: NSEvent?
    nonisolated(unsafe) private var windowDragMonitor: Any?

    override init(frame: CGRect, configuration: WKWebViewConfiguration) {
        super.init(frame: frame, configuration: configuration)
        windowDragMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] event in
            guard let self, event.window === self.window,
                  self.bounds.contains(self.convert(event.locationInWindow, from: nil)) else { return event }
            self.windowDragEvent = event
            return event
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("SlopDevelopmentWebView must be created programmatically") }

    deinit {
        if let windowDragMonitor { NSEvent.removeMonitor(windowDragMonitor) }
    }

    func consumeWindowDragEvent(for window: NSWindow) -> NSEvent? {
        defer { windowDragEvent = nil }
        guard let event = windowDragEvent, event.type == .leftMouseDown, event.buttonNumber == 0,
              event.window === window, ProcessInfo.processInfo.systemUptime - event.timestamp < 1 else { return nil }
        return event
    }
}

@MainActor private final class SlopDevelopmentWindowBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var window: NSWindow?
    weak var webView: SlopDevelopmentWebView?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any] else {
            replyHandler(nil, "Window request must be an object"); return
        }
        if body["action"] as? String == "drag" {
            guard let window, let event = webView?.consumeWindowDragEvent(for: window) else {
                replyHandler(nil, "Window dragging requires a current left mouse-down gesture"); return
            }
            window.performDrag(with: event); replyHandler(["dragging": true], nil); return
        }
        guard let width = body["width"] as? NSNumber,
              let height = body["height"] as? NSNumber else {
            replyHandler(nil, "Window resize needs numeric width and height"); return
        }
        let requested = NSSize(width: width.doubleValue, height: height.doubleValue)
        guard requested.width.isFinite, requested.height.isFinite,
              requested.width.rounded() == requested.width, requested.height.rounded() == requested.height,
              (240...4096).contains(requested.width), (180...4096).contains(requested.height),
              let window else {
            replyHandler(nil, "Window dimensions must be whole pixels between 240x180 and 4096x4096"); return
        }
        let frame = dynamicSlopWindowFrame(current: window.frame, requested: requested, visible: window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame)
        window.setFrame(frame, display: true, animate: true)
        replyHandler(["width": frame.width, "height": frame.height], nil)
    }
}

public enum SlopRenderTarget: String, Sendable {
    case cover
    case icon
}

struct SlopDocumentAssets: Sendable {
    let previewPNG: Data?
    let finderIconPNG: Data?
}

@MainActor public enum SlopRenderer {
    private enum CaptureOutput { case previewPNG, exportPNG, pdf }
    private static let maximumDimension: CGFloat = 16_384
    private static let maximumArea: CGFloat = 24_000_000
    private static let exportPNGScale: CGFloat = 2
    private static let renderTargetSize: CGFloat = 512

    /// Double-rAF plus a 100ms guard: lets layout and paint settle after a
    /// capture attribute flip or viewport change before measuring/snapshotting.
    /// This is the whole capture-readiness contract: targets must become
    /// visible synchronously (CSS-only) when `data-slop-capture` changes.
    private static let settleScript = #"""
    await new Promise(resolve => {
      let finished = false;
      const finish = () => { if (!finished) { finished = true; resolve(); } };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      setTimeout(finish, 100);
    });
    """#

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

    /// Renders automatic document metadata in one hidden runtime so the
    /// interactive WebView never enters a capture mode.
    static func documentAssetsPNGData(packageURL: URL) async throws -> SlopDocumentAssets {
        let session = try SlopRuntimeSession(packageURL: packageURL, renderTargetsEnabled: true)
        defer { session.close() }
        let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = session.webView
        window.orderOut(nil)
        session.load()
        try await session.waitUntilReady()

        let preview = try? await capture(session: session, output: .previewPNG)
        let icon: Data?
        if let authoredIcon = try await targetPNGData(session: session, target: .icon) {
            icon = authoredIcon
        } else {
            icon = try await targetPNGData(session: session, target: .cover)
        }
        return SlopDocumentAssets(previewPNG: preview, finderIconPNG: icon)
    }

    public static func targetPNGData(packageURL: URL, target: SlopRenderTarget) async throws -> Data? {
        let session = try SlopRuntimeSession(packageURL: packageURL, renderTargetsEnabled: true)
        defer { session.close() }
        let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = session.webView
        window.orderOut(nil)
        session.load()
        try await session.waitUntilReady()
        return try await targetPNGData(session: session, target: target)
    }

    public static func targetPNGData(session: SlopRuntimeSession, target: SlopRenderTarget) async throws -> Data? {
        try await withExpandedRenderViewport(session) {
            let token = UUID().uuidString
            let rect: CGRect?
            do {
                rect = try await prepareTarget(session.webView, token: token, target: target)
            } catch {
                try? await restore(session.webView, token: token)
                throw error
            }
            guard let rect else { return nil }
            let drawsBackground = session.webView.value(forKey: "drawsBackground") as? Bool ?? !session.package.usesTransparentBackground
            session.webView.setValue(false, forKey: "drawsBackground")
            defer { session.webView.setValue(drawsBackground, forKey: "drawsBackground") }
            do {
                let configuration = WKSnapshotConfiguration()
                configuration.rect = rect
                configuration.snapshotWidth = NSNumber(value: Double(renderTargetSize))
                let image = try await session.webView.takeSnapshot(configuration: configuration)
                try await restore(session.webView, token: token)
                return try SlopPreviewImage.png(from: image)
            } catch {
                try? await restore(session.webView, token: token)
                throw error
            }
        }
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
            \#(settleScript)
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

    private static func prepareTarget(_ webView: WKWebView, token: String, target: SlopRenderTarget) async throws -> CGRect? {
        let value = try await webView.callAsyncJavaScript(
            #"""
            const matches = [...document.querySelectorAll(`[data-slop-render="${target}"]`)];
            if (matches.length === 0) return { found: false };
            if (matches.length !== 1) return { found: true, count: matches.length };
            const root = document.documentElement;
            const states = window.__hitslopCaptureStates ??= new Map();
            const style = document.createElement('style');
            style.dataset.hitslopCaptureStyle = token;
            style.textContent = 'html,body{background:transparent!important}';
            states.set(token, {
              capture: root.getAttribute('data-slop-capture'),
              active: document.activeElement instanceof HTMLElement ? document.activeElement : null,
              scrollX: window.scrollX,
              scrollY: window.scrollY,
              style
            });
            document.head.append(style);
            states.get(token).active?.blur();
            root.setAttribute('data-slop-capture', target);
            window.scrollTo(0, 0);
            \#(settleScript)
            const rect = matches[0].getBoundingClientRect();
            return { found: true, count: 1, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            """#,
            arguments: ["token": token, "target": target.rawValue],
            in: nil,
            contentWorld: .page
        )
        guard let result = value as? [String: Any], let found = result["found"] as? Bool else {
            throw SlopPackageError.invalid("could not inspect the \(target.rawValue) render target")
        }
        guard found else { return nil }
        let count = (result["count"] as? NSNumber)?.intValue ?? 0
        guard count == 1 else {
            throw SlopPackageError.invalid("expected one \(target.rawValue) render target, found \(count)")
        }
        guard let x = result["x"] as? NSNumber,
              let y = result["y"] as? NSNumber,
              let width = result["width"] as? NSNumber,
              let height = result["height"] as? NSNumber else {
            throw SlopPackageError.invalid("could not measure the \(target.rawValue) render target")
        }
        let rect = CGRect(x: CGFloat(truncating: x), y: CGFloat(truncating: y), width: CGFloat(truncating: width), height: CGFloat(truncating: height))
        guard rect.width > 0, rect.height > 0, abs(rect.width - rect.height) < 0.5 else {
            throw SlopPackageError.invalid("\(target.rawValue) render target must be a visible square")
        }
        guard rect.minX >= -0.5, rect.minY >= -0.5,
              rect.maxX <= webView.bounds.width + 0.5, rect.maxY <= webView.bounds.height + 0.5 else {
            throw SlopPackageError.invalid("\(target.rawValue) render target must fit inside the slop window")
        }
        return rect
    }

    private static func withExpandedRenderViewport<T: Sendable>(_ session: SlopRuntimeSession, perform: () async throws -> T) async throws -> T {
        let originalFrame = session.webView.frame
        defer { session.webView.frame = originalFrame }
        let width = max(originalFrame.width, renderTargetSize)
        let height = max(originalFrame.height, renderTargetSize)
        if width != originalFrame.width || height != originalFrame.height {
            session.webView.frame = CGRect(origin: originalFrame.origin, size: CGSize(width: width, height: height))
            try await settle(session.webView)
        }
        return try await perform()
    }

    private static func settle(_ webView: WKWebView) async throws {
        _ = try await webView.callAsyncJavaScript(settleScript, arguments: [:], in: nil, contentWorld: .page)
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
            state.style?.remove();
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
        let configuration = WKWebViewConfiguration()
        let bridge = SlopDevelopmentWindowBridge()
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "hitslopDevWindow")
        let view = SlopDevelopmentWebView(frame: .init(origin: .zero, size: size), configuration: configuration)
        let window = NSWindow(contentRect: view.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        bridge.window = window; bridge.webView = view
        window.title = "hitSlop Dev"
        window.contentView = view
        view.load(URLRequest(url: url))
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
}
