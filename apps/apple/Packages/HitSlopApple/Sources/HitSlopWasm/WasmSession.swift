import AppKit
import Foundation
import HitSlopCore
@preconcurrency import WebKit

public struct WasmSaveStatus: Sendable {
  public let status: String
  public let error: String?
}

/// A package lease outlives its renderer. Only JS interprets the stored Loro bytes.
@MainActor
public final class WasmSession: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
  private var liveWebView: WKWebView?
  public var webView: WKWebView {
    guard let liveWebView else { preconditionFailure("Document WebView has been destroyed") }
    return liveWebView
  }
  public let package: SlopPackage
  public private(set) var epoch = UUID().uuidString
  public private(set) var isReady = false
  public private(set) var rendererDead = false
  public var onResize: ((CGSize) throws -> CGSize)?
  public var onExport: ((String, URL, NativeCommandDeadline) async throws -> Void)?
  public var capturing = false
  public var onRecovered: (() -> Void)?
  public var onReady: (() -> Void)?
  public var onStatus: ((WasmSaveStatus) -> Void)?
  public var onIssue: ((String, Bool) -> Void)?
  public var onError: ((String) -> Void)?
  #if DEBUG
    var failWritesForTesting = false
    var storageReplyForTesting: ((String) -> Bool)?
  #endif
  private let storage: Storage
  private let headless: Bool
  private var server: SocketServer?
  private var closing = false
  private var closed = false
  private var closeTask: Task<Void, Error>?
  private var openingError: String?
  private var waiters: [UUID: CheckedContinuation<Void, Error>] = [:]
  public var webViewResources: URL {
    Bundle.module.url(forResource: "runtime", withExtension: nil)!
  }

  public init(package: SlopPackage, headless: Bool = false) throws {
    self.package = package
    self.headless = headless
    let identityURL = package.rootURL.appendingPathComponent("assets/runtime.json")
    if FileManager.default.fileExists(atPath: identityURL.path) {
      let supplied =
        try JSONSerialization.jsonObject(
          with: SlopFile.read(identityURL, within: package.rootURL, maximumBytes: 4096))
        as? NSDictionary
      let installed =
        try JSONSerialization.jsonObject(with: Self.runtimeIdentityData()) as? NSDictionary
      guard let supplied, supplied == installed else {
        throw failure(
          "This slop requires a matching hitSlop SDK/runtime. Update hitSlop.app and rebuild with its matching CLI version."
        )
      }
    }
    storage = try Storage(root: package.rootURL)
    super.init()
    makeWebView()
  }

  public static func runtimeIdentityData() throws -> Data {
    guard
      let url = Bundle.module.url(
        forResource: "identity", withExtension: "json", subdirectory: "runtime")
    else { throw failure("Missing native runtime identity") }
    return try Data(contentsOf: url)
  }
  public func reloadInterface() async throws {
    guard isReady, !closed, !closing, !capturing, !rendererDead else {
      throw failure("Document interface unavailable")
    }
    _ = try await webView.callAsyncJavaScript(
      "await globalThis.__slop.reloadInterface(); return true", arguments: [:], in: nil,
      contentWorld: .page)
  }
  private func makeWebView() {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
    configuration.setURLSchemeHandler(
      SchemeHandler(root: package.rootURL, runtime: webViewResources, headless: headless),
      forURLScheme: "slop")
    configuration.userContentController.addScriptMessageHandler(
      self, contentWorld: .page, name: "storage")
    configuration.userContentController.addUserScript(
      WKUserScript(
        source: """
          for (const type of ['error','unhandledrejection']) addEventListener(type,e=> {
            webkit.messageHandlers.storage.postMessage({method:'runtimeError',kind:'application',error:String(e.error?.stack ?? e.reason?.stack ?? e.error?.message ?? e.reason ?? e.message).slice(0,4096)}).catch(()=>{});
          });
          """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    let spec = package.manifest.presentation
    let view = WKWebView(
      frame: CGRect(x: 0, y: 0, width: spec.width, height: spec.height),
      configuration: configuration)
    WebViewBackground.set(!package.usesTransparentBackground, on: view)
    view.navigationDelegate = self
    liveWebView = view
  }

  public func load() { liveWebView?.load(URLRequest(url: URL(string: "slop://app/")!)) }

  public func waitUntilReady(timeout: Duration = .seconds(15)) async throws {
    if isReady { return }
    if closed || rendererDead || openingError != nil {
      throw failure(openingError ?? "Document runtime unavailable")
    }
    let id = UUID()
    try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        waiters[id] = continuation
        Task { [weak self] in
          try? await Task.sleep(for: timeout)
          self?.waiters.removeValue(forKey: id)?.resume(
            throwing: failure("Document runtime did not become ready"))
        }
        if Task.isCancelled {
          waiters.removeValue(forKey: id)?.resume(throwing: CancellationError())
        }
      }
    } onCancel: {
      Task { @MainActor [weak self] in
        self?.waiters.removeValue(forKey: id)?.resume(throwing: CancellationError())
      }
    }
  }

  private func completeWaiters(_ result: Result<Void, Error>) {
    let pending = waiters.values
    waiters.removeAll()
    for waiter in pending { waiter.resume(with: result) }
  }

  public func userContentController(
    _ controller: WKUserContentController, didReceive message: WKScriptMessage,
    replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
  ) {
    guard !closed, message.webView === liveWebView, message.frameInfo.isMainFrame,
      message.frameInfo.securityOrigin.protocol == "slop",
      message.frameInfo.securityOrigin.host == "app",
      let args = message.body as? [String: Any], let method = args["method"] as? String,
      let encoded = try? JSONSerialization.data(withJSONObject: args),
      encoded.count <= 48 * 1024 * 1024,
      PlatformContract.valid(args, against: bridgeValidationSchema)
    else {
      replyHandler(nil, "Invalid bridge request")
      return
    }
    switch method {
    case "config":
      let spec = package.manifest.presentation
      replyHandler(
        [
          "epoch": epoch,
          "presentation": [
            "width": spec.width, "height": spec.height,
            "resizable": package.isResizable, "shape": package.shape.rawValue,
            "mode": package.isSkinned
              ? "skin" : package.usesTransparentBackground ? "transparent" : "standard",
          ],
        ], nil)
    case "window.resize":
      do {
        guard !headless, !package.isSkinned, let onResize,
          let width = args["width"] as? Double, let height = args["height"] as? Double
        else { throw failure("Window resizing unavailable") }
        let size = try onResize(CGSize(width: width, height: height))
        replyHandler(["width": size.width, "height": size.height], nil)
      } catch { replyHandler(nil, error.localizedDescription) }
    case "ready":
      do {
        if !headless && server == nil {
          server = try SocketServer { [weak self] request, deadline, reply in
            guard let self else {
              reply(["ok": false, "error": "Document closed"])
              return
            }
            Task { reply(await self.request(request, deadline: deadline)) }
          }
          let discovery: [String: Any] = [
            "socket": server!.path, "epoch": epoch,
            "pid": ProcessInfo.processInfo.processIdentifier, "documentPath": package.rootURL.path,
          ]
          try JSONSerialization.data(withJSONObject: discovery).write(
            to: package.rootURL.appendingPathComponent("state/host.lock"), options: .atomic)
        }
        isReady = true
        completeWaiters(.success(()))
        onReady?()
        replyHandler([:], nil)
      } catch {
        failOpening(error.localizedDescription)
        replyHandler(nil, error.localizedDescription)
      }
    case "runtimeRecovered":
      onRecovered?()
      replyHandler([:], nil)
    case "status":
      onStatus?(
        WasmSaveStatus(
          status: args["status"] as? String ?? "saving", error: args["error"] as? String))
      replyHandler([:], nil)
    case "failed", "runtimeError":
      let error = args["error"] as? String ?? "Runtime error"
      if method == "runtimeError" && isReady {
        onIssue?(error, args["kind"] as? String == "operation")
      } else {
        failOpening(error)
      }
      replyHandler([:], nil)
    default:
      #if DEBUG
        if failWritesForTesting && ["append", "checkpoint"].contains(method) {
          replyHandler(nil, "Injected save failure")
          return
        }
      #endif
      storage.queue.async { [storage, weak self] in
        let result: Result<Data, Error> = Result {
          guard let request = try JSONSerialization.jsonObject(with: encoded) as? [String: Any]
          else {
            throw failure("Invalid storage envelope")
          }
          return try JSONSerialization.data(withJSONObject: storage.call(request))
        }
        DispatchQueue.main.async { [weak self] in
          #if DEBUG
            if ["append", "checkpoint"].contains(method),
              self?.storageReplyForTesting?(method) == true
            {
              replyHandler(nil, "Injected lost storage acknowledgement")
              return
            }
          #endif
          do { replyHandler(try JSONSerialization.jsonObject(with: result.get()), nil) } catch {
            replyHandler(nil, error.localizedDescription)
          }
        }
      }
    }
  }

  public func request(
    _ request: [String: Any], deadline: NativeCommandDeadline = NativeCommandDeadline()
  ) async -> [String: Any] {
    guard PlatformContract.valid(request, against: socketRequestSchema) else {
      return ["ok": false, "error": "Invalid socket request"]
    }
    guard isReady, !closed, !closing, !capturing, !rendererDead,
      request["documentPath"] as? String == package.rootURL.path
    else { return ["ok": false, "epoch": epoch, "error": "Document unavailable or path mismatch"] }
    do {
      try deadline.check()
      if request["method"] as? String == "export" {
        guard let onExport, let format = request["format"] as? String,
          let output = request["output"] as? String,
          request["epoch"] as? String == epoch
        else { throw failure("Export unavailable or session changed") }
        try await onExport(format, URL(fileURLWithPath: output), deadline)
        return ["ok": true, "output": output]
      }
      return try await webView.callAsyncJavaScript(
        "return await globalThis.__slop.request(request)",
        arguments: ["request": request], in: nil, contentWorld: .page) as? [String: Any]
        ?? ["ok": false, "error": "Invalid runtime reply"]
    } catch { return ["ok": false, "epoch": epoch, "error": error.localizedDescription] }
  }

  public func flush() async throws {
    guard !rendererDead, !closed else { throw failure("Document renderer unavailable") }
    _ = try await webView.callAsyncJavaScript(
      "await globalThis.__slop.flush(); return true", arguments: [:], in: nil, contentWorld: .page)
  }

  public func prepareClose() async throws {
    guard !closed else { return }
    guard !capturing else { throw failure("Document is exporting; try again when it finishes") }
    closing = true
    do {
      if isReady && !rendererDead {
        _ = try await webView.callAsyncJavaScript(
          "await globalThis.__slop.prepareClose(); return true", arguments: [:], in: nil,
          contentWorld: .page)
      }
    } catch {
      closing = false
      throw error
    }
  }

  public func cancelClose() async {
    if isReady && !closed && !rendererDead {
      _ = try? await webView.callAsyncJavaScript(
        "globalThis.__slop.cancelClose(); return true", arguments: [:], in: nil, contentWorld: .page
      )
    }
    closing = false
  }

  public func close() async throws {
    if let closeTask { return try await closeTask.value }
    let task = Task { try await self.finishClose() }
    closeTask = task
    do { try await task.value } catch {
      closeTask = nil
      throw error
    }
    closeTask = nil
  }

  private func finishClose() async throws {
    if closed { return }
    try await prepareClose()
    do {
      if isReady && !rendererDead {
        _ = try await webView.callAsyncJavaScript(
          "await globalThis.__slop.close(); return true", arguments: [:], in: nil,
          contentWorld: .page)
      }
    } catch {
      await cancelClose()
      throw error
    }
    stopDiscovery()
    destroyWebView()
    await withCheckedContinuation { continuation in
      storage.queue.async { [storage] in
        storage.close()
        continuation.resume()
      }
    }
    closed = true
    isReady = false
    completeWaiters(.failure(failure("Document closed")))
  }

  /// The OS writer lease stays owned while replacing a failed renderer.
  public func reopenSavedDocument() async throws {
    guard !closed, !capturing, rendererDead || openingError != nil else {
      throw failure("Renderer is still active; retry saving instead")
    }
    closing = true
    stopDiscovery()
    await withCheckedContinuation { continuation in storage.queue.async { continuation.resume() } }
    destroyWebView()
    epoch = UUID().uuidString
    rendererDead = false
    openingError = nil
    isReady = false
    closing = false
    makeWebView()
    load()
    try await waitUntilReady()
  }

  private func destroyWebView() {
    liveWebView?.stopLoading()
    liveWebView?.configuration.userContentController.removeScriptMessageHandler(
      forName: "storage", contentWorld: .page)
    liveWebView?.navigationDelegate = nil
    liveWebView?.removeFromSuperview()
    liveWebView = nil
  }

  private func stopDiscovery() {
    server?.stop()
    server = nil
    try? FileManager.default.removeItem(
      at: package.rootURL.appendingPathComponent("state/host.lock"))
  }

  private func failOpening(_ message: String) {
    openingError = message
    completeWaiters(.failure(failure(message)))
    onError?(message)
  }

  public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    rendererDead = true
    isReady = false
    stopDiscovery()
    failOpening(
      "The document renderer stopped. Reopen the saved document to continue. Unsaved edits could not be recovered."
    )
  }

  public func webView(
    _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    failOpening(error.localizedDescription)
  }

  public func webView(
    _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
    decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
  ) {
    if let url = action.request.url, url.scheme == "slop", url.host == "app" {
      decisionHandler(.allow)
      return
    }
    if !headless, action.navigationType == .linkActivated, let url = action.request.url,
      ["https", "http"].contains(url.scheme)
    {
      NSWorkspace.shared.open(url)
    }
    decisionHandler(.cancel)
  }
}

/// WebKit has no public transparent-background API on macOS. Keep this exception isolated.
@MainActor public enum WebViewBackground {
  public static func get(_ view: WKWebView) -> Bool {
    view.value(forKey: "drawsBackground") as? Bool ?? true
  }
  public static func set(_ value: Bool, on view: WKWebView) {
    view.setValue(value, forKey: "drawsBackground")
  }
}
