import AppKit
import Foundation
import WebKit
#if SWIFT_PACKAGE
import SlopCore
#endif

@MainActor
enum SlopHeadlessRenderer {
    enum Format: String { case png, pdf }

    static func render(packageURL: URL, format: Format) async throws -> Data {
        let application = NSApplication.shared
        if !application.isRunning {
            application.setActivationPolicy(.prohibited)
            application.finishLaunching()
        }
        let database = try SlopDatabase(packageURL: packageURL, readOnly: true, restricted: true)
        let metadata = try database.metadata()
        let configuration = WKWebViewConfiguration()
        let scheme = RenderSchemeHandler(database: database)
        let bridge = RenderBridge(database: database)
        configuration.setURLSchemeHandler(scheme, forURLScheme: "slop")
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "slop")
        configuration.userContentController.addUserScript(WKUserScript(source: slopRuntimeJavaScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.addUserScript(WKUserScript(source: slopHostStyleJavaScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.websiteDataStore = .nonPersistent()

        let view = WKWebView(frame: CGRect(x: 0, y: 0, width: metadata.width, height: metadata.height), configuration: configuration)
        // WebKit does not reliably produce layout or snapshots for a view that
        // has never belonged to a window. Keep a borderless host offscreen for
        // the duration of the render so the CLI remains visually headless.
        let hostWindow = NSWindow(
            contentRect: view.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        hostWindow.contentView = view
        hostWindow.setFrameOrigin(NSPoint(x: -10_000, y: -10_000))
        hostWindow.orderBack(nil)
        defer { hostWindow.orderOut(nil) }

        let navigation = RenderNavigationDelegate()
        view.navigationDelegate = navigation
        let html = try SlopCheckedRenderer.displayHTML(from: database)
        try await navigation.load(html: html, in: view)
        try await Task.sleep(for: .milliseconds(350))

        let evaluated = try? await view.evaluateJavaScript("[Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)]")
        let dimensions = evaluated as? [Double] ?? []
        let width = min(max(dimensions.first ?? metadata.width, metadata.width), 4_000)
        let height = min(max(dimensions.dropFirst().first ?? metadata.height, metadata.height), 20_000)
        view.frame = CGRect(x: 0, y: 0, width: width, height: height)
        try await Task.sleep(for: .milliseconds(100))

        switch format {
        case .png:
            let snapshot = WKSnapshotConfiguration()
            snapshot.rect = view.bounds
            let image = try await view.takeSnapshot(configuration: snapshot)
            guard let data = image.pngData else { throw SlopError.invalidArgument("Could not encode PNG.") }
            return data
        case .pdf:
            let pdf = WKPDFConfiguration()
            pdf.rect = view.bounds
            return try await view.pdf(configuration: pdf)
        }
    }
}

private final class RenderSchemeHandler: NSObject, WKURLSchemeHandler {
    let database: SlopDatabase
    init(database: SlopDatabase) { self.database = database }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        do {
            let data: Data
            let mime: String
            if url.path == "/slop.js" {
                data = Data(slopRuntimeJavaScript.utf8); mime = "text/javascript"
            } else if url.path.hasPrefix("/assets/") {
                let path = "/" + String(url.path.dropFirst("/assets/".count))
                guard let asset = try database.asset(path: path) else { throw SlopError.invalidArgument("missing asset") }
                data = asset.data; mime = asset.mime
            } else { throw SlopError.invalidArgument("missing resource") }
            task.didReceive(URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: nil))
            task.didReceive(data)
            task.didFinish()
        } catch { task.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

@MainActor
private final class RenderBridge: NSObject, WKScriptMessageHandlerWithReply {
    let database: SlopDatabase
    init(database: SlopDatabase) { self.database = database }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
        guard let body = message.body as? [String: Any], let operation = body["op"] as? String else {
            return (["error": "bad message"], nil)
        }
        do {
            switch operation {
            case "query":
                let rows = try database.query(body["sql"] as? String ?? "", parameters: body["params"] as? [Any] ?? [])
                return (["rows": database.jsonRows(rows)], nil)
            case "meta": return (try database.metadata().values, nil)
            case "ready": return (["ready": true], nil)
            default: return (["error": "Rendering is read-only."], nil)
            }
        } catch { return (["error": error.localizedDescription], nil) }
    }
}

@MainActor
private final class RenderNavigationDelegate: NSObject, WKNavigationDelegate {
    private var continuation: CheckedContinuation<Void, Error>?
    private var timeout: DispatchWorkItem?

    func load(html: String, in webView: WKWebView) async throws {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let timeout = DispatchWorkItem { [weak self] in
                self?.complete(.failure(SlopError.invalidArgument("Timed out while loading the document for export.")))
            }
            self.timeout = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: timeout)
            webView.loadHTMLString(html, baseURL: URL(string: "slop://document/")!)
        }
    }

    private func complete(_ result: Result<Void, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        timeout?.cancel()
        timeout = nil
        continuation.resume(with: result)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        complete(.success(()))
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        complete(.failure(error))
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        complete(.failure(error))
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        complete(.failure(SlopError.invalidArgument("The WebKit content process stopped during export.")))
    }
}

private extension NSImage {
    var pngData: Data? {
        guard let tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiffRepresentation) else { return nil }
        return bitmap.representation(using: .png, properties: [:])
    }
}
