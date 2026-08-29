import type { SlopHost, SlopStatement, WindowSlop } from "./types.ts";
export type { SlopChange, SlopHost, SlopStatement, SlopStoreKind, WindowSlop } from "./types.ts";

let configuredHost: SlopHost | undefined;

const fromBridge = (bridge: WindowSlop): SlopHost => ({
  query: <T>(store: string, sql: string, params: unknown[] = []) => bridge.db.query(store, sql, params) as Promise<T[]>,
  execute: (store, sql, params = []) => bridge.db.execute(store, sql, params),
  transaction: (store, statements: SlopStatement[]) => bridge.db.transaction(store, statements),
  jsonRead: async <T>(store: string) => {
    const result = await bridge.json.read(store);
    return { value: result.value as T, revision: result.revision };
  },
  jsonWrite: async <T>(store: string, value: T, expectedRevision?: string) => bridge.json.write(store, value, expectedRevision),
  watch: (kind, store, callback) => kind === "json" ? bridge.json.onChange(store, callback) : bridge.db.onChange(store, callback),
});

export function installHost(host: SlopHost): () => void {
  configuredHost = host;
  return () => { if (configuredHost === host) configuredHost = undefined; };
}

export function getHost(): SlopHost {
  if (configuredHost) return configuredHost;
  if (typeof window !== "undefined" && window.slop?.json && window.slop.db) return fromBridge(window.slop);
  throw new Error("hitSlop host bridge is unavailable. Run this project with `slop dev` or inside hitSlop.");
}

export const slop: SlopHost = {
  query: (store, sql, params) => getHost().query(store, sql, params),
  execute: (store, sql, params) => getHost().execute(store, sql, params),
  transaction: (store, statements) => getHost().transaction(store, statements),
  jsonRead: (store) => getHost().jsonRead(store),
  jsonWrite: (store, value, expectedRevision) => getHost().jsonWrite(store, value, expectedRevision),
  watch: (kind, store, callback) => getHost().watch(kind, store, callback),
};

export function ready(): void { if (typeof window !== "undefined") window.slop?.ready?.(); }
