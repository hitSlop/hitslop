import Foundation
import HitSlopCore
import HitSlopDocumentEngine
import WebKit

#if os(macOS)
  import AppKit
  import UniformTypeIdentifiers
#else
  import UIKit
#endif

private func hostBridgeSource(package: SlopPackage) throws -> String {
  guard let url = Bundle.module.url(forResource: "host-bridge", withExtension: "js") else {
    throw SlopPackageError.missing("bundled host bridge")
  }
  // SlopPackage validates dimensions against TypeBox before decoding Swift models.
  // Only derived geometry crosses this boundary; no asset paths or author text.
  let spec = package.manifest.presentation
  var stage: [String: Any] = [
    "mode": package.isSkinned ? "skin" : package.usesTransparentBackground ? "transparent" : "standard",
    "width": spec.width, "height": spec.height, "resizable": package.isResizable,
  ]
  if !package.isSkinned { stage["shape"] = package.shape.rawValue }
  let json = String(decoding: try JSONSerialization.data(withJSONObject: stage, options: [.sortedKeys]), as: UTF8.self)
  return try String(contentsOf: url, encoding: .utf8)
    + ";window.__hitslopInstallPresentationStage(\(json));"
}

@MainActor public protocol SlopRuntimeSessionDelegate: AnyObject {
  func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession)
  func runtimeSession(_ session: SlopRuntimeSession, resizeContentTo size: CGSize) throws -> CGSize
  func runtimeSession(_ session: SlopRuntimeSession, didReport issue: SlopRuntimeIssue)
  func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error)
  func runtimeSession(_ session: SlopRuntimeSession, documentNeedsAttention frame: SlopCommandFrame)
}

extension SlopRuntimeSessionDelegate {
  public func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) {}
  public func runtimeSession(_ session: SlopRuntimeSession, resizeContentTo size: CGSize) throws
    -> CGSize
  {
    throw SlopPackageError.invalid("the host does not support dynamic window sizing")
  }
  public func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) {}
  public func runtimeSession(_ session: SlopRuntimeSession, didReport issue: SlopRuntimeIssue) {}
  public func runtimeSession(
    _ session: SlopRuntimeSession, documentNeedsAttention frame: SlopCommandFrame
  ) {}
}

public struct SlopRuntimeTeardownError: LocalizedError {
  public let underlying: Error
  public var errorDescription: String? { "Runtime teardown failed: \(underlying.localizedDescription)" }
}

private struct PreparedRuntime: Sendable {
  let package: SlopPackage
  let source: String
  let document: SlopCommandDocument?
  let documentError: Error?
  let engine: StateEngine

  init(packageURL: URL) throws {
    try SlopLocalDocument.requireLocal(packageURL)
    package = try SlopPackage(rootURL: packageURL)
    source = try hostBridgeSource(package: package)
    do {
      document = try SlopCommandDocument.open(package: package)
      documentError = nil
    } catch {
      document = nil
      documentError = error
    }
    engine = try document?.engine ?? StateEngine()
  }

  func dispose() async throws {
    if let document { try await document.shutDownAndWait() }
    else { await engine.closeAsync() }
  }
}

@MainActor final class SlopBridge: NSObject, WKScriptMessageHandlerWithReply {
  weak var session: SlopRuntimeSession?
  private let package: SlopPackage
  private let storage: SlopStorageWorker
  fileprivate let document: SlopCommandDocument?
  private let documentError: Error?
  private let validationEngine: StateEngine
  private var lease = SlopRequestLease()
  private var inFlight = 0
  private var mediaImportInFlight = false

