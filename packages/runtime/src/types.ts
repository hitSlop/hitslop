export type SlopStoreKind = "media" | "sync";
import type { HostInfo, SlopChange } from "@hitslop/schema/bridge";
export type { HostInfo, SlopChange } from "@hitslop/schema/bridge";
export type SlopMediaSnapshot = { exists: boolean; revision: string | null };
export type SlopWindowSize = { width: number; height: number };

export interface SlopHost {
  mediaOpen(name: string): Promise<SlopMediaSnapshot>;
  mediaWrite(name: string, data: string, mimeType: string): Promise<{ revision: string }>;
  mediaRemove(name: string): Promise<{ revision: null }>;
  resizeWindow(size: SlopWindowSize): Promise<SlopWindowSize>;
  dragWindow(): Promise<void>;
  watch(kind: SlopStoreKind, callback: (event: SlopChange) => void): () => void;
}

export type WindowSlop = {
  runtime: import("@hitslop/schema/document-runtime").DocumentRuntime;
  preview?: {data?: unknown};
  sync: SlopSyncBridge;
  info?: () => Promise<HostInfo>;
  errors: {
    report(value: import("@hitslop/schema/bridge").BridgeParams<"errors.report">): Promise<unknown>;
    clear(value: import("@hitslop/schema/bridge").BridgeParams<"errors.clear">): Promise<unknown>;
  };
  media: {
    open: (name: string) => Promise<SlopMediaSnapshot>;
    write: (name: string, data: string, mimeType: string) => Promise<{ revision: string }>;
    remove: (name: string) => Promise<{ revision: null }>;
    onChange: (callback: (event: SlopChange) => void) => () => void;
  };
  window?: {
    resize: (size: SlopWindowSize) => Promise<SlopWindowSize>;
    drag?: () => Promise<void>;
  };
  ready?: () => void;
  flush?: () => Promise<void>;
};

declare global { interface Window { slop?: WindowSlop } }

export interface SlopSyncBridge {
  open(): Promise<import("@hitslop/schema/sync").SyncSnapshot>;
  commit(value: import("@hitslop/schema/sync").SyncCommit): Promise<import("@hitslop/schema/sync").SyncSnapshot>;
  readExternal(): Promise<import("@hitslop/schema/sync").SyncSnapshot>;
  review(value: { proposal: string; canApply: boolean }): Promise<"apply" | "keep" | "cancel">;
  onChange(callback: (event: SlopChange) => void): () => void;
}
