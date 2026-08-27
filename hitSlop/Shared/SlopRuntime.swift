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

/// Host-owned form interceptor for sql-html-v1 views. Idiomorph is injected separately.
public let slopCheckedRuntimeJavaScript = #"""
(() => {
  if (window.__slopApplySnapshot) return;
  const call = (op, payload = {}) =>
    window.webkit.messageHandlers.slop.postMessage({ op, ...payload });

  window.__slopApplySnapshot = (html) => {
    if (typeof Idiomorph === "undefined") {
      throw new Error("Idiomorph runtime is missing");
    }
    const next = new DOMParser().parseFromString(html, "text/html");
    if (!next.documentElement || !next.head || !next.body) {
      throw new Error("The HTML snapshot is missing its document, head, or body");
    }
    Idiomorph.morph(document.documentElement, next.documentElement, {
      restoreFocus: true,
      head: { style: "morph" }
    });
    if (!document.head || !document.body) {
      throw new Error("The HTML snapshot removed the document head or body");
    }
  };

  async function submitForm(form) {
    if (form.getAttribute("aria-busy") === "true") return;
    form.setAttribute("aria-busy", "true");
    try {
      const params = {};
      for (const el of form.querySelectorAll("input[name], textarea[name], select[name]")) {
        if (el.disabled) continue;
        if ((el.type === "checkbox" || el.type === "radio") && !el.checked) continue;
        params[el.name] = String(el.value ?? "");
      }
      const response = await call("action", {
        name: form.getAttribute("data-slop-action"),
        params
      });
      if (response && response.error) throw new Error(response.error);
      if (response && response.html) window.__slopApplySnapshot(response.html);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      form.removeAttribute("aria-busy");
    }
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches("form[data-slop-action]")) return;
    event.preventDefault();
    submitForm(form);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const form = target.closest("form[data-slop-action][data-slop-trigger='change']");
    if (form) submitForm(form);
  });
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
