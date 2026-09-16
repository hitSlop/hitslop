import AppKit
import Foundation
import WebKit
import UniformTypeIdentifiers
import HitSlopSQLiteArchive
import HitSlopSQLiteSpike

@MainActor public final class SQLiteWebView: NSObject, WKScriptMessageHandlerWithReply {
    public let webView: WKWebView
    public let document: SQLiteDocument
    private let scheme: ArchiveScheme
    private var publications: Task<Void, Never>?
    public var onChange: ((SQLiteFrame) -> Void)?
    public var onError: ((String) -> Void)?
    public init(document: SQLiteDocument, renderer: Bool = false) throws {
        self.document = document
        scheme = try ArchiveScheme(url: document.url, renderer: renderer)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.setURLSchemeHandler(scheme, forURLScheme: "slopsql")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 480, height: 620), configuration: config)
        super.init()
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "hitslopNativeSpike")
        config.userContentController.addUserScript(WKUserScript(source: """
        window.__sqliteReady = false;
        window.__spikeWasmCalls = 0;
        for (const key of ['instantiate','instantiateStreaming','compile','compileStreaming']) WebAssembly[key] = () => { window.__spikeWasmCalls++; throw Error('Native SQLite spike does not use WASM'); };
        window.slop = {ready: () => {window.__sqliteReady = true}, errors: {
          report: async value => window.webkit.messageHandlers.hitslopNativeSpike.postMessage({method:'error',message:value.message + ': ' + value.details}), clear: async () => {}
        }};
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView.setValue(false, forKey: "drawsBackground")
        publications = Task { [weak self, document] in
            do {
                for await frame in try await document.events() {
                    guard let self else { return }
                    let value = try JSONSerialization.jsonObject(with: frame.encoded())
                    _ = try? await self.webView.callAsyncJavaScript("""
                    window.__spikePublish?.(frame);
                    const link = document.querySelector('[data-hitslop-theme]');
                    if (link) { link.href = 'theme.css?revision=' + frame.publication; }
                    """, arguments: ["frame": value], in: nil, contentWorld: .page)
                    self.onChange?(frame)
                }
            } catch { self?.onError?(error.localizedDescription) }
        }
        webView.load(URLRequest(url: URL(string: "slopsql://document/index.html")!))
    }
    public func waitUntilReady() async throws {
        for _ in 0..<200 {
            if (try? await webView.evaluateJavaScript("window.__sqliteReady === true")) as? Bool == true { return }
            try await Task.sleep(for: .milliseconds(50))
        }
        throw SQLiteFailure("Checklist did not become ready")
    }
    public func flush() async throws { _ = try await webView.callAsyncJavaScript("await window.__hitslopFlush?.()", arguments: [:], in: nil, contentWorld: .page) }
    public func detach() {
        publications?.cancel(); publications = nil
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "hitslopNativeSpike", contentWorld: .page)
        webView.stopLoading()
    }
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.scheme == "slopsql" else { replyHandler(nil, "Document frame required"); return }
        if let body = message.body as? [String: Any], body["method"] as? String == "error" {
            onError?(body["message"] as? String ?? "Document error"); replyHandler(nil, nil); return
        }
        do {
            let bytes = try JSONSerialization.data(withJSONObject: message.body, options: .sortedKeys)
            Task {
                do {
                    let response = try await document.request(bytes)
                    replyHandler(try JSONSerialization.jsonObject(with: response), nil)
                }
                catch { onError?(error.localizedDescription); replyHandler(nil, error.localizedDescription) }
            }
        } catch { replyHandler(nil, error.localizedDescription) }
    }
}

@MainActor private final class ArchiveScheme: NSObject, WKURLSchemeHandler {
    private let db: SQLiteArchive
    private let renderer: Bool
    init(url: URL, renderer: Bool) throws { db = try SQLiteArchive(url: url); self.renderer = renderer }
    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        do {
            guard let url = task.request.url, url.host == "document" else { throw SQLiteFailure("Unknown resource origin") }
            let name = url.path == "/index.html" ? "app.html" : String(url.path.dropFirst())
            let data: Data
            if name == "theme.css" {
                let json = try db.query("SELECT theme FROM document WHERE id=1").first?["theme"]?.text ?? "{}"
                let theme = try JSONDecoder().decode([String: String].self, from: Data(json.utf8))
                data = Data((":root {\n" + theme.sorted(by: { $0.key < $1.key }).map { "  \($0.key): \($0.value);" }.joined(separator: "\n") + "\n}").utf8)
            } else {
                let bytes = try db.asset(name)
                data = renderer && name == "app.html" ? Data(String(decoding: bytes, as: UTF8.self).replacingOccurrences(of: "<html", with: "<html data-slop-renderer=\"true\"").utf8) : bytes
            }
            let ext = (name as NSString).pathExtension
            let mime = ["js": "text/javascript", "css": "text/css", "html": "text/html", "json": "application/json", "svg": "image/svg+xml"][ext] ?? UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
                "Content-Type": mime, "Content-Length": String(data.count), "Cache-Control": "no-store",
                "Content-Security-Policy": "default-src 'none'; script-src slopsql: 'unsafe-inline'; style-src slopsql: 'unsafe-inline'; img-src slopsql: data: blob:; font-src slopsql: data:; connect-src slopsql:; media-src slopsql: blob:; worker-src blob:"
            ])!
            task.didReceive(response); task.didReceive(data); task.didFinish()
        } catch { task.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}

@MainActor public enum SQLiteArtwork {
    public static func png(_ image: NSImage) throws -> Data {
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let bytes = bitmap.representation(using: .png, properties: [:]) else { throw SQLiteFailure("Cannot encode image") }
        return bytes
    }
    public static func fixture(label: String, color: NSColor, size: NSSize) throws -> Data {
        let image = NSImage(size: size, flipped: false) { rect in
            color.setFill(); NSBezierPath(roundedRect: rect.insetBy(dx: 12, dy: 12), xRadius: 48, yRadius: 48).fill()
            let style = NSMutableParagraphStyle(); style.alignment = .center
            (label as NSString).draw(in: NSRect(x: 20, y: size.height / 2 - 45, width: size.width - 40, height: 100), withAttributes: [.font: NSFont.boldSystemFont(ofSize: 64), .foregroundColor: NSColor.white, .paragraphStyle: style])
            return true
        }
        return try png(image)
    }
    public static func installIcon(_ bytes: Data, at url: URL) throws {
        guard let image = NSImage(data: bytes), NSWorkspace.shared.setIcon(image, forFile: url.path, options: []) else { throw SQLiteFailure("Finder rejected custom icon") }
    }
    public static func capture(document: SQLiteDocument, installIcon: Bool = true) async throws -> (preview: Data, icon: Data, generation: Int64, accepted: Bool) {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-sqlite-capture-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let snapshotURL = root.appendingPathComponent("snapshot.slopsql")
        let generation = try await document.snapshot(to: snapshotURL)
        let snapshot = try SQLiteDocument(url: snapshotURL)
        let view = try SQLiteWebView(document: snapshot, renderer: true)
        let window = NSWindow(contentRect: NSRect(x: -2000, y: -2000, width: 480, height: 620), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = view.webView; window.orderFront(nil)
        defer { view.detach(); window.close() }
        do {
            try await view.waitUntilReady()
            let preview = try await render(view.webView, mode: "preview", size: NSSize(width: 480, height: 620))
            let icon = try await render(view.webView, mode: "icon", size: NSSize(width: 512, height: 512))
            let accepted = try await document.saveArtwork(preview: preview, icon: icon, generation: generation)
            if accepted && installIcon { try self.installIcon(icon, at: document.url) }
            try await snapshot.close()
            return (preview, icon, generation, accepted)
        } catch { try? await snapshot.close(); throw error }
    }
    public static func render(_ view: WKWebView, mode: String, size: NSSize) async throws -> Data {
        view.setFrameSize(size)
        let token = UUID().uuidString
        do {
            _ = try await view.callAsyncJavaScript("return await window.__hitslopCapture.begin(token, mode)", arguments: ["token": token, "mode": mode], in: nil, contentWorld: .page)
            let config = WKSnapshotConfiguration(); config.rect = NSRect(origin: .zero, size: size); config.snapshotWidth = NSNumber(value: Double(size.width))
            let image = try await view.takeSnapshot(configuration: config)
            _ = try await view.callAsyncJavaScript("await window.__hitslopCapture.restore(token)", arguments: ["token": token], in: nil, contentWorld: .page)
            if mode == "icon" {
                guard let source = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
                      let context = CGContext(data: nil, width: 512, height: 512, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw SQLiteFailure("Cannot size icon") }
                context.interpolationQuality = .high
                context.draw(source, in: CGRect(x: 0, y: 0, width: 512, height: 512))
                guard let cg = context.makeImage(), let bytes = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:]) else { throw SQLiteFailure("Cannot encode icon") }
                return bytes
            }
            return try png(image)
        } catch {
            _ = try? await view.callAsyncJavaScript("await window.__hitslopCapture.restore(token)", arguments: ["token": token], in: nil, contentWorld: .page)
            throw error
        }
    }
}