  fileprivate init(prepared: PreparedRuntime) {
    package = prepared.package
    storage = SlopStorageWorker(package: prepared.package)
    document = prepared.document
    documentError = prepared.documentError
    validationEngine = prepared.engine
  }
  fileprivate var openingError: Error? { documentError }
  func finish() async throws {
    if let document { try await document.close() }
  }
  func invalidate() {
    lease.invalidate()
  }
  func reset() async {
    lease.invalidate()
    lease = SlopRequestLease()
  }
  func closeAndWait() async throws {
    invalidate()
    await storage.closeAndWait()
    if let document { try await document.shutDownAndWait() }
    else { await validationEngine.closeAsync() }
  }
  func revisions() async -> SlopRevisions { await storage.revisions() }
  func userContentController(
    _ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
    replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
  ) {
    func reply(_ value: [String: Any]) {
      do {
        replyHandler(
          String(decoding: try JSONSerialization.data(withJSONObject: value), as: UTF8.self), nil)
      } catch { replyHandler(nil, "Cannot encode host response") }
    }
    func failure(_ error: Error) {
      print("[hitSlop bridge] \(error.localizedDescription)")
      let publicError = SlopRuntimeSecurity.publicFailure(error)
      reply([
        "ok": false, "error": ["code": publicError.code.rawValue, "message": publicError.message],
      ])
    }
    Task {
      do {
        guard let session, session.accepts(message.webView, frame: message.frameInfo),
          let rawJSON = message.body as? String
        else { throw SlopBridgeFailure(.invalidRequest, "Expected JSON text") }
        guard inFlight < 8 else {
          throw SlopBridgeFailure(.limitExceeded, "Too many outstanding host requests")
        }
        inFlight += 1
        defer { inFlight -= 1 }
        let validatingLease = lease
        try validatingLease.check()
        let rawData = Data(rawJSON.utf8)
        try SlopJSONLimits.check(rawData, maximumBytes: 36 * 1024 * 1024, maximumDepth: 76)
        struct Header: Decodable { let method: String }
        guard let header = try? JSONDecoder().decode(Header.self, from: rawData),
          let method = SlopBridgeMethod(rawValue: header.method)
        else { throw SlopBridgeFailure(.invalidRequest, "Malformed host request") }
        try SlopJSONLimits.check(
          rawData, maximumBytes: SlopRuntimeSecurity.requestLimit(method),
          maximumDepth: method == .documentExecute ? 76 : 64)
        let parsed: StateBridgeRequest
        do { parsed = try await validationEngine.callAsync("bridge", [rawJSON]) } catch {
          try validatingLease.check()
          throw SlopBridgeFailure(.invalidRequest, "Malformed host request")
        }
        try validatingLease.check()
        let data = Data(parsed.nativeJSON.utf8)
        guard let body = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
          throw SlopBridgeFailure(.invalidRequest, "Malformed host request")
        }
        guard method != .mediaAdd || !mediaImportInFlight else {
          throw SlopBridgeFailure(
            .limitExceeded, "Too many outstanding host requests; wait for the previous operation")
        }
        let value: Any
        switch method {
        case .hostInfo:
          var capabilities = SlopBridgeMethod.allCases.map(\.rawValue)
          #if !os(macOS)
            capabilities.removeAll { $0 == "window.resize" }
          #endif
          if package.isSkinned { capabilities.removeAll { $0 == "window.resize" } }
          value = ["protocolVersion": slopProtocolVersion, "capabilities": capabilities]
        case .log:
          print("[slop guest] \(body["message"] as? String ?? "")")
          value = NSNull()
        case .runtimeReportError:
          guard let issue = body["issue"] else {
            throw SlopBridgeFailure(.invalidRequest, "Missing runtime error")
          }
          let report = try JSONDecoder().decode(
            SlopRuntimeIssue.self, from: JSONSerialization.data(withJSONObject: issue))
          session.delegate?.runtimeSession(session, didReport: report)
          value = NSNull()
        case .ready:
          session.bridgeDidBecomeReady()
          value = NSNull()
        case .windowResize:
          guard !package.isSkinned else {
            throw SlopBridgeFailure(.unsupported, "PNG-skinned documents have a fixed window size")
          }
          guard let width = body["width"] as? NSNumber, let height = body["height"] as? NSNumber
          else {
            throw SlopBridgeFailure(.invalidRequest, "Missing window dimensions")
          }
          let size = CGSize(width: width.doubleValue, height: height.doubleValue)
          let applied = try session.bridgeDidRequestResize(size)
          value = ["width": applied.width, "height": applied.height]
        default:
          inFlight += 1
          if method == .mediaAdd { mediaImportInFlight = true }
          let requestLease = lease
          Task {
            defer {
              inFlight -= 1
              if method == .mediaAdd { mediaImportInFlight = false }
            }
            do {
              try requestLease.check()
              let result: Any
              switch method {
              case .documentOpen, .documentExecute, .documentFlush:
                guard let document else {
                  throw documentError
                    ?? SlopBridgeFailure(.unsupported, "This slop does not use document data")
                }
                let json = try await document.guestRequest(
                  method, requestJSON: parsed.requestJSON, lease: requestLease)
                try requestLease.check()
                replyHandler("{\"ok\":true,\"value\":\(json)}", nil)
                return
              default:
                if method == .mediaAdd {
                  guard let document, try await document.frame().writable else {
                    throw SlopBridgeFailure(
                      .unsupported, "Open a writable document before importing media")
                  }
                }
                if method == .mediaOpen, let hash = body["sha256"] as? String {
                  try await document?.loadMedia(hash)
                }
                let stored = try await storage.perform(data, lease: requestLease)
                try requestLease.check()
                result = stored.value
                if let hash = stored.sha256 {
                  session.emitMedia(revision: stored.revision, source: "app", sha256: hash)
                }
              }
              reply(["ok": true, "value": result])
            } catch {
              if method == .documentOpen || method == .documentFlush {
                session.delegate?.runtimeSession(session, didFail: error)
              }
              failure(error)
            }
          }
          return
        }
        reply(["ok": true, "value": value])
      } catch { failure(error) }
    }
  }
}
private final class SlopSchemeHandler: NSObject, WKURLSchemeHandler {
  private let package: SlopPackage
  private let theme: SlopThemeStore
  init(package: SlopPackage) {
    self.package = package
    theme = SlopThemeStore(
      url: package.themeOverrideURL,
      defaultURL: package.rootURL.appendingPathComponent("assets/theme.css"),
      rootURL: package.rootURL)
  }
  func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
    guard let url = task.request.url else {
      task.didFailWithError(SlopPackageError.invalid("missing resource URL"))
      return
    }
    do {
      let resource = try resource(for: url)
      let headers = [
        "Content-Type": resource.mime, "Content-Length": String(resource.data.count),
        "Cache-Control": "no-store",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; script-src slop: 'unsafe-inline' 'wasm-unsafe-eval'; style-src slop: 'unsafe-inline'; img-src slop: data: blob: https: http:; media-src slop: data: blob: https: http:; font-src slop: data: https: http:; connect-src slop: blob: https: http: wss: ws:; worker-src blob:; base-uri 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'",
      ]
      guard
        let response = HTTPURLResponse(
          url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)
      else { throw SlopPackageError.invalid("could not serve resource") }
      task.didReceive(response)
      task.didReceive(resource.data)
      task.didFinish()
    } catch {
      print("[hitSlop scheme] \(error.localizedDescription)")
      task.didFailWithError(error)
    }
  }
  func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
  private func resource(for url: URL) throws -> (data: Data, mime: String) {
    guard SlopRuntimeSecurity.isOrigin(url) else {
      throw SlopPackageError.invalid("foreign resource origin")
    }
    if ["", "/", "/index.html"].contains(url.path) {
      return (
        try SlopFile.read(package.entryURL, within: package.rootURL), "text/html; charset=utf-8"
      )
    }
    if url.path == "/theme.css" {
      return (theme.stylesheet(), "text/css; charset=utf-8")
    }
    if url.path.hasPrefix("/media/") {
      let name = String(url.path.dropFirst("/media/".count)).removingPercentEncoding ?? ""
      let resource = try package.mediaURL(sha256: name)
      guard FileManager.default.fileExists(atPath: resource.path) else {
        throw SlopPackageError.missing(url.path)
      }
      let data = try SlopMediaStore(directoryURL: package.mediaStoresURL, rootURL: package.rootURL)
        .read(name)
      return (data, try SlopMediaStore.mediaMIMEType(data))
    }
    let resource = try package.assetURL(path: url.path)
    guard FileManager.default.fileExists(atPath: resource.path) else {
      throw SlopPackageError.missing(url.path)
    }
    return (try SlopFile.read(resource, within: package.rootURL), Self.mime(resource.pathExtension))
  }
  private static func mime(_ ext: String) -> String {
    [
      "js": "text/javascript", "mjs": "text/javascript", "wasm": "application/wasm",
      "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif",
      "webp": "image/webp", "svg": "image/svg+xml", "css": "text/css", "json": "application/json",
      "woff": "font/woff", "woff2": "font/woff2", "mp3": "audio/mpeg", "mp4": "video/mp4",
    ][ext.lowercased()] ?? "application/octet-stream"
  }
}

