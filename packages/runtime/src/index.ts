import type { SlopHost, SlopStatement, WindowSlop } from "./types.ts";
export type { SlopChange, SlopHost, SlopMediaSnapshot, SlopSnapshot, SlopStatement, SlopStoreKind, WindowSlop } from "./types.ts";

let configuredHost: SlopHost | undefined;

const fromBridge = (bridge: WindowSlop): SlopHost => ({
  query: <T>(sql: string, params: unknown[] = []) => bridge.db.query(sql, params) as Promise<T[]>,
  execute: (sql, params = []) => bridge.db.execute(sql, params),
  transaction: (statements: SlopStatement[]) => bridge.db.transaction(statements),
  jsonOpen: async <T>(initialValue: T) => {
    const result = await bridge.json.open(initialValue);
    return { value: result.value as T, revision: result.revision };
  },
  jsonRead: async <T>() => {
    const result = await bridge.json.read();
    return { value: result.value as T, revision: result.revision };
  },
  jsonWrite: async <T>(value: T, expectedRevision?: string) => bridge.json.write(value, expectedRevision),
  mediaOpen: (name) => bridge.media.open(name),
  mediaWrite: (name, data, mimeType) => bridge.media.write(name, data, mimeType),
  mediaRemove: (name) => bridge.media.remove(name),
  watch: (kind, callback) => kind === "json" ? bridge.json.onChange(callback) : kind === "sqlite" ? bridge.db.onChange(callback) : bridge.media.onChange(callback),
});

export function installHost(host: SlopHost): () => void {
  configuredHost = host;
  return () => { if (configuredHost === host) configuredHost = undefined; };
}

export function getHost(): SlopHost {
  if (configuredHost) return configuredHost;
  if (typeof window !== "undefined" && window.slop?.json && window.slop.db && window.slop.media) return fromBridge(window.slop);
  throw new Error("hitSlop host bridge is unavailable. Run this project with `slop dev` or inside hitSlop.");
}

export const slop = {
  json: {
    open: <T>(initialValue: T) => getHost().jsonOpen(initialValue),
    read: <T>() => getHost().jsonRead<T>(),
    write: <T>(value: T, expectedRevision?: string) => getHost().jsonWrite(value, expectedRevision),
    onChange: (callback: Parameters<SlopHost["watch"]>[1]) => getHost().watch("json", callback),
  },
  db: {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => getHost().query<T>(sql, params),
    execute: (sql: string, params?: unknown[]) => getHost().execute(sql, params),
    transaction: (statements: SlopStatement[]) => getHost().transaction(statements),
    onChange: (callback: Parameters<SlopHost["watch"]>[1]) => getHost().watch("sqlite", callback),
  },
  media: {
    open: (name: string) => getHost().mediaOpen(name),
    write: (name: string, data: string, mimeType: string) => getHost().mediaWrite(name, data, mimeType),
    remove: (name: string) => getHost().mediaRemove(name),
    onChange: (callback: Parameters<SlopHost["watch"]>[1]) => getHost().watch("media", callback),
  },
};

export function ready(): void { if (typeof window !== "undefined") window.slop?.ready?.(); }
