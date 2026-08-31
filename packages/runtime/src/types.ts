export type SlopStoreKind = "json" | "sqlite";
export type SlopChange = { kind: SlopStoreKind; source: "app" | "external" | "dev"; revision?: string | null; sequence?: number };
export type SlopStatement = { sql: string; parameters?: unknown[] };
export type SlopSnapshot<T> = { value: T; revision: string };

export interface SlopHost {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<number>;
  transaction(statements: SlopStatement[]): Promise<number>;
  jsonOpen<T>(initialValue: T): Promise<SlopSnapshot<T>>;
  jsonRead<T>(): Promise<SlopSnapshot<T>>;
  jsonWrite<T>(value: T, expectedRevision?: string): Promise<{ revision: string }>;
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
  ready?: () => void;
};

declare global { interface Window { slop?: WindowSlop } }