@MainActor public final class SlopRuntimeSession: NSObject, WKNavigationDelegate {
  public let package: SlopPackage
  public let webView: WKWebView
  public let purpose: SlopRuntimePurpose
  private var acceptingRequests = true
  private var reloadTask: Task<Void, Never>?
  #if os(macOS)
    private var openPanel: NSOpenPanel?
  #endif
  let usesTransparentBackground: Bool
  public weak var delegate: (any SlopRuntimeSessionDelegate)?
  public var document: SlopCommandDocument? { bridge.document }
  public private(set) var isReady = false
  private let bridge: SlopBridge
  private let schemeHandler: SlopSchemeHandler
  private var timer: Timer?, mediaRevision: String?, themeRevision: String?, sequence = 0,
    retryCount = 0, closed = false, lastError: Error?
  private var refreshTask: Task<Void, Never>?
  private var documentEvents: Task<Void, Never>?
  #if os(macOS)
    private var packageWatcher: SlopPackageWatcher?
  #endif

  public convenience init(
    packageURL: URL, renderTargetsEnabled: Bool = false, purpose: SlopRuntimePurpose = .interactive
  ) throws {
    self.init(prepared: try PreparedRuntime(packageURL: packageURL),
              renderTargetsEnabled: renderTargetsEnabled, purpose: purpose)
  }

