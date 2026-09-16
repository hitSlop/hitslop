#if os(macOS)
import Foundation
import WebKit

/// Only the opt-in executable installs this private bridge.
@MainActor package final class SpikeBridge: NSObject, WKScriptMessageHandlerWithReply {
    package let document: SpikeDocument
    private weak var webView: WKWebView?
    private var eventsTask: Task<Void, Never>?
    private var acknowledgementDelay = 0.0
    private var acceptanceDelay = 0.0
    package private(set) var isAttached = true

    package init(document: SpikeDocument, webView: WKWebView, textPolicy: SpikeTextPolicy = .ancestry) {
        self.document = document; self.webView = webView
        super.init()
        webView.configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "hitslopNativeSpike")
        // Make the absence of WASM measurable, including accidental SDK regressions.
        webView.configuration.userContentController.addUserScript(WKUserScript(source: """
        window.__spikeWasmCalls = 0;
        window.__spikeTextPolicy = '\(textPolicy.rawValue)';
        for (const name of ['instantiate', 'instantiateStreaming', 'compile', 'compileStreaming']) {
          if (WebAssembly[name]) WebAssembly[name] = () => { window.__spikeWasmCalls++; throw new Error('WASM is forbidden in the native spike'); };
        }
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        eventsTask = Task { [weak self, document] in
            do {
                for await frame in try await document.events() {
                    guard let self else { return }
                    let value = try JSONSerialization.jsonObject(with: JSONEncoder().encode(frame))
                    _ = try? await self.webView?.callAsyncJavaScript("window.__spikePublish?.(frame)", arguments: ["frame": value], in: nil, contentWorld: .page)
                }
            } catch { NSLog("Native spike publication: %@", error.localizedDescription) }
        }
    }
    package func detach() {
        isAttached = false
        eventsTask?.cancel(); eventsTask = nil
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "hitslopNativeSpike", contentWorld: .page)
        webView = nil
    }
    package func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                                      replyHandler: @escaping @MainActor (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame else { replyHandler(nil, "Main frame only"); return }
        do {
            let bytes = try JSONSerialization.data(withJSONObject: message.body)
            try SpikeContract.validate(bytes)
            let body = try SpikeJSON(data: bytes)
            Task {
                do {
                    let response: SpikeFrame
                    switch SpikeMethod(rawValue: body["method"].string ?? "") {
                    case .open: response = try await document.frame()
                    case .apply:
                        let request = try JSONDecoder().decode(SpikeEdit.self, from: bytes)
                        if acceptanceDelay > 0 { try await Task.sleep(for: .milliseconds(acceptanceDelay)) }
                        response = try await document.apply(request)
                        if acknowledgementDelay > 0 { try await Task.sleep(for: .milliseconds(acknowledgementDelay)) }
                    case .flush: try await document.flush(); response = try await document.frame()
                    case .releaseDraft:
                        await document.releaseDraft(session: body["session"].string ?? "", draft: body["draft"].string ?? "")
                        response = try await document.frame()
                    case .remote: response = try await document.simulateRemote(after: body["after"], base: body["base"].string)
                    case .delay:
                        if body["phase"].string == "accept" { acceptanceDelay = body["milliseconds"].number ?? 0 }
                        else { acknowledgementDelay = body["milliseconds"].number ?? 0 }
                        response = try await document.frame()
                    case .storage:
                        await document.configureStorage(milliseconds: body["milliseconds"].number ?? 0, failure: body["failure"].string)
                        response = try await document.frame()
                    default: throw SpikeFailure("Unknown native spike method")
                    }
                    replyHandler(try JSONSerialization.jsonObject(with: JSONEncoder().encode(response)), nil)
                } catch { replyHandler(nil, error.localizedDescription) }
            }
        } catch { replyHandler(nil, error.localizedDescription) }
    }
}
#endif
