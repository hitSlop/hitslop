import { installPresentationStage } from "./presentation.js";
Object.assign(window, { __hitslopInstallPresentationStage: installPresentationStage });
import type { Open, Snapshot } from "@hitslop/schema/document-protocol";
import "./capture.js";
import {
  DocumentFrameSchema,
  type DocumentFrame,
  type BridgeMethod,
  type BridgeParams,
  type BridgeResult,
} from "@hitslop/schema/bridge";
import { validate } from "@hitslop/schema/validation";
import { createThemeReload } from "./theme-reload.js";
import { dispatchChange } from "./change-events.js";
import { createBridgeCall } from "./bridge-call.js";
import type { SlopChange, WindowSlop } from "./types.js";

declare global {
  interface Window {
    webkit: { messageHandlers: { hitslop: { postMessage(request: unknown): Promise<unknown> } } };
    __hitslopEmit?: (event: unknown) => void;
    __hitslopReloadTheme?: (revision: string) => void;
    __hitslopDocumentPublish?: (frame: unknown) => void;
  }
}

const native = window.webkit.messageHandlers.hitslop;
const invoke = createBridgeCall(async (request) => {
  const reply = await native.postMessage(JSON.stringify(request));
  if (typeof reply !== "string") throw new Error("Expected JSON text from host");
  return JSON.parse(reply);
});
const pending = new Set<Promise<unknown>>();
const listeners = {
  media: new Set<(event: SlopChange) => void>(),
};
let guestReady = false;
let readySent = false;
let readyScheduled = false;

async function drain(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}
function call<M extends BridgeMethod>(
  method: M,
  params: NoInfer<BridgeParams<M>>,
): Promise<BridgeResult<M>> {
  const result = invoke(method, params);
  pending.add(result);
  void result.then(
    () => {
      pending.delete(result);
      scheduleReady();
    },
    () => {
      pending.delete(result);
      scheduleReady();
    },
  );
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
    void call("ready", {}).catch((error) => console.error("hitSlop ready failed", error));
    window.dispatchEvent(new Event("slop:ready"));
  };
  // Offscreen WebViews can suspend both animation frames and timers. Readiness
  // follows the guest's completed load attempt; capture settles layout itself.
  queueMicrotask(finish);
}
const watch = (kind: keyof typeof listeners, callback: (event: SlopChange) => void) => {
  listeners[kind].add(callback);
  return () => {
    listeners[kind].delete(callback);
  };
};
let connected = false,
  writable = false;
let previousAuthority = "",
  previousLease = "";
const connections = new Set<() => void>();
const handoffs = new Set<(open: Open, previous: string) => void>();
const frames = new Set<(frame: DocumentFrame) => void>();
window.__hitslopDocumentPublish = (value) => {
  let frame: DocumentFrame;
  try {
    frame = validate(DocumentFrameSchema, value);
  } catch (error) {
    console.error(error);
    return;
  }
  const changed = connected !== frame.connected || writable !== frame.writable;
  connected = frame.connected;
  writable = frame.writable;
  if (changed) for (const listener of connections) listener();
  if (
    frame.lease &&
    (frame.lease.id !== previousLease || frame.snapshot.authority !== previousAuthority)
  ) {
    for (const listener of handoffs)
      listener(
        { snapshot: frame.snapshot as Snapshot, lease: frame.lease },
        frame.handoffFrom ?? previousAuthority,
      );
    previousLease = frame.lease.id;
  }
  previousAuthority = frame.snapshot.authority;
  for (const callback of [...frames]) {
    try {
      callback(frame);
    } catch (error) {
      console.error(error);
    }
  }
};
window.__hitslopReloadTheme = createThemeReload(document);
window.__hitslopEmit = (value) =>
  dispatchChange(value, listeners, (error) => console.error("hitSlop change event failed", error));
const bridge: WindowSlop = {
  info: () => call("host.info", {}),
  flush: drain,
  document: {
    get connected() {
      return connected;
    },
    get writable() {
      return writable;
    },
    open: async () => {
      const open = (await call("document.open", {})) as Open;
      if (open.status) {
        connected = open.status.connected;
        writable = open.status.writable;
        for (const listener of connections) listener();
      }
      previousAuthority = open.snapshot.authority;
      previousLease = open.lease.id;
      return open;
    },
    send: (request) => call("document.execute", { request }),
    flush: async () => {
      await call("document.flush", {});
    },
    subscribe: (callback) => {
      const listener = (frame: DocumentFrame) => callback(frame.snapshot as Snapshot);
      frames.add(listener);
      return () => {
        frames.delete(listener);
      };
    },
    onConnection: (listener) => {
      connections.add(listener);
      return () => {
        connections.delete(listener);
      };
    },
    onHandoff: (listener) => {
      handoffs.add(listener);
      return () => {
        handoffs.delete(listener);
      };
    },
  },
  media: {
    open: (sha256) => call("media.open", { sha256 }),
    add: (data, kind) => call("media.add", { data, kind }),
    onChange: (callback) => watch("media", callback),
  },
  window: {
    resize: (size) => call("window.resize", size),
  },
  reportError: async (issue) => {
    await call("runtime.reportError", { issue });
  },
  ready: () => {
    guestReady = true;
    document.documentElement.dataset.hitslopReady = "true";
    scheduleReady();
  },
};
window.slop = Object.freeze(bridge);
window.addEventListener("error", (event) => {
  void bridge
    .reportError({ source: "unhandled", message: (event.message || "App error").slice(0, 4096) })
    .catch(() => undefined);
});
window.addEventListener("unhandledrejection", (event) => {
  void bridge
    .reportError({ source: "unhandled", message: String(event.reason).slice(0, 4096) })
    .catch(() => undefined);
});
