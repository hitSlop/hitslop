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
    case icon
}

struct SlopDocumentAssets: Sendable {
    let previewPNG: Data?
    let finderIconPNG: Data?
}

@MainActor public enum SlopRenderer {
    private enum CaptureOutput { case previewPNG, exportPNG, pdf }
    private static var waiters: [ObjectIdentifier: [CheckedContinuation<Void, Never>]] = [:]

    private static func acquire(_ session: SlopRuntimeSession) async {
        let key = ObjectIdentifier(session)
        if waiters[key] == nil { waiters[key] = []; return }
        await withCheckedContinuation { waiters[key, default: []].append($0) }
    }
    private static func release(_ session: SlopRuntimeSession) {
        let key = ObjectIdentifier(session)
        if waiters[key]?.isEmpty == false { waiters[key]?.removeFirst().resume() }
        else { waiters.removeValue(forKey: key) }
    }

    public static func previewPNGData(packageURL: URL) async throws -> Data { try await render(packageURL: packageURL, output: .previewPNG) }
    public static func exportPNGData(packageURL: URL) async throws -> Data { try await render(packageURL: packageURL, output: .exportPNG) }
    public static func exportPDFData(packageURL: URL) async throws -> Data { try await render(packageURL: packageURL, output: .pdf) }
    public static func previewPNGData(session: SlopRuntimeSession) async throws -> Data { try await capture(session: session, output: .previewPNG) }
    public static func exportPNGData(session: SlopRuntimeSession) async throws -> Data { try await capture(session: session, output: .exportPNG) }
    public static func exportPDFData(session: SlopRuntimeSession) async throws -> Data { try await capture(session: session, output: .pdf) }

    static func documentAssetsPNGData(packageURL: URL) async throws -> SlopDocumentAssets {
        let snapshot = try SlopRenderSnapshot(packageURL: packageURL)
        defer { snapshot.remove() }
        return try await documentAssetsPNGData(snapshot: snapshot)
    }

    static func documentAssetsPNGData(snapshot: SlopRenderSnapshot) async throws -> SlopDocumentAssets {
        let session = try SlopRuntimeSession(packageURL: snapshot.url, renderTargetsEnabled: true)
        defer { session.close() }
        let window = hiddenWindow(session)
        defer { window.contentView = nil }
        session.load()
        try await session.waitUntilReady()
        var preview: Data?, icon: Data?
        do { preview = try await capture(session: session, output: .previewPNG) }
        catch { print("[hitSlop assets] Preview failed: \(error.localizedDescription)") }
        try Task.checkCancellation()
        do { icon = try await targetPNGData(session: session, target: .icon) }
        catch { print("[hitSlop assets] Icon failed: \(error.localizedDescription)") }
        return SlopDocumentAssets(previewPNG: preview, finderIconPNG: icon)
    }

    private static func hiddenWindow(_ session: SlopRuntimeSession) -> NSWindow {
        let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = session.webView
        window.orderOut(nil)
        return window
    }

    public static func targetPNGData(packageURL: URL, target: SlopRenderTarget) async throws -> Data? {
        let snapshot = try SlopRenderSnapshot(packageURL: packageURL)
        defer { snapshot.remove() }
        let session = try SlopRuntimeSession(packageURL: snapshot.url, renderTargetsEnabled: true)
        defer { session.close() }
        let window = hiddenWindow(session)
        defer { window.contentView = nil }
        session.load()
        try await session.waitUntilReady()
        return try await targetPNGData(session: session, target: target)
    }