  public static func open(
    packageURL: URL, renderTargetsEnabled: Bool = false, purpose: SlopRuntimePurpose = .interactive
  ) async throws -> SlopRuntimeSession {
    let prepared = try await SlopPreparation.run { try PreparedRuntime(packageURL: packageURL) }
    if Task.isCancelled {
      do { try await prepared.dispose() }
      catch { throw SlopRuntimeTeardownError(underlying: error) }
      throw CancellationError()
    }
    return SlopRuntimeSession(prepared: prepared, renderTargetsEnabled: renderTargetsEnabled, purpose: purpose)
  }

  private init(prepared: PreparedRuntime, renderTargetsEnabled: Bool, purpose: SlopRuntimePurpose) {
    self.purpose = purpose
    let package = prepared.package
    self.package = package
    usesTransparentBackground = package.usesTransparentBackground
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
    let handler = SlopSchemeHandler(package: package)
    schemeHandler = handler
    configuration.setURLSchemeHandler(handler, forURLScheme: "slop")
    if renderTargetsEnabled {
      configuration.userContentController.addUserScript(
        WKUserScript(
          source: "document.documentElement.setAttribute('data-slop-renderer', 'true')",
          injectionTime: .atDocumentStart,
          forMainFrameOnly: true,
          in: .page
        ))
    }
    configuration.userContentController.addUserScript(
      WKUserScript(
        source: prepared.source, injectionTime: .atDocumentStart, forMainFrameOnly: true,
        in: .page))
    let bridge = SlopBridge(prepared: prepared)
    self.bridge = bridge
    configuration.userContentController.addScriptMessageHandler(
      bridge, contentWorld: .page, name: "hitslop")
    let frame = CGRect(
      x: 0, y: 0, width: package.manifest.presentation.width,
      height: package.manifest.presentation.height)
    #if os(macOS)
      webView = InteractiveWebView(frame: frame, configuration: configuration)
      webView.setValue(!usesTransparentBackground, forKey: "drawsBackground")
    #else
      webView = WKWebView(frame: frame, configuration: configuration)
      webView.isOpaque = !usesTransparentBackground
      webView.backgroundColor = usesTransparentBackground ? .clear : .systemBackground
      webView.scrollView.contentInsetAdjustmentBehavior = .never
      webView.isInspectable = true
    #endif
    super.init()
    bridge.session = self
    webView.navigationDelegate = self
    #if os(macOS)
      webView.uiDelegate = self
      packageWatcher = SlopPackageWatcher(packageURL: package.rootURL) { [weak self] in
        Task { @MainActor [weak self] in self?.scheduleExternalRefresh() }
      }
    #else
      timer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] _ in
        Task { @MainActor in await self?.refreshExternalState() }
      }
    #endif
  }

  public func load() {
    isReady = false
    if documentEvents == nil, let document = bridge.document {
      documentEvents = Task { [weak self] in
        do {
          try await document.start()
          for await frame in try await document.events() {
            guard let self, !self.closed else { return }
            self.delegate?.runtimeSession(self, documentNeedsAttention: frame)
            let value = frame.wireJSON
            _ = try? await self.webView.callAsyncJavaScript(
              "window.__hitslopDocumentPublish?.(JSON.parse(frame))",
              arguments: ["frame": value],
              in: nil,
              contentWorld: .page
            )
          }
        } catch {
          await MainActor.run {
            guard let session = self else { return }
            session.delegate?.runtimeSession(session, didFail: error)
          }
        }
      }
    }
    webView.load(URLRequest(url: URL(string: "slop://app/")!))
  }
  public func reload() {
    guard !closed else { return }
    acceptingRequests = false
    isReady = false
    bridge.invalidate()
    webView.stopLoading()
    #if os(macOS)
      openPanel?.cancel(nil)
      openPanel = nil
    #endif
    reloadTask?.cancel()
    reloadTask = Task {
      #if os(macOS)
        await webView.setCameraCaptureState(.none)
        await webView.setMicrophoneCaptureState(.none)
      #endif
      await bridge.reset()
      guard !closed, !Task.isCancelled else { return }
      acceptingRequests = true
      webView.reload()
    }
  }
  func accepts(_ sender: WKWebView?, frame: WKFrameInfo) -> Bool {
    !closed && acceptingRequests && sender === webView && frame.isMainFrame
      && frame.securityOrigin.protocol == "slop" && frame.securityOrigin.host == "app"
      && frame.securityOrigin.port == 0
  }
  public func flush() async throws {
    guard !closed else { throw SlopBridgeFailure(.closed, "Document is closed") }
    _ = try await webView.callAsyncJavaScript(
      "await window.__hitslopFlush?.(); await window.slop?.flush?.(); return true", arguments: [:],
      in: nil, contentWorld: .page)
    if let document = bridge.document { try await document.flush() }
  }
  public func finish() async throws {
    try await flush()
    acceptingRequests = false
    bridge.invalidate()
    do { try await bridge.finish() }
    catch {
      if !closed {
        await bridge.reset()
        acceptingRequests = true
      }
      throw error
    }
    try await closeAndWait()
  }
  private var teardown: Task<Void, Error>?

  /// Compatibility entry point. Call closeAndWait before removing package files.
  public func close() {
    startTeardown()
  }
  public func closeAndWait() async throws {
    startTeardown()
    try await teardown?.value
  }
  private func startTeardown() {
    guard teardown == nil else { return }
    closed = true
    acceptingRequests = false
    let reload = reloadTask, events = documentEvents, refresh = refreshTask
    reloadTask?.cancel()
    reloadTask = nil
    bridge.invalidate()
    webView.stopLoading()
    #if os(macOS)
      openPanel?.cancel(nil)
      openPanel = nil
      webView.setCameraCaptureState(.none, completionHandler: nil)
      webView.setMicrophoneCaptureState(.none, completionHandler: nil)
    #endif
    documentEvents?.cancel()
    documentEvents = nil
    refreshTask?.cancel()
    refreshTask = nil
    timer?.invalidate()
    timer = nil
    #if os(macOS)
      packageWatcher?.stop()
      packageWatcher = nil
    #endif
    webView.configuration.userContentController.removeScriptMessageHandler(
      forName: "hitslop", contentWorld: .page)
    let bridge = bridge
    teardown = Task {
      await reload?.value
      await events?.value
      await refresh?.value
      do { try await bridge.closeAndWait() }
      catch {
        print("[hitSlop runtime] Teardown failed: \(error.localizedDescription)")
        throw error
      }
    }
  }
  public func waitUntilReady(timeout: Duration = .seconds(15)) async throws {
    if isReady { return }
    let clock = ContinuousClock()
    let deadline = clock.now.advanced(by: timeout)
    while !isReady, !closed, clock.now < deadline { try await Task.sleep(for: .milliseconds(40)) }
    guard isReady else {
      let state = try? await webView.evaluateJavaScript(
        "({url:location.href,bridge:typeof window.slop,ready:document.documentElement.dataset.hitslopReady||null,state:document.readyState,body:document.body?.innerText?.slice(0,120)||null})"
      )
      throw SlopPackageError.invalid(
        closed
          ? "runtime closed"
          : "timed out waiting for slop.ready(); guest state: \(String(describing: state)); navigation error: \(lastError?.localizedDescription ?? "none")"
      )
    }
  }
  fileprivate func bridgeDidBecomeReady() {
    guard !isReady else { return }
    isReady = true
    retryCount = 0
    delegate?.runtimeSessionDidBecomeReady(self)
    if let error = bridge.openingError { delegate?.runtimeSession(self, didFail: error) }
  }
  fileprivate func bridgeDidRequestResize(_ size: CGSize) throws -> CGSize {
    guard let delegate else {
      throw SlopPackageError.invalid("the host does not support dynamic window sizing")
    }
    return try delegate.runtimeSession(self, resizeContentTo: size)
  }
  private func scheduleExternalRefresh() {
    refreshTask?.cancel()
    refreshTask = Task { @MainActor [weak self] in
      try? await Task.sleep(for: .milliseconds(50))
      guard !Task.isCancelled else { return }
      await self?.refreshExternalState()
    }
  }
  private func refreshExternalState() async {
    let requestedAtSequence = sequence
    let revisions = await bridge.revisions()
    guard !closed else { return }
    guard requestedAtSequence == sequence else {
      scheduleExternalRefresh()
      return
    }
    if let document = bridge.document {
      do { try await document.refreshExternal() } catch {
        delegate?.runtimeSession(self, didFail: error)
      }
    }
    if revisions.media != mediaRevision {
      mediaRevision = revisions.media
      emitMedia(revision: revisions.media, source: "external")
    }
    if revisions.theme != themeRevision {
      themeRevision = revisions.theme
      reloadTheme()
    }
  }
  private func reloadTheme() {
    let value = themeRevision ?? "default-\(Date().timeIntervalSince1970)"
    webView.callAsyncJavaScript(
      "window.__hitslopReloadTheme?.(revision)", arguments: ["revision": value], in: nil, in: .page
    ) { _ in }
  }
  fileprivate func emitMedia(revision: String?, source: String, sha256: String? = nil) {
    sequence += 1
    var event: [String: Any] = [
      "kind": "media", "source": source, "sequence": sequence, "revision": revision ?? NSNull(),
    ]
    if let sha256 { event["sha256"] = sha256 }
    // callAsyncJavaScript serializes arguments on the WebKit side, so the
    // event payload never round-trips through string interpolation.
    webView.callAsyncJavaScript(
      "window.__hitslopEmit?.(event)", arguments: ["event": event], in: nil, in: .page
    ) { _ in }
  }
  public func webView(
    _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
    decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
  ) {
    guard webView === self.webView, !closed, let url = action.request.url else {
      decisionHandler(.cancel)
      return
    }
    switch SlopRuntimeSecurity.navigation(
      url, targetIsMainFrame: action.targetFrame?.isMainFrame == true,
      isLink: action.navigationType == .linkActivated,
      trustedSource: accepts(webView, frame: action.sourceFrame),
      isDownload: action.shouldPerformDownload, purpose: purpose)
    {
    case .allow:
      decisionHandler(.allow)
    case .openExternal:
      #if os(macOS)
        NSWorkspace.shared.open(url)
      #else
        UIApplication.shared.open(url)
      #endif
      decisionHandler(.cancel)
    case .cancel:
      decisionHandler(.cancel)
    }
  }
  public func webView(
    _ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
    decisionHandler: @escaping @MainActor (WKNavigationResponsePolicy) -> Void
  ) {
    guard webView === self.webView, !closed, response.isForMainFrame, response.canShowMIMEType,
      let url = response.response.url, SlopRuntimeSecurity.isDocument(url)
    else {
      decisionHandler(.cancel)
      return
    }
    decisionHandler(.allow)
  }
  public func webView(
    _ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error
  ) { recover(error) }
  public func webView(
    _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) { recover(error) }
  public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    recover(SlopPackageError.invalid("slop web process stopped"))
  }
  private func recover(_ error: Error) {
    guard !closed, acceptingRequests else { return }
    lastError = error
    if retryCount == 0 {
      retryCount = 1
      reload()
    } else {
      delegate?.runtimeSession(self, didFail: error)
    }
  }
}

