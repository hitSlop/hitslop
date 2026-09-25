import Foundation
@preconcurrency import WebKit

/// Warms WebKit and compiles the bundled runtime before the first document opens.
/// The WebView serves no package files and is never handed to a document; every
/// document still gets its own WebView, process, lock and storage.
@MainActor public final class RuntimePrewarm: NSObject, WKScriptMessageHandler {
  private static var started = false
  private static var current: RuntimePrewarm?
  private(set) var webView: WKWebView?
  private var completed = false
  private var result: String?
  private var waiters: [CheckedContinuation<String?, Never>] = []
  private var timeout: Task<Void, Never>?

  /// Runs at most once per process.
  public static func start() {
    guard !started, let runtime = try? RuntimeCatalog.bundled().currentRuntime else { return }
    started = true
    current = RuntimePrewarm(runtime: runtime)
  }

  init(runtime: URL) {
    super.init()
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.setURLSchemeHandler(
      SchemeHandler(root: nil, runtime: runtime), forURLScheme: "slop")
    configuration.userContentController.add(self, name: "prewarm")
    let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: configuration)
    webView = view
    timeout = Task { @MainActor [weak self] in
      do { try await Task.sleep(for: .seconds(10)) } catch { return }
      self?.complete(nil)
    }
    view.load(URLRequest(url: URL(string: "slop://app/")!))
  }

  /// Releases the warm-up WebView; a real open takes priority over finishing it.
  public static func finish() {
    current?.complete(nil)
  }

  func waitUntilFinished() async -> String? {
    if completed { return result }
    return await withCheckedContinuation { waiters.append($0) }
  }

  private func complete(_ result: String?) {
    guard !completed else { return }
    completed = true
    self.result = result
    if Self.current === self { Self.current = nil }
    timeout?.cancel()
    webView?.configuration.userContentController.removeScriptMessageHandler(forName: "prewarm")
    webView?.stopLoading()
    webView = nil
    let pending = waiters
    waiters.removeAll()
    for waiter in pending { waiter.resume(returning: result) }
  }

  public func userContentController(
    _ controller: WKUserContentController, didReceive message: WKScriptMessage
  ) {
    guard message.webView === webView else { return }
    complete(message.body as? String)
  }
}
