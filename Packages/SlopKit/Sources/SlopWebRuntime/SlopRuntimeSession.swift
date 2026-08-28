import Foundation
import SlopCore
import WebKit
#if os(macOS)
import AppKit
#endif

@MainActor
public protocol SlopRuntimeSessionDelegate: AnyObject {
    func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession)
    func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopManifest.StoreKind, storeID: String)
    func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error)
}

public extension SlopRuntimeSessionDelegate {
    func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) {}
    func runtimeSession(_ session: SlopRuntimeSession, didCommit kind: SlopManifest.StoreKind, storeID: String) {}
    func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) {}
}

@MainActor
public final class SlopRuntimeSession: NSObject, WKNavigationDelegate, SlopBridgeDelegate {
    public let package: SlopPackage
    public let webView: WKWebView
    public weak var delegate: (any SlopRuntimeSessionDelegate)?
    public private(set) var isReady = false

    private let bridge: SlopBridge
    private let schemeHandler: SlopSchemeHandler
    private let shellHTML: String
    private var sqliteVersions: [String: Int64]
    private var jsonRevisions: [String: String]
    private var changeSequence = 0
    private var pollTimer: Timer?
    private var readyContinuations: [CheckedContinuation<Void, Error>] = []
    private var readyTimeouts: [UUID: DispatchWorkItem] = [:]
    private var closed = false

    public init(packageURL: URL) throws {
        let package = try SlopPackage(rootURL: packageURL)
        self.package = package
        let shell = try SlopRuntime.shell().data
        guard let shellHTML = String(data: shell, encoding: .utf8) else {
            throw SlopHostError.invalidPackage("Host runtime shell is not UTF-8")
        }
        self.shellHTML = shellHTML
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let schemeHandler = SlopSchemeHandler(package: package)
        self.schemeHandler = schemeHandler
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "slop")
        configuration.userContentController.addUserScript(SlopRuntime.userScript)
        let bridge = try SlopBridge(package: package)
        self.bridge = bridge
        self.sqliteVersions = bridge.sqliteVersions()
        self.jsonRevisions = bridge.jsonRevisions()
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "slop")
        let frame = CGRect(x: 0, y: 0, width: package.manifest.window.width, height: package.manifest.window.height)
#if os(macOS)
        self.webView = InteractiveWebView(frame: frame, configuration: configuration)
#else
        self.webView = WKWebView(frame: frame, configuration: configuration)
#endif
        super.init()
        bridge.delegate = self
        webView.navigationDelegate = self
        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.pollForExternalChanges() }
        }
    }

    public func load() {
        isReady = false
        webView.loadHTMLString(shellHTML, baseURL: URL(string: "slop://app/")!)
    }

    public func reload() {
        isReady = false
        webView.reload()
    }

    public func waitUntilReady(timeout: Duration = .seconds(15)) async throws {
        if isReady { return }
        if closed { throw SlopHostError.invalidPackage("Runtime session is closed") }
        let id = UUID()
        try await withCheckedThrowingContinuation { continuation in
            readyContinuations.append(continuation)
            let work = DispatchWorkItem { [weak self] in
                guard let self, !self.isReady else { return }
                self.readyTimeouts.removeValue(forKey: id)
                if let index = self.readyContinuations.indices.first {
                    let continuation = self.readyContinuations.remove(at: index)
                    continuation.resume(throwing: SlopHostError.invalidPackage("Timed out waiting for the mini app to become ready"))
                }
            }
            readyTimeouts[id] = work
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout.timeInterval, execute: work)
        }
    }

    public func close() {
        guard !closed else { return }
        closed = true
        pollTimer?.invalidate()
        pollTimer = nil
        readyTimeouts.values.forEach { $0.cancel() }
        readyTimeouts.removeAll()
        let continuations = readyContinuations
        readyContinuations.removeAll()
        continuations.forEach { $0.resume(throwing: SlopHostError.invalidPackage("Runtime session closed before becoming ready")) }
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "slop", contentWorld: .page)
        bridge.close()
    }

    public func slopBridgeDidCommit(kind: SlopManifest.StoreKind, storeID: String, revision: String?) {
        sqliteVersions = bridge.sqliteVersions()
        jsonRevisions = bridge.jsonRevisions()
        emitChange(kind: kind, storeID: storeID, revision: revision, source: "app")
        delegate?.runtimeSession(self, didCommit: kind, storeID: storeID)
    }

    public func slopBridgeDidBecomeReady() {
        guard !isReady else { return }
        isReady = true
        readyTimeouts.values.forEach { $0.cancel() }
        readyTimeouts.removeAll()
        let continuations = readyContinuations
        readyContinuations.removeAll()
        continuations.forEach { $0.resume() }
        delegate?.runtimeSessionDidBecomeReady(self)
    }

    public func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
        let scheme = navigationAction.request.url?.scheme
        decisionHandler(scheme == "slop" || scheme == "about" ? .allow : .cancel)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // The injected bridge normally reports readiness after the WASM mount,
        // outstanding storage calls, and two stable animation frames. WebKit
        // can coalesce that custom event during module startup, so the page
        // load event provides a conservative last-resort readiness signal.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self, !self.isReady else { return }
            self.slopBridgeDidBecomeReady()
        }
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        delegate?.runtimeSession(self, didFail: error)
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        delegate?.runtimeSession(self, didFail: error)
    }

    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        delegate?.runtimeSession(self, didFail: SlopHostError.invalidPackage("The mini app process stopped unexpectedly"))
    }

    private func pollForExternalChanges() {
        for (id, version) in bridge.sqliteVersions() where sqliteVersions[id] != version {
            sqliteVersions[id] = version
            emitChange(kind: .sqlite, storeID: id, revision: nil, source: "external")
        }
        for (id, revision) in bridge.jsonRevisions() where jsonRevisions[id] != revision {
            jsonRevisions[id] = revision
            emitChange(kind: .json, storeID: id, revision: revision, source: "external")
        }
    }

    private func emitChange(kind: SlopManifest.StoreKind, storeID: String, revision: String?, source: String) {
        changeSequence += 1
        let encodedStore = Self.javaScriptString(storeID)
        let encodedSource = Self.javaScriptString(source)
        let revisionValue = revision.map(Self.javaScriptString) ?? "null"
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('slop:change',{detail:{sequence:\(changeSequence),source:\(encodedSource),kind:'\(kind.rawValue)',store:\(encodedStore),revision:\(revisionValue)}}));")
    }

    private static func javaScriptString(_ value: String) -> String {
        let data = try! JSONSerialization.data(withJSONObject: [value])
        let array = String(decoding: data, as: UTF8.self)
        return String(array.dropFirst().dropLast())
    }
}

#if os(macOS)
private final class InteractiveWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override var mouseDownCanMoveWindow: Bool { false }
}
#endif

private extension Duration {
    var timeInterval: TimeInterval {
        let parts = components
        return Double(parts.seconds) + Double(parts.attoseconds) / 1e18
    }
}
