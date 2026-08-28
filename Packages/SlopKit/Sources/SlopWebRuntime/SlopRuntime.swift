import Foundation
import SlopCore
import WebKit

enum SlopRuntime {
    static func baseStyles() throws -> (data: Data, url: URL) {
        try resource(named: "slop-base", extension: "css")
    }

    private static func resource(named name: String, extension fileExtension: String) throws -> (Data, URL) {
        guard let url = Bundle.module.url(forResource: name, withExtension: fileExtension) else {
            throw SlopHostError.invalidPackage("Host runtime resource is missing: \(name).\(fileExtension)")
        }
        return (try Data(contentsOf: url, options: .mappedIfSafe), url)
    }

    static let source = #"""
    (() => {
      const native = window.webkit.messageHandlers.slop;
      let pending = 0;
      let guestReady = false;
      const markGuestReady = () => { guestReady = true; scheduleReady(); };
      let readySent = false;
      let mutationVersion = 0;
      const call = (op, payload = {}) => {
        if (op !== "log" && op !== "ready") pending += 1;
        return native.postMessage({ op, ...payload }).finally(() => {
          if (op !== "log" && op !== "ready") pending -= 1;
          scheduleReady();
        });
      };
      const scheduleReady = () => {
        if (!guestReady || readySent || pending !== 0) return;
        const version = mutationVersion;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (readySent || pending !== 0 || version !== mutationVersion) return scheduleReady();
          readySent = true;
          native.postMessage({ op: "ready" });
          window.dispatchEvent(new Event("slop:ready"));
        }));
      };
      new MutationObserver(() => { mutationVersion += 1; scheduleReady(); })
        .observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      const handledInlineEditors = new WeakSet();
      document.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === "Escape") && event.target?.dataset?.slopInlineEditor === "true") {
          event.preventDefault();
          handledInlineEditors.add(event.target);
        }
      }, true);
      document.addEventListener("blur", event => {
        const editor = event.target;
        if (editor?.dataset?.slopInlineEditor !== "true") return;
        if (handledInlineEditors.delete(editor)) return;
        setTimeout(() => {
          if (!editor.isConnected) return;
          editor.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true
          }));
        }, 0);
      }, true);
      window.addEventListener("error", event => call("log", { message: `JavaScript error: ${event.message}` }));
      window.addEventListener("unhandledrejection", event => call("log", { message: `Unhandled rejection: ${String(event.reason)}` }));
      const subscribe = (kind, store, callback) => {
        const listener = event => {
          if (event.detail.kind === kind && event.detail.store === store) callback(event.detail);
        };
        window.addEventListener("slop:change", listener);
        return () => window.removeEventListener("slop:change", listener);
      };
      const db = Object.freeze({
        query: (store, sql, parameters = []) => call("query", { store, sql, parameters }).then(v => v.rows),
        execute: (store, sql, parameters = []) => call("execute", { store, sql, parameters }).then(v => v.changes),
        transaction: (store, statements) => call("transaction", { store, statements }).then(v => v.changes),
        onChange: (store, callback) => subscribe("sqlite", store, callback)
      });
      const json = Object.freeze({
        read: store => call("jsonRead", { store }),
        write: (store, value, expectedRevision) => call("jsonWrite", { store, value, expectedRevision }),
        onChange: (store, callback) => subscribe("json", store, callback)
      });
      Object.defineProperty(window, "slop", { value: Object.freeze({ db, json, ready: markGuestReady }), writable: false });
    })();
    """#

    static var userScript: WKUserScript {
        WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page)
    }
}
