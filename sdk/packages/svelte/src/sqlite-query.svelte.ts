import { slop, type SlopStatement } from "@slop/runtime";

export class SqliteQuery<T> {
  current = $state<T[]>([] as T[]);
  isLoading = $state(true);
  error = $state<string | null>(null);
  lastChangeSource = $state("package");

  #storeID: string;
  #statement: SlopStatement;
  #unwatch: (() => void) | null = null;

  constructor(storeID: string, statement: SlopStatement) {
    this.#storeID = storeID;
    this.#statement = statement;
    this.#start();
  }

  async execute(statement: SlopStatement): Promise<void> {
    try {
      await slop.execute(
        this.#storeID,
        statement.sql,
        statement.parameters ?? []
      );
      this.lastChangeSource = "app";
    } catch (caught) {
      this.error = caught instanceof Error ? caught.message : String(caught);
    }
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    try {
      this.current = await slop.query<T>(
        this.#storeID,
        this.#statement.sql,
        this.#statement.parameters ?? []
      );
      this.error = null;
    } catch (caught) {
      this.error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      this.isLoading = false;
    }
  }

  destroy(): void {
    this.#unwatch?.();
    this.#unwatch = null;
  }

  #start(): void {
    void this.reload();
    this.#unwatch = slop.watch("sqlite", this.#storeID, (event) => {
      this.lastChangeSource = event.source;
      void this.reload();
    });
  }
}

export function sqliteQuery<T>(storeID: string, statement: SlopStatement): SqliteQuery<T> {
  return new SqliteQuery(storeID, statement);
}
