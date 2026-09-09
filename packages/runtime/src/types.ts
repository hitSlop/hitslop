export type SlopStoreKind = "json" | "sqlite" | "media";
import type { HostInfo, SlopChange, SQLValue } from "@hitslop/schema/bridge";
export type { HostInfo, SlopChange, SQLValue } from "@hitslop/schema/bridge";
export type SlopStatement = { sql: string; parameters?: SQLValue[] };
export type SlopSnapshot<T> = { value: T; revision: string };
export type SlopMediaSnapshot = { exists: boolean; revision: string | null };
export type SlopWindowSize = { width: number; height: number };

export interface SlopHost {
  query<T = Record<string, unknown>>(sql: string, params?: SQLValue[]): Promise<T[]>;
  execute(sql: string, params?: SQLValue[]): Promise<number>;
  transaction(statements: SlopStatement[]): Promise<number>;
  jsonOpen<T>(initialValue: T): Promise<SlopSnapshot<T>>;
  jsonRead<T>(): Promise<SlopSnapshot<T>>;
  jsonWrite<T>(value: T, expectedRevision?: string): Promise<{ revision: string }>;
  mediaOpen(name: string): Promise<SlopMediaSnapshot>;
  mediaWrite(name: string, data: string, mimeType: string): Promise<{ revision: string }>;
  mediaRemove(name: string): Promise<{ revision: null }>;
  resizeWindow(size: SlopWindowSize): Promise<SlopWindowSize>;
  dragWindow(): Promise<void>;
  watch(kind: SlopStoreKind, callback: (event: SlopChange) => void): () => void;
}

export type WindowSlop = {
  info?: () => Promise<HostInfo>;
  db: {
    query: (sql: string, parameters?: SQLValue[]) => Promise<unknown[]>;
    execute: (sql: string, parameters?: SQLValue[]) => Promise<number>;
    transaction: (statements: SlopStatement[]) => Promise<number>;
    onChange: (callback: (event: SlopChange) => void) => () => void;
  };
  json: {
    open: (initialValue: unknown) => Promise<SlopSnapshot<unknown>>;
    read: () => Promise<SlopSnapshot<unknown>>;
    write: (value: unknown, expectedRevision?: string) => Promise<{ revision: string }>;
    onChange: (callback: (event: SlopChange) => void) => () => void;
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
