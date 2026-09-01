export type SlopStoreKind = "json" | "sqlite" | "media";
export type SlopChange = { kind: SlopStoreKind; source: "app" | "external" | "dev"; revision?: string | null; sequence?: number };
export type SlopStatement = { sql: string; parameters?: unknown[] };
export type SlopSnapshot<T> = { value: T; revision: string };
export type SlopMediaSnapshot = { exists: boolean; revision: string | null };
export type SlopWindowSize = { width: number; height: number };

export interface SlopHost {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<number>;
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
  db: {
    query: (sql: string, parameters?: unknown[]) => Promise<unknown[]>;
    execute: (sql: string, parameters?: unknown[]) => Promise<number>;
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
};

declare global { interface Window { slop?: WindowSlop } }
