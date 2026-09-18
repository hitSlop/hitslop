import Foundation
import Testing
import WebKit

@testable import HitSlopRuntime

@MainActor private final class CommandBenchmarkBridge: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
    let storage: SlopCommandStorage
    let schema: SlopDocumentSchema
    var loaded: CheckedContinuation<Void, Never>?
    init(storage: SlopCommandStorage, schema: SlopDocumentSchema) {
        self.storage = storage
        self.schema = schema
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded?.resume()
        loaded = nil
    }
    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        do {
            let start = ContinuousClock.now
            let request = try SlopDocumentJSON(data: Data((message.body as! String).utf8))
            let outcome = try storage.apply(request, schema: schema)
            let applied = start.duration(to: .now).components
            let snapshot = try outcome.snapshot.encoded()
            replyHandler(
                [
                    "snapshot": String(decoding: snapshot, as: UTF8.self),
                    "authorityMs": Double(applied.seconds) * 1000 + Double(applied.attoseconds) / 1e15,
                    "loadMs": storage.timings.load, "applyValidateMs": storage.timings.apply,
                    "saveMs": storage.timings.save,
                ], nil)
        } catch { replyHandler(nil, error.localizedDescription) }
    }
}

struct CommandPerformanceTests {
    /// Isolated real WebKit → Swift → SQLite → full snapshot, before production bridge cutover.
    @Test @MainActor func webKitCheckpoint() async throws {
        guard ProcessInfo.processInfo.environment["HITSLOP_COMMAND_BENCHMARK"] == "1" else { return }
        let schemaJSON = try SlopDocumentJSON(
            data: Data(
                #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"tasks":{"type":"array","x-hitslop":{"container":"list","key":"id"},"items":{"type":"object","x-hitslop":{"container":"map"},"properties":{"id":{"type":"string"},"text":{"type":"string"},"done":{"type":"boolean"}},"required":["id","text","done"]}}},"required":["tasks"]}"#
                    .utf8))
        let schema = try SlopDocumentSchema(schemaJSON)
        for rows in [1_000, 5_000, 10_000] {
            let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: root) }
            let initial: SlopDocumentJSON = .object([
                "tasks": .array(
                    (0..<rows).map {
                        .object([
                            "id": .string(String($0)), "text": .string(String(repeating: "x", count: 32)),
                            "done": .bool(false),
                        ])
                    })
            ])
            try schema.validate(initial)
            let storage = try SlopCommandStorage(root: root)
            try storage.initialize(
                snapshot: .object([
                    "documentId": .string("benchmark"), "schemaHash": .string("benchmark"),
                    "authority": .string("benchmark"), "revision": .number(0), "data": initial,
                ]))
            let opening = try storage.open()
            let bridge = CommandBenchmarkBridge(storage: storage, schema: schema)
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .nonPersistent()
            configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "commands")
            let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 800, height: 600), configuration: configuration)
            web.navigationDelegate = bridge
            await withCheckedContinuation { continuation in
                bridge.loaded = continuation
                web.loadHTMLString(
                    "<!doctype html><body><div id='rows'></div><span id='count'></span></body>", baseURL: nil)
            }
            for renderRows in [false, true] {
                let output = try await web.callAsyncJavaScript(
                    #"""
                    const open = JSON.parse(opening);
                    const render = data => {
                      document.querySelector('#count').textContent = data.tasks.filter(t => t.done).length;
                      if (renderRows) {
                        if (!document.querySelector('#rows').children.length) {
                          const fragment = document.createDocumentFragment();
                          for (const task of data.tasks) {
                            const row = document.createElement('label');
                            row.innerHTML = '<input type="checkbox"><span></span>';
                            row.lastChild.textContent = task.text;
                            fragment.appendChild(row);
                          }
                          document.querySelector('#rows').appendChild(fragment);
                        }
                        data.tasks.forEach((task, i) => document.querySelector('#rows').children[i].firstChild.checked = task.done);
                      }
                    };
                    render(open.snapshot.data);
                    const samples = [];
                    for (let i = 0; i < 8; i++) {
                      const request = {documentId:'benchmark',schemaHash:'benchmark',authority:'benchmark',leaseId:open.lease.id,requestId:String(renderRows)+":"+i,ops:[{op:'toggle',path:[{key:'tasks'},{item:'0'},{key:'done'}]}]};
                      const start = performance.now();
                      const reply = await window.webkit.messageHandlers.commands.postMessage(JSON.stringify(request));
                      const received = performance.now();
                      const snapshot = JSON.parse(reply.snapshot);
                      render(snapshot.data);
                      // Force style/layout; background WKWebViews may throttle animation frames.
                      document.body.getBoundingClientRect();
                      const end = performance.now();
                      if (i >= 3) samples.push({authorityMs:reply.authorityMs,loadMs:reply.loadMs,applyValidateMs:reply.applyValidateMs,saveMs:reply.saveMs,roundTripMs:received-start,commandToLayoutMs:end-start});
                    }
                    return JSON.stringify(samples);
                    """#,
                    arguments: [
                        "opening": String(decoding: try opening.encoded(), as: UTF8.self), "renderRows": renderRows,
                    ], in: nil, contentWorld: .page)
                print("[command checkpoint] rows=\(rows) renderRows=\(renderRows) samples=\(output ?? "nil")")
            }
            configuration.userContentController.removeScriptMessageHandler(forName: "commands", contentWorld: .page)
        }
    }
}
