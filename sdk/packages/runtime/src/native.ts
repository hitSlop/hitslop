import type { SlopHost, SlopStatement, WindowSlop } from "./types.ts";

export function nativeHostFromWindow(bridge: WindowSlop): SlopHost {
  return {
    query: (store, sql, params = []) =>
      bridge.db.query(store, sql, params) as Promise<Record<string, unknown>[]>,
    execute: (store, sql, params = []) => bridge.db.execute(store, sql, params),
    transaction: (store, statements: SlopStatement[]) =>
      bridge.db.transaction(
        store,
        statements.map((statement) => ({
          sql: statement.sql,
          parameters: statement.parameters ?? [],
        }))
      ),
    jsonRead: async <T>(store: string) => {
      const result = await bridge.json.read(store);
      return { value: result.value as T, revision: result.revision };
    },
    jsonWrite: async <T>(store: string, value: T, expectedRevision?: string) => {
      const result = await bridge.json.write(store, value, expectedRevision);
      return { revision: result.revision };
    },
    watch: (kind, store, callback) => {
      if (kind === "json") return bridge.json.onChange(store, callback);
      return bridge.db.onChange(store, callback);
    },
  };
}
