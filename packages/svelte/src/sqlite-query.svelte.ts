import { slop, type SlopStatement } from "@hitslop/runtime";
import { LatestTask } from "@hitslop/runtime/adapter";
export class SqliteQuery<T> {
  current = $state<T[]>([]); isLoading = $state(true); error = $state<string | null>(null); lastChangeSource = $state("package");
  private unwatch: (() => void) | null = null;
  private task = new LatestTask();
  constructor(private statement: SlopStatement) { void this.reload(); this.unwatch = slop.db.onChange((event) => { this.lastChangeSource = event.source; void this.reload(); }); }
  async execute(statement: SlopStatement): Promise<void> { await slop.db.execute(statement.sql, statement.parameters ?? []); }
  async reload(): Promise<void> {
    this.isLoading = true;
    await this.task.run(() => slop.db.query<T>(this.statement.sql, this.statement.parameters ?? []),
      (rows) => { this.current = rows; this.error = null; },
      (error) => { this.error = error instanceof Error ? error.message : String(error); },
      () => { this.isLoading = false; });
  }
  destroy(): void { this.task.dispose(); this.unwatch?.(); this.unwatch = null; }
}
export const sqliteQuery = <T>(statement: SlopStatement): SqliteQuery<T> => new SqliteQuery(statement);
