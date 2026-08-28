import { nativeHostFromWindow } from "./native.ts";
import type { SlopHost } from "./types.ts";

export type {
  SlopChange,
  SlopHost,
  SlopStatement,
  SlopStoreKind,
  WindowSlop,
} from "./types.ts";
let cached: SlopHost | undefined;

function detectHost(): SlopHost {
  if (typeof window === "undefined") throw new Error("hitSlop runtime requires a browser window");
  if (window.slop?.json && window.slop?.db) {
    return nativeHostFromWindow(window.slop);
  }
  throw new Error("This cartridge must run inside the hitSlop host");
}

export function getHost(): SlopHost {
  cached ??= detectHost();
  return cached;
}

export const slop: SlopHost = {
  query: (store, sql, params) => getHost().query(store, sql, params),
  execute: (store, sql, params) => getHost().execute(store, sql, params),
  transaction: (store, statements) => getHost().transaction(store, statements),
  jsonRead: (store) => getHost().jsonRead(store),
  jsonWrite: (store, value, expectedRevision) =>
    getHost().jsonWrite(store, value, expectedRevision),
  watch: (kind, store, callback) => getHost().watch(kind, store, callback),
};

export function ready(): void {
  if (!window.slop?.ready) throw new Error("The hitSlop readiness bridge is unavailable");
  window.slop.ready();
}