#if os(macOS)
  extension SlopRuntimeSession: WKUIDelegate {
    public func webView(
      _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
      for action: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? { nil }
    public func webView(
      _ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
      initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
      decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
    ) {
      let allowed =
        purpose == .interactive && accepts(webView, frame: frame)
        && origin.protocol == "slop" && origin.host == "app" && origin.port == 0
      decisionHandler(allowed ? .prompt : .deny)
    }
    public func webView(
      _ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
      initiatedByFrame frame: WKFrameInfo,
      completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void
    ) {
      guard purpose == .interactive, accepts(webView, frame: frame), openPanel == nil else {
        completionHandler(nil)
        return
      }
      let panel = NSOpenPanel()
      openPanel = panel
      panel.canChooseFiles = true
      panel.canChooseDirectories = false
      panel.allowsMultipleSelection = parameters.allowsMultipleSelection
      // Document media accepts images and bounded ZIP archives. WebKit does not
      // expose an input's `accept` list here, so keep the native picker in
      // sync with the host store and include Winamp's ZIP-based extension.
      panel.allowedContentTypes = [.image, .zip, UTType(filenameExtension: "wsz")].compactMap { $0 }
      panel.begin { [weak self] response in
        guard let self else {
          completionHandler(nil)
          return
        }
        self.openPanel = nil
        completionHandler(response == .OK && self.accepts(webView, frame: frame) ? panel.urls : nil)
      }
    }
  }

  private final class InteractiveWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override var mouseDownCanMoveWindow: Bool { false }
  }
#endif
