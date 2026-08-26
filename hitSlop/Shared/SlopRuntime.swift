import Foundation

public let slopRuntimeJavaScript = #"""
(() => {
  if (window.slop) return;
  const call = (op, payload = {}) =>
    window.webkit.messageHandlers.slop.postMessage({ op, ...payload });
  window.slop = {
    async query(sql, params = []) {
      const response = await call("query", { sql, params });
      if (response && response.error) throw new Error(response.error);
      return response.rows || [];
    },
    async exec(sql, params = []) {
      const response = await call("exec", { sql, params });
      if (response && response.error) throw new Error(response.error);
      return response;
    },
    async transaction(statements) {
      const response = await call("transaction", { statements });
      if (response && response.error) throw new Error(response.error);
      return response.results || [];
    },
    async meta() {
      const response = await call("meta");
      if (response && response.error) throw new Error(response.error);
      return response;
    },
    assetURL(path) {
      const normalized = String(path || "").replace(/^\/+/, "");
      return `slop://document/assets/${normalized}`;
    },
    ready() { return call("ready"); },
    onChange(callback) {
      const listener = event => callback(event.detail || {});
      window.addEventListener("slop:change", listener);
      return () => window.removeEventListener("slop:change", listener);
    }
  };
})();
"""#

/// Host-owned presentation rules. Templates can still scroll, but the mini-doc
/// window never grows browser chrome of its own.
public let slopHostStyleJavaScript = #"""
(() => {
  const install = () => {
    if (document.getElementById("hitslop-host-style")) return;
    const style = document.createElement("style");
    style.id = "hitslop-host-style";
    style.textContent = `
      html { scrollbar-width: none !important; }
      html, body { -ms-overflow-style: none !important; }
      ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
"""#

public func slopJSONData(_ value: Any, pretty: Bool = false) throws -> Data {
    try JSONSerialization.data(
        withJSONObject: value,
        options: pretty ? [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes] : [.sortedKeys, .withoutEscapingSlashes]
    )
}
