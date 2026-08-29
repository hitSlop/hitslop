export type SlopStoreKind = "json" | "sqlite";
export type SlopChange = { kind: SlopStoreKind; store: string; source: string; revision?: string | null; sequence?: number };
export type SlopStatement = { sql: string; parameters?: unknown[] };

export interface SlopHost {
  query<T = Record<string, unknown>>(store: string, sql: string, params?: unknown[]): Promise<T[]>;
  execute(store: string, sql: string, params?: unknown[]): Promise<number>;
  transaction(store: string, statements: SlopStatement[]): Promise<number>;
  jsonRead<T>(store: string): Promise<{ value: T; revision: string }>;
  jsonWrite<T>(store: string, value: T, expectedRevision?: string): Promise<{ revision: string }>;
  watch(kind: SlopStoreKind, store: string, callback: (event: SlopChange) => void): () => void;
}

export type WindowSlop = {
  db: {
    query: (store: string, sql: string, parameters?: unknown[]) => Promise<unknown[]>;
    execute: (store: string, sql: string, parameters?: unknown[]) => Promise<number>;
    transaction: (store: string, statements: SlopStatement[]) => Promise<number>;
    onChange: (store: string, callback: (event: SlopChange) => void) => () => void;
  };
  json: {
    read: (store: string) => Promise<{ value: unknown; revision: string }>;
    write: (store: string, value: unknown, expectedRevision?: string) => Promise<{ revision: string }>;
    onChange: (store: string, callback: (event: SlopChange) => void) => () => void;
  };
  ready?: () => void;
};

declare global { interface Window { slop?: WindowSlop } }
