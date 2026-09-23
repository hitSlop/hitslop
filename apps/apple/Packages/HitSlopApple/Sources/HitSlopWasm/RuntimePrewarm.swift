import Foundation
@preconcurrency import WebKit

/// Warms WebKit and compiles the bundled runtime before the first document opens.
/// The WebView serves no package files and is never handed to a document; every
/// document still gets its own WebView, process, lock and storage.
@MainActor public final class RuntimePrewarm: NSObject, WKScriptMessageHandler {
  private static var started = false
  private static var current: RuntimePrewarm?
  static var isRunning: Bool { current != nil }
  /// "ready", or the runtime error that stopped warming (diagnostics and tests).
  private(set) static var outcome: String?
  private var webView: WKWebView?
  private var timeout: Task<Void, Never>?

  /// Runs at most once per process.
  public static func start() {
    guard !started, let runtime = try? RuntimeCatalog.bundled().currentRuntime else { return }
    started = true
    let prewarm = RuntimePrewarm()
    current = prewarm
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.setURLSchemeHandler(
      SchemeHandler(root: nil, runtime: runtime), forURLScheme: "slop")
    configuration.userContentController.add(prewarm, name: "prewarm")
    let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: configuration)
    prewarm.webView = view
    prewarm.timeout = Task { @MainActor in
      try? await Task.sleep(for: .seconds(10))
      finish()
    }
    view.load(URLRequest(url: URL(string: "slop://app/")!))
  }

  /// Releases the warm-up WebView; a real open takes priority over finishing it.
  public static func finish() {
    guard let prewarm = current else { return }
    current = nil
    prewarm.timeout?.cancel()
    prewarm.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "prewarm")
    prewarm.webView?.stopLoading()
    prewarm.webView = nil
  }

  public func userContentController(
    _ controller: WKUserContentController, didReceive message: WKScriptMessage
  ) {
    guard message.webView === webView else { return }
    Self.outcome = message.body as? String
    Self.finish()
  }
}
