import type { SlopHost, SlopWindowSize, WindowSlop } from "./types.ts";
export type { SlopChange, SlopHost, SlopMediaSnapshot, SlopStoreKind, SlopWindowSize, WindowSlop } from "./types.ts";
export { flush } from "./lifecycle.js";
export { SlopError } from "./errors.js";
export async function hostInfo() {
  if (typeof window === "undefined" || !window.slop?.info) throw new Error("Host information is unavailable");
  return window.slop.info();
}

let configuredHost: SlopHost | undefined;

const fromBridge = (bridge: WindowSlop): SlopHost => ({
  mediaOpen: (name) => bridge.media.open(name),
  mediaWrite: (name, data, mimeType) => bridge.media.write(name, data, mimeType),
  mediaRemove: (name) => bridge.media.remove(name),
  resizeWindow: (size) => bridge.window?.resize
    ? bridge.window.resize(size)
    : Promise.reject(new Error("The hitSlop host does not support dynamic window sizing.")),
  dragWindow: () => bridge.window?.drag
    ? bridge.window.drag()
    : Promise.reject(new Error("The hitSlop host does not support window dragging.")),
  watch: (kind, callback) => kind === "sync" ? bridge.sync.onChange(callback) : bridge.media.onChange(callback),
});

export function installHost(host: SlopHost): () => void {
  configuredHost = host;
  return () => { if (configuredHost === host) configuredHost = undefined; };
}

export function getHost(): SlopHost {
  if (configuredHost) return configuredHost;
  if (typeof window !== "undefined" && window.slop?.media) return fromBridge(window.slop);
  throw new Error("hitSlop host bridge is unavailable. Run this project with `slop dev` or inside hitSlop.");
}

export const slop = {
  media: {
    open: (name: string) => getHost().mediaOpen(name),
    write: (name: string, data: string, mimeType: string) => getHost().mediaWrite(name, data, mimeType),
    remove: (name: string) => getHost().mediaRemove(name),
    onChange: (callback: Parameters<SlopHost["watch"]>[1]) => getHost().watch("media", callback),
  },
  window: {
    resize: (size: SlopWindowSize) => getHost().resizeWindow(size),
    drag: () => getHost().dragWindow(),
  },
};

export function ready(): void { if (typeof window !== "undefined") window.slop?.ready?.(); }

export { capture, type CaptureMode } from "./capture.js";

export { errors, type ErrorReport } from "./host-errors.js";
