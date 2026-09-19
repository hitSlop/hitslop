import type { SlopHost, SlopWindowSize, WindowSlop } from "./types.ts";
export type {
  DocumentFrame,
  SlopChange,
  SlopHost,
  SlopMediaSnapshot,
  MediaReference,
  SlopWindowSize,
  WindowSlop,
} from "./types.ts";
export { flush } from "./lifecycle.js";
export { SlopError } from "./errors.js";
export { newId } from "./id.js";
export type { InsertResult, MutationResult } from "./document-controller.js";
export async function hostInfo() {
  if (typeof window === "undefined" || !window.slop?.info)
    throw new Error("Host information is unavailable");
  return window.slop.info();
}

let configuredHost: SlopHost | undefined;

const fromBridge = (bridge: WindowSlop): SlopHost => ({
  reportError: (issue) => bridge.reportError(issue),
  document: bridge.document,
  mediaOpen: (sha256) => bridge.media.open(sha256),
  mediaAdd: (data, kind) => bridge.media.add(data, kind),
  resizeWindow: (size) =>
    bridge.window?.resize
      ? bridge.window.resize(size)
      : Promise.reject(new Error("The hitSlop host does not support dynamic window sizing.")),
  watch: (_kind, callback) => bridge.media.onChange(callback),
});

export function installHost(host: SlopHost): () => void {
  configuredHost = host;
  return () => {
    if (configuredHost === host) configuredHost = undefined;
  };
}

export function getHost(): SlopHost {
  if (configuredHost) return configuredHost;
  if (typeof window !== "undefined" && window.slop) return fromBridge(window.slop);
  throw new Error(
    "hitSlop host bridge is unavailable. Run this project with `slop dev` or inside hitSlop.",
  );
}

export const slop = {
  get document() {
    return getHost().document;
  },
  media: {
    open: (sha256: string) => getHost().mediaOpen(sha256),
    add: (data: string, kind: "image" | "file") => getHost().mediaAdd(data, kind),
    onChange: (callback: Parameters<SlopHost["watch"]>[1]) => getHost().watch("media", callback),
  },
  window: {
    resize: (size: SlopWindowSize) => getHost().resizeWindow(size),
  },
};

export function ready(): void {
  if (typeof window !== "undefined") window.slop?.ready?.();
}

export { capture, type CaptureMode } from "./capture.js";

export { reportRuntimeError } from "./runtime-errors.js";
export type { RuntimeIssue } from "./types.js";
