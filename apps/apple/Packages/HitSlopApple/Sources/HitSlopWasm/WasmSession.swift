import Foundation
import AppKit
import HitSlopCore
@preconcurrency import WebKit

public struct WasmSaveStatus: Sendable {
  public let status: String
  public let error: String?
}

/// A single live Loro replica. Both editor and CLI use these bundled JS/WASM resources.
@MainActor public final class WasmSession: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
  public let webView: WKWebView
  public let package: SlopPackage
  public let epoch = UUID().uuidString
  public private(set) var isReady = false
  public private(set) var rendererDead = false
  public var onResize: ((CGSize) throws -> CGSize)?
  public var onExport: ((String, URL, NativeCommandDeadline) async throws -> Void)?
  public var capturing = false
  public var onReady: (() -> Void)?
  public var onStatus: ((WasmSaveStatus) -> Void)?
  public var onIssue: ((String, Bool) -> Void)?
  public var onError: ((String) -> Void)?
  #if DEBUG
  var failWritesForTesting = false
  #endif
  private let storage: Storage
  private let headless: Bool
  private var server: SocketServer?
  private var closing = false
  private var closed = false
  private var openingError: String?
  public var webViewResources: URL { Bundle.module.url(forResource: "runtime", withExtension: nil)! }

  public init(package: SlopPackage, headless: Bool = false) throws {
    self.package = package
    self.headless = headless
    storage = try Storage(root: package.rootURL)
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
    let runtime = Bundle.module.url(forResource: "runtime", withExtension: nil)!
    configuration.setURLSchemeHandler(SchemeHandler(root: package.rootURL, runtime: runtime, headless: headless), forURLScheme: "slop")
    let spec = package.manifest.presentation
    webView = WKWebView(frame: CGRect(x:0,y:0,width:spec.width,height:spec.height),configuration:configuration)
    super.init()
    webView.setValue(!package.usesTransparentBackground,forKey:"drawsBackground")
    configuration.userContentController.addScriptMessageHandler(self,contentWorld:.page,name:"storage")
    configuration.userContentController.addUserScript(WKUserScript(source:"""
      for (const type of ['error','unhandledrejection']) addEventListener(type,e=> {
        webkit.messageHandlers.storage.postMessage({method:'runtimeError',kind:'application',error:String(e.error?.message ?? e.reason ?? e.message).slice(0,4096)}).catch(()=>{});
      });
      """,injectionTime:.atDocumentStart,forMainFrameOnly:true))
    webView.navigationDelegate = self
  }
  public func load() { webView.load(URLRequest(url:URL(string:"slop://app/")!)) }
  public func waitUntilReady(timeout: Duration = .seconds(15)) async throws {
    let clock = ContinuousClock(), deadline = ContinuousClock.now.advanced(by:timeout)
    while !isReady && !closed && openingError == nil && clock.now < deadline { try await Task.sleep(for:.milliseconds(25)) }
    guard isReady else { throw failure(openingError ?? "Document runtime did not become ready") }
  }
  public func userContentController(_ controller: WKUserContentController,didReceive message: WKScriptMessage,replyHandler: @escaping @MainActor @Sendable (Any?,String?) -> Void) {
    guard !closed, message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "slop", message.frameInfo.securityOrigin.host == "app", let args = message.body as? [String:Any], let method = args["method"] as? String,
      let encoded = try? JSONSerialization.data(withJSONObject:args), encoded.count <= 48*1024*1024,
      PlatformContract.valid(args,against:bridgeValidationSchema) else { replyHandler(nil,"Invalid bridge request"); return }
    switch method {
    case "config":
      let spec = package.manifest.presentation
      replyHandler(["epoch":epoch,"presentation":["width":spec.width,"height":spec.height,"resizable":package.isResizable,"shape":package.shape.rawValue,"mode":package.isSkinned ? "skin" : package.usesTransparentBackground ? "transparent" : "standard"]],nil)
    case "window.resize":
      do {
        guard !headless, !package.isSkinned, let onResize, let width=args["width"] as? Double, let height=args["height"] as? Double else { throw failure("Window resizing unavailable") }
        let size = try onResize(CGSize(width:width,height:height));replyHandler(["width":size.width,"height":size.height],nil)
      } catch { replyHandler(nil,error.localizedDescription) }
    case "ready":
      do {
        if !headless && server == nil {
          server = try SocketServer { [weak self] request, deadline, reply in
            guard let self else { reply(["ok":false,"error":"Document closed"]); return }
            Task { reply(await self.request(request, deadline: deadline)) }
          }
          let discovery:[String:Any] = ["socket":server!.path,"epoch":epoch,"pid":ProcessInfo.processInfo.processIdentifier,"documentPath":package.rootURL.path]
          try JSONSerialization.data(withJSONObject:discovery).write(to:package.rootURL.appendingPathComponent("state/host.lock"),options:.atomic)
        }
        isReady = true; onReady?();replyHandler([:],nil)
      } catch { openingError = error.localizedDescription;replyHandler(nil,error.localizedDescription) }
    case "status":
      onStatus?(WasmSaveStatus(status:args["status"] as? String ?? "saving",error:args["error"] as? String));replyHandler([:],nil)
    case "failed", "runtimeError":
      let error = args["error"] as? String ?? "Runtime error"
      if method == "runtimeError" && isReady { onIssue?(error,args["kind"] as? String == "operation") }
      else { openingError = error; onError?(error) }
      replyHandler([:],nil)
    default:
      #if DEBUG
      if failWritesForTesting && ["append","checkpoint"].contains(method) { replyHandler(nil,"Injected save failure");return }
      #endif
      storage.queue.async { [storage] in
        let result: Result<Data, Error> = Result {
          let request = try JSONSerialization.jsonObject(with:encoded) as! [String:Any]
          return try JSONSerialization.data(withJSONObject:storage.call(request))
        }
        DispatchQueue.main.async {
          do { replyHandler(try JSONSerialization.jsonObject(with:result.get()),nil) }
          catch { replyHandler(nil,error.localizedDescription) }
        }
      }
    }
  }
  public func request(_ request:[String:Any], deadline: NativeCommandDeadline = NativeCommandDeadline()) async -> [String:Any] {
    guard PlatformContract.valid(request, against: socketRequestSchema) else { return ["ok":false,"error":"Invalid socket request"] }
    guard isReady, !closed, !closing, !capturing, !rendererDead, request["documentPath"] as? String == package.rootURL.path else { return ["ok":false,"epoch":epoch,"error":"Document unavailable or path mismatch"] }
    do {
      try deadline.check()
      if request["method"] as? String == "export" {
        guard let onExport, let format = request["format"] as? String, let output = request["output"] as? String else { throw failure("Live export unavailable") }
        // The JS session owns the current epoch, including receipt-window rotations.
        let hello = try await webView.callAsyncJavaScript("return await globalThis.__slop.request(request)", arguments:["request":["id":UUID().uuidString,"documentPath":package.rootURL.path,"method":"hello"]], in:nil, contentWorld:.page) as? [String:Any]
        guard hello?["ok"] as? Bool == true, hello?["epoch"] as? String == request["epoch"] as? String else { throw failure("Session epoch changed; retry export after inspecting state") }
        try await onExport(format, URL(fileURLWithPath:output), deadline)
        return ["ok":true,"output":output]
      }
      return try await webView.callAsyncJavaScript("return await globalThis.__slop.request(request)",arguments:["request":request],in:nil,contentWorld:.page) as? [String:Any] ?? ["ok":false,"error":"Invalid runtime reply"]
    } catch { return ["ok":false,"epoch":epoch,"error":error.localizedDescription,"retryable":["apply","batch","compact"].contains(request["method"] as? String ?? "")] }
  }
  public func flush() async throws {
    guard !rendererDead, !closed else { throw failure("Document renderer unavailable") }
    _ = try await webView.callAsyncJavaScript("await globalThis.__slop.flush(); return true",arguments:[:],in:nil,contentWorld:.page)
  }
  public func close() async throws {
    if closed { return }
    guard !closing, !capturing else { throw failure("Document already closing") }
    closing = true
    defer { closing = false }
    if isReady && !rendererDead {
      _ = try await webView.callAsyncJavaScript("await globalThis.__slop.close(); return true",arguments:[:],in:nil,contentWorld:.page)
    }
    server?.stop();server = nil
    try? FileManager.default.removeItem(at:package.rootURL.appendingPathComponent("state/host.lock"))
    storage.queue.sync { storage.close() }
    webView.stopLoading();webView.configuration.userContentController.removeScriptMessageHandler(forName:"storage",contentWorld:.page)
    webView.navigationDelegate = nil
    closed = true;isReady = false
  }
  public func webViewWebContentProcessDidTerminate(_ webView:WKWebView) {
    rendererDead = true;server?.stop();server = nil
    onError?("The document renderer stopped. Saved edits remain on disk; close and reopen this document.")
  }
  public func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error) { openingError = error.localizedDescription;onError?(error.localizedDescription) }
  public func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping @MainActor (WKNavigationActionPolicy)->Void) {
    if let url = action.request.url, url.scheme == "slop", url.host == "app" { decisionHandler(.allow);return }
    if !headless, action.navigationType == .linkActivated, let url = action.request.url, ["https","http"].contains(url.scheme) { NSWorkspace.shared.open(url) }
    decisionHandler(.cancel)
  }
}
