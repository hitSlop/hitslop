export type SlopStoreKind = "media" | "document";
import type { HostInfo, SlopChange } from "@hitslop/schema/bridge";
export type { HostInfo, SlopChange } from "@hitslop/schema/bridge";
export type SlopMediaSnapshot = { exists: boolean; revision: string | null };
export type SlopWindowSize = { width: number; height: number };

export interface SlopHost {
  document: DocumentHost;
  mediaOpen(name: string): Promise<SlopMediaSnapshot>;
  mediaWrite(name: string, data: string, mimeType: string): Promise<{ revision: string }>;
  mediaRemove(name: string): Promise<{ revision: null }>;
  resizeWindow(size: SlopWindowSize): Promise<SlopWindowSize>;
  dragWindow(): Promise<void>;
  watch(kind: "media", callback: (event: SlopChange) => void): () => void;
}

export type { DocumentFrame, DocumentApply } from "@hitslop/schema/bridge";
import type { DocumentFrame, DocumentApply } from "@hitslop/schema/bridge";
export interface DocumentHost {
  open(initial?: unknown): Promise<DocumentFrame>;
  apply(value: DocumentApply): Promise<DocumentFrame>;
  flush(): Promise<DocumentFrame>;
  releaseDraft(value: { session: string; draft: string }): Promise<DocumentFrame>;
  onChange(callback: (frame: DocumentFrame) => void): () => void;
}

export type WindowSlop = {
  info?: () => Promise<HostInfo>;
  document: DocumentHost;
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

declare global {
  interface Window {
    slop?: WindowSlop;
  }
}