    public static func targetPNGData(session: SlopRuntimeSession, target: SlopRenderTarget) async throws -> Data? {
        await acquire(session)
        defer { release(session) }
        try Task.checkCancellation()
        let token = UUID().uuidString, originalFrame = session.webView.frame
        let background = session.webView.value(forKey: "drawsBackground") as? Bool ?? true
        defer { session.webView.setValue(background, forKey: "drawsBackground") }
        do {
            session.webView.frame.size = CGSize(width: max(512, originalFrame.width), height: max(512, originalFrame.height))
            _ = try await begin(session.webView, token: token, mode: "icon")
            let value = try await session.webView.callAsyncJavaScript(#"""
                const matches = [...document.querySelectorAll('[data-slop-render="icon"]')];
                if (!matches.length) return null;
                if (matches.length !== 1) return {count:matches.length};
                const rect = matches[0].getBoundingClientRect();
                return {x:rect.x,y:rect.y,width:rect.width,height:rect.height};
                """#, arguments: [:], in: nil, contentWorld: .page)
            guard let value = value as? [String: Any] else {
                session.webView.frame = originalFrame
                try await restore(session.webView, token: token)
                return nil
            }
            if value["count"] != nil { throw SlopPackageError.invalid("Expected one icon capture target") }
            let rect = try geometry(value)
            guard rect.width > 0, abs(rect.width - rect.height) < 0.5,
                  rect.minX >= -0.5, rect.minY >= -0.5,
                  rect.maxX <= session.webView.bounds.width + 0.5, rect.maxY <= session.webView.bounds.height + 0.5 else {
                throw SlopPackageError.invalid("icon target must be a visible square inside the capture viewport")
            }
            session.webView.setValue(false, forKey: "drawsBackground")
            let configuration = WKSnapshotConfiguration()
            configuration.rect = rect
            configuration.snapshotWidth = 512
            let image = try await session.webView.takeSnapshot(configuration: configuration)
            let data = try SlopPreviewImage.png(from: image)
            session.webView.frame = originalFrame
            try await restore(session.webView, token: token)
            return data
        } catch {
            session.webView.frame = originalFrame
            try? await restore(session.webView, token: token)
            throw captureFailure(error)
        }
    }

    private static func render(packageURL: URL, output: CaptureOutput) async throws -> Data {
        let snapshot = try SlopRenderSnapshot(packageURL: packageURL)
        defer { snapshot.remove() }
        let session = try SlopRuntimeSession(packageURL: snapshot.url)
        defer { session.close() }
        let window = hiddenWindow(session)
        defer { window.contentView = nil }
        session.load()
        try await session.waitUntilReady()
        return try await capture(session: session, output: output)
    }

    private static func capture(session: SlopRuntimeSession, output: CaptureOutput) async throws -> Data {
        await acquire(session)
        defer { release(session) }
        try Task.checkCancellation()
        let token = UUID().uuidString, originalFrame = session.webView.frame
        let isPreview = output == .previewPNG
        let background = session.webView.value(forKey: "drawsBackground") as? Bool ?? true
        defer { session.webView.setValue(background, forKey: "drawsBackground") }
        do {
            var measurement = try await begin(session.webView, token: token, mode: isPreview ? "preview" : "export")
            let dedicated = measurement["dedicated"] as? Bool == true
            var width = originalFrame.width
            var height = isPreview ? originalFrame.height : max(dedicated ? 1 : originalFrame.height, try geometry(measurement).height)
            var rect = CGRect(x: 0, y: 0, width: width, height: height)
            // Dedicated exports are the object itself, independent of the native window mask.
            // Re-measure after resizing; reject viewport-dependent layouts that never settle.
            // PDF captures offscreen content directly; avoid an enormous backing view.
            if isPreview && dedicated {
                var box = try geometry(measurement)
                var viewWidth = originalFrame.width
                var viewHeight = originalFrame.height
                var settled = false
                for _ in 0..<4 {
                    if max(0, box.width - viewWidth, ceil(box.maxX) - viewWidth) >= 48 {
                        viewWidth = max(viewWidth, box.width, ceil(box.maxX))
                    }
                    if max(0, box.height - viewHeight, ceil(box.maxY) - viewHeight) >= 1 {
                        viewHeight = max(viewHeight, box.height, ceil(box.maxY))
                    }
                    try validateSize(width: max(min(box.width, viewWidth), 1), height: max(min(box.height, viewHeight), 1), output: output, scale: 2)
                    session.webView.frame.size = CGSize(width: viewWidth, height: viewHeight)
                    _ = try await session.webView.callAsyncJavaScript("await window.__hitslopCapture.settle(token)", arguments: ["token": token], in: nil, contentWorld: .page)
                    measurement = try await measure(session.webView, token: token)
                    let next = try geometry(measurement)
                    let bounds = CGRect(x: 0, y: 0, width: viewWidth, height: viewHeight)
                    let visible = next.intersection(bounds)
                    if next.minX >= -0.5, next.minY >= -0.5,
                       next.maxX <= viewWidth + 48, next.maxY <= viewHeight + 48,
                       visible.width >= 8, visible.height >= 8 {
                        settled = true
                        box = visible
                        break
                    }
                    box = next
                }
                guard settled else { throw SlopPackageError.invalid("Preview export layout keeps changing with viewport size; use normal flow in Export.svelte") }
                width = max(box.width, 1)
                height = max(box.height, 1)
                rect = CGRect(x: box.minX, y: box.minY, width: width, height: height)
            } else if output == .exportPNG {
                var settled = false
                for _ in 0..<4 {
                    try validateSize(width: width, height: height, output: output, scale: 2)
                    session.webView.frame.size = CGSize(width: width, height: height)
                    _ = try await session.webView.callAsyncJavaScript("await window.__hitslopCapture.settle(token)", arguments: ["token": token], in: nil, contentWorld: .page)
                    measurement = try await measure(session.webView, token: token)
                    let next = max(dedicated ? 1 : originalFrame.height, try geometry(measurement).height)
                    if abs(next - height) < 1 { settled = true; break }
                    height = next
                }
                guard settled else { throw SlopPackageError.invalid("Export layout keeps changing with viewport height; use normal flow in Export.svelte") }
                rect = CGRect(x: 0, y: 0, width: width, height: height)
            }
            let scale: CGFloat = output == .exportPNG || (isPreview && dedicated) ? 2 : 1
            try validateSize(width: width, height: height, output: output, scale: scale)
            let data: Data
            switch output {
            case .previewPNG, .exportPNG:
                let configuration = WKSnapshotConfiguration()
                configuration.rect = rect
                configuration.snapshotWidth = NSNumber(value: Double(width * scale))
                if dedicated { session.webView.setValue(false, forKey: "drawsBackground") }
                let image = try await session.webView.takeSnapshot(configuration: configuration)
                data = dedicated ? try SlopPreviewImage.png(from: image) : try SlopPreviewImage.png(from: image, package: session.package, scale: scale)
            case .pdf:
                let configuration = WKPDFConfiguration()
                configuration.rect = rect
                configuration.allowTransparentBackground = false
                data = try continuousPDF(try await session.webView.pdf(configuration: configuration), size: rect.size)
            }
            session.webView.frame = originalFrame
            try await restore(session.webView, token: token)
            return data
        } catch {
            session.webView.frame = originalFrame
            try? await restore(session.webView, token: token)
            throw captureFailure(error)
        }
    }

    /// WebKit splits captures taller than 14,400 points. Recompose its vector
    /// pages onto one continuous canvas without rasterizing text or artwork.
    private static func continuousPDF(_ data: Data, size: CGSize) throws -> Data {
        guard let provider = CGDataProvider(data: data as CFData), let source = CGPDFDocument(provider) else {
            throw SlopPackageError.invalid("Could not read captured PDF")
        }
        guard source.numberOfPages > 1 else { return data }
        let output = NSMutableData()
        // Keep page coordinates within Acrobat's supported range. Uniform vector
        // scaling preserves the complete document without an oversized MediaBox.
        let scale = min(1, 14_400 / max(size.width, size.height))
        var bounds = CGRect(x: 0, y: 0, width: size.width * scale, height: size.height * scale)
        guard bounds.width >= 3, bounds.height >= 3 else { throw SlopPackageError.invalid("Document aspect ratio exceeds single-page PDF limits") }
        guard let consumer = CGDataConsumer(data: output), let context = CGContext(consumer: consumer, mediaBox: &bounds, nil) else {
            throw SlopPackageError.invalid("Could not create continuous PDF")
        }
        context.beginPDFPage(nil)
        context.scaleBy(x: scale, y: scale)
        var top = size.height
        for number in 1...source.numberOfPages {
            guard let page = source.page(at: number) else { throw SlopPackageError.invalid("Missing captured PDF page") }
            let box = page.getBoxRect(.mediaBox)
            top -= box.height
            context.saveGState()
            context.translateBy(x: -box.minX, y: top - box.minY)
            context.drawPDFPage(page)
            context.restoreGState()
        }
        context.endPDFPage()
        context.closePDF()
        return output as Data
    }

    private static func captureFailure(_ error: Error) -> Error {
        if let message = (error as NSError).userInfo["WKJavaScriptExceptionMessage"] as? String {
            return SlopPackageError.invalid("Capture failed: \(message)")
        }
        return error
    }

    private static func validateSize(width: CGFloat, height: CGFloat, output: CaptureOutput, scale: CGFloat) throws {
        guard width.isFinite, height.isFinite, width > 0, height > 0 else { throw SlopPackageError.invalid("Invalid capture dimensions") }
        // PDF is vector output: a raster pixel budget would reject valid long documents.
        guard output != .pdf else { return }
        guard width * scale <= 16_384, height * scale <= 16_384, width * height * scale * scale <= 24_000_000 else {
            throw SlopPackageError.invalid("PNG exceeds 16384 pixels per side or 24 megapixels at \(Int(scale))×; export as PDF for longer documents")
        }
    }
    private static func geometry(_ value: [String: Any]) throws -> CGRect {
        guard let width = value["width"] as? NSNumber, let height = value["height"] as? NSNumber else { throw SlopPackageError.invalid("Could not measure capture content") }
        return CGRect(x: (value["x"] as? NSNumber)?.doubleValue ?? 0, y: (value["y"] as? NSNumber)?.doubleValue ?? 0, width: width.doubleValue, height: height.doubleValue)
    }
    private static func begin(_ view: WKWebView, token: String, mode: String) async throws -> [String: Any] {
        guard let value = try await view.callAsyncJavaScript("return await window.__hitslopCapture.begin(token, mode)", arguments: ["token": token, "mode": mode], in: nil, contentWorld: .page) as? [String: Any] else { throw SlopPackageError.invalid("Could not prepare capture") }
        return value
    }
    private static func measure(_ view: WKWebView, token: String) async throws -> [String: Any] {
        guard let value = try await view.callAsyncJavaScript("return window.__hitslopCapture.measure(token)", arguments: ["token": token], in: nil, contentWorld: .page) as? [String: Any] else { throw SlopPackageError.invalid("Could not measure capture") }
        return value
    }
    private static func restore(_ view: WKWebView, token: String) async throws {
        _ = try await view.callAsyncJavaScript("await window.__hitslopCapture.restore(token)", arguments: ["token": token], in: nil, contentWorld: .page)
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
