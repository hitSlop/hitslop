import { slop, type SlopStatement } from "@hitslop/runtime";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ExternalStore, errorMessage } from "./external-store.js";

type SqliteState<T> = {
  current: T[];
  isLoading: boolean;
  error: string | null;
  lastChangeSource: string;
};

export type SqliteQuery<T> = SqliteState<T> & {
  execute: (statement: SlopStatement) => Promise<void>;
  reload: () => Promise<void>;
};

const statementKey = (statement: SlopStatement): string =>
  JSON.stringify([statement.sql, statement.parameters ?? []]);

/** Hook-independent core, exported for tests. Use `useSqliteQuery` in apps. */
export class SqliteQueryCore<T> extends ExternalStore<SqliteState<T>> {
  private statement: SlopStatement;
  private loaded = false;

  constructor(statement: SlopStatement) {
    super({ current: [], isLoading: true, error: null, lastChangeSource: "package" });
    this.statement = statement;
  }

  /** Starts the initial query once and re-runs it on database changes. */
  attach = (): (() => void) => {
    if (!this.loaded) { this.loaded = true; void this.reload(); }
    return slop.db.onChange((event) => {
      this.patch({ lastChangeSource: event.source });
      void this.reload();
    });
  };

  /** Adopts a new statement (compared by SQL and parameters) and re-queries. */
  setStatement = (statement: SlopStatement): void => {
    if (statementKey(statement) === statementKey(this.statement)) return;
    this.statement = statement;
    void this.reload();
  };

  execute = async (statement: SlopStatement): Promise<void> => {
    await slop.db.execute(statement.sql, statement.parameters ?? []);
  };

  reload = async (): Promise<void> => {
    this.patch({ isLoading: true });
    try {
      const current = await slop.db.query<T>(this.statement.sql, this.statement.parameters ?? []);
      this.patch({ current, error: null });
    } catch (error) {
      this.patch({ error: errorMessage(error) });
    } finally {
      this.patch({ isLoading: false });
    }
  };
}

export function useSqliteQuery<T = Record<string, unknown>>(statement: SlopStatement): SqliteQuery<T> {
  const [store] = useState(() => new SqliteQueryCore<T>(statement));
  useEffect(() => store.attach(), [store]);
  // No dependency array: setStatement no-ops unless SQL or parameters changed.
  useEffect(() => { store.setStatement(statement); });
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return useMemo(
    () => ({ ...state, execute: store.execute, reload: store.reload }),
    [state, store],
  );
}
