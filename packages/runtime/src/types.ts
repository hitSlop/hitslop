import type { RuntimeIssue } from "@hitslop/schema/bridge";
export type { RuntimeIssue } from "@hitslop/schema/bridge";
import type { MediaReference } from "@hitslop/schema/bridge";
export type { MediaReference } from "@hitslop/schema/bridge";
import type { HostInfo, SlopChange } from "@hitslop/schema/bridge";
export type { HostInfo, SlopChange } from "@hitslop/schema/bridge";
export type SlopMediaSnapshot = { src: string | null };
export type SlopWindowSize = { width: number; height: number };

export interface SlopHost {
  reportError(issue: RuntimeIssue): Promise<void>;
  document: DocumentHost;
  mediaOpen(sha256: string): Promise<SlopMediaSnapshot>;
  mediaAdd(data: string, kind: "image" | "file"): Promise<MediaReference>;
  resizeWindow(size: SlopWindowSize): Promise<SlopWindowSize>;
  dragWindow(): Promise<void>;
  watch(kind: "media", callback: (event: SlopChange) => void): () => void;
}

export type { DocumentFrame } from "@hitslop/schema/bridge";
export type { CommandHost as DocumentHost } from "./document-controller.js";
import type { CommandHost as DocumentHost } from "./document-controller.js";

export type WindowSlop = {
  info?: () => Promise<HostInfo>;
  reportError(issue: RuntimeIssue): Promise<void>;
  document: DocumentHost;
  media: {
    open: (sha256: string) => Promise<SlopMediaSnapshot>;
    add: (data: string, kind: "image" | "file") => Promise<MediaReference>;
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
