type Options<T> = {
  fallback: T; clone: (value: T) => T;
  open: (initialValue: T) => Promise<{ value: T; revision: string }>;
  read: () => Promise<{ value: T; revision: string }>;
  write: (value: T, revision: string) => Promise<{ revision: string }>;
  onValue: (value: T) => void; onRevision: (revision: string | null) => void;
  onSource: (source: string) => void; onError: (message: string | null) => void;
};

export class JsonWriteQueue<T> {
  revision: string | null = null;
  private persisted: T; private loaded = false; private pending: Array<(value: T) => void> = [];
  private draining: Promise<void> | null = null; private operations = Promise.resolve<unknown>(undefined);
  constructor(private options: Options<T>) { this.persisted = options.clone(options.fallback); options.onValue(options.clone(this.persisted)); }
  enqueue(mutate: (value: T) => void): void { this.pending.push(mutate); this.applyPending(); void this.drain(); }
  reload(): Promise<void> { return this.schedule(async () => { await this.reloadPersisted(); this.loaded = true; this.applyPending(); this.options.onError(null); }); }
  drain(): Promise<void> { this.draining ??= this.schedule(() => this.drainLoop()).finally(() => { this.draining = null; }); return this.draining; }
  private async drainLoop(): Promise<void> {
    if (!this.loaded) { await this.reloadPersisted(); this.loaded = true; }
    while (this.pending.length) {
      const mutate = this.pending[0]!; const next = this.options.clone(this.persisted); mutate(next);
      try {
        const result = await this.options.write(next, this.revision ?? "");
        this.persisted = next; this.revision = result.revision; this.pending.shift();
        this.options.onRevision(this.revision); this.options.onSource("app"); this.options.onError(null); this.applyPending();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("revision_conflict")) { await this.reloadPersisted(); this.applyPending(); continue; }
        this.pending.shift(); this.options.onError(message); this.applyPending();
      }
    }
  }
  private async reloadPersisted(): Promise<void> { const snapshot = this.loaded ? await this.options.read() : await this.options.open(this.options.fallback); this.persisted = this.options.clone(snapshot.value); this.revision = snapshot.revision; this.options.onRevision(this.revision); }
  private schedule<TValue>(operation: () => Promise<TValue>): Promise<TValue> { const scheduled = this.operations.then(operation, operation); this.operations = scheduled.catch(() => undefined); return scheduled; }
  private applyPending(): void { const next = this.options.clone(this.persisted); for (const mutate of this.pending) mutate(next); this.options.onValue(next); }
}
