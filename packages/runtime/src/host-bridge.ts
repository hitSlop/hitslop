import "./capture.js";
import type { BridgeMethod, BridgeParams, BridgeResult } from "@hitslop/schema/bridge";
import { assertJSON } from "@hitslop/schema/validation";
import { createBridgeCall } from "./bridge-call.js";
import type { SlopChange, WindowSlop } from "./types.js";

declare global {
  interface Window {
    webkit: { messageHandlers: { hitslop: { postMessage(request: unknown): Promise<unknown> } } };
    __hitslopEmit?: (event: SlopChange) => void;
  }
}

const native = window.webkit.messageHandlers.hitslop;
const invoke = createBridgeCall(request => native.postMessage(request));
const pending = new Set<Promise<unknown>>();
const listeners = { json: new Set<(event: SlopChange) => void>(), sqlite: new Set<(event: SlopChange) => void>(), media: new Set<(event: SlopChange) => void>() };
let guestReady = false;
let readySent = false;
let readyScheduled = false;

async function drain(): Promise<void> { while (pending.size) await Promise.all([...pending]); }
function call<M extends BridgeMethod>(method: M, params: NoInfer<BridgeParams<M>>): Promise<BridgeResult<M>> {
  const result = invoke(method, params);
  pending.add(result);
  void result.then(() => { pending.delete(result); scheduleReady(); }, () => { pending.delete(result); scheduleReady(); });
  return result;
}
function scheduleReady(): void {
  if (!guestReady || readySent || readyScheduled || pending.size) return;
  readyScheduled = true;
  const finish = () => {
    if (!readyScheduled || readySent) return;
    readyScheduled = false;
    if (pending.size) return;
    readySent = true;
    void call("ready", {}).catch(error => console.error("hitSlop ready failed", error));
    window.dispatchEvent(new Event("slop:ready"));
  };
  requestAnimationFrame(() => requestAnimationFrame(finish));
  setTimeout(finish, 100);
}
const watch = (kind: keyof typeof listeners, callback: (event: SlopChange) => void) => {
  listeners[kind].add(callback);
  return () => { listeners[kind].delete(callback); };
};
window.__hitslopEmit = (event) => {
  for (const callback of [...listeners[event.kind]]) {
    try { callback(event); } catch (error) { console.error("hitSlop change listener failed", error); }
  }
};
const bridge: WindowSlop = {
  info: () => call("host.info", {}),
  flush: drain,
  json: {
    open: (value) => { assertJSON(value); return call("json.open", { value }); },
    read: () => call("json.read", {}),
    write: (value, expectedRevision) => { assertJSON(value); return call("json.write", { value, ...(expectedRevision === undefined ? {} : { expectedRevision }) }); },
    onChange: (callback) => watch("json", callback),
  },
  db: {
    query: (sql, parameters = []) => call("sqlite.query", { sql, parameters }),
    execute: (sql, parameters = []) => call("sqlite.execute", { sql, parameters }),
    transaction: (statements) => call("sqlite.transaction", { statements }),
    onChange: (callback) => watch("sqlite", callback),
  },
  media: {
    open: (name) => call("media.open", { name }),
    write: (name, data, mimeType) => call("media.write", { name, data, mimeType }),
    remove: (name) => call("media.remove", { name }),
    onChange: (callback) => watch("media", callback),
  },
  window: {
    resize: (size) => call("window.resize", size),
    drag: async () => { await call("window.drag", {}); },
  },
  ready: () => { guestReady = true; document.documentElement.dataset.hitslopReady = "true"; scheduleReady(); },
};
window.slop = Object.freeze(bridge);
window.addEventListener("error", (event) => { void call("log", { message: event.message }).catch(() => undefined); });
window.addEventListener("unhandledrejection", (event) => { void call("log", { message: String(event.reason) }).catch(() => undefined); });
