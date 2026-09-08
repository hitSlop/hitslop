export type JsonSnapshot<T> = { json: string; value: T };

type Source = "package" | "app" | "external";
type Scheduler = {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};
type Options<T> = {
  fallback: JsonSnapshot<T>;
  io: {
    open: (initialValue: T) => Promise<{ value: T; revision: string }>;
    read: () => Promise<{ value: T; revision: string }>;
    write: (value: T, expectedRevision: string) => Promise<{ revision: string }>;
  };
  getLocal: () => JsonSnapshot<T>;
  onAdopt: (value: T, source: Source) => void;
  onRevision: (revision: string | null) => void;
  onSource: (source: Source) => void;
  onError: (error: Error | null) => void;
  onStatus?: (state: { isDirty: boolean; isSaving: boolean }) => void;
  scheduler?: Scheduler;
};

export class JsonPersister<T> {
  private revision: string | null = null;
  private lastPersistedJson: string;
  private pending: JsonSnapshot<T> | null = null;
  private loaded = false;
  private writing = false;
  private stopped = false;
  private localVersion = 0;
  private draining: Promise<void> | null = null;
  private operations = Promise.resolve<unknown>(undefined);
  private failure: Error | null = null;
  private invalid: Error | null = null;
  private lastLocalJson: string;
  private flushing: Promise<void> | null = null;
  private debounce: unknown;
  private maximumWait: unknown;
  private readonly scheduler: Scheduler;

  private status(): void { this.options.onStatus?.({ isDirty: this.pending !== null || this.writing || this.invalid !== null, isSaving: this.writing }); }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.cancelTimers();
    this.flushing = this.flushNow().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private async flushNow(): Promise<void> {
    const retry = this.stopped;
    await this.operations;
    if (this.invalid) throw this.invalid;
    if (this.stopped && !retry && this.failure) throw this.failure;
    if (!this.loaded) {
      if (!this.pending) return;
      throw this.failure ?? new Error("Document data has not loaded");
    }
    this.stopped = false;
    this.failure = null;
    this.requestDrain();
    while (this.draining) await this.draining;
    if (this.failure) throw this.failure;
  }

  constructor(private options: Options<T>) {
    this.lastPersistedJson = options.fallback.json;
    this.lastLocalJson = options.fallback.json;
    this.scheduler = options.scheduler ?? {
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
  }

  localChanged(json: string, value: T): void {
    if (!this.invalid && json === this.lastLocalJson) return;
    this.localVersion += 1;
    this.lastLocalJson = json;
    this.invalid = null;
    this.failure = null;

    // A write already in flight may change what is persisted, so a reversion to
    // the previously persisted value still has to remain queued until it lands.
    if (!this.writing && json === this.lastPersistedJson) {
      this.pending = null;
      this.cancelTimers();
      this.stopped = false;
      this.options.onError(null);
      this.status();
      return;
    }

    this.pending = { json, value };
    this.stopped = false;
    this.options.onError(null);
    this.status();
    this.scheduleDrain();
  }

  /** An unrepresentable local value must block older queued snapshots too. */
  localInvalid(error: Error): void {
    this.localVersion += 1;
    this.invalid = error;
    this.failure = error;
    this.pending = null;
    this.stopped = true;
    this.cancelTimers();
    this.options.onError(error);
    this.status();
  }

  reload(): Promise<void> {
    const wasLoaded = this.loaded;
    const requestedAtVersion = this.localVersion;

    // Once loaded, reload is an explicit escape hatch: discard edits that were
    // pending when it was requested. Mutations made after this call still win.
    if (wasLoaded) {
      this.pending = null;
      this.stopped = false;
      this.invalid = null;
      this.failure = null;
      this.cancelTimers();
    }

    return this.schedule(async () => {
      try {
        const result = wasLoaded
          ? await this.options.io.read()
          : await this.options.io.open(this.options.fallback.value);
        const persistedJson = JSON.stringify(result.value);
        this.loaded = true;
        this.revision = result.revision;
        this.lastPersistedJson = persistedJson;
        this.options.onRevision(result.revision);

        const changedDuringReload = this.localVersion !== requestedAtVersion;
        const local = !wasLoaded || changedDuringReload ? this.options.getLocal() : { json: persistedJson, value: result.value };
        const localWins = wasLoaded
          ? changedDuringReload && local.json !== persistedJson
          : local.json !== this.options.fallback.json;

        // A write that was already running can fail after reload was requested.
        // A successful read still recovers the store from that stopped state.
        this.stopped = false;
        this.failure = null;
        this.invalid = null;
        if (localWins) {
          this.pending = local;
          this.scheduleDrain();
        } else {
          this.pending = null;
          this.cancelTimers();
          this.adopt(result.value, result.revision, wasLoaded ? "external" : "package");
        }
        this.options.onError(null);
        this.status();
      } catch (error) {
        this.failure = this.asError(error);
        this.options.onError(this.failure);
        throw error;
      }
    });
  }

  externalChanged(eventRevision?: string | null): void {
    if (eventRevision && eventRevision === this.revision) return;
    if (!this.loaded || this.writing || this.pending || this.stopped) return;

    const requestedAtVersion = this.localVersion;
    void this.schedule(async () => {
      if (this.writing || this.pending || this.stopped) return;
      try {
        const result = await this.options.io.read();
        if (this.writing || this.pending || this.stopped || this.localVersion !== requestedAtVersion) return;
        this.adopt(result.value, result.revision, "external");
        this.options.onError(null);
      } catch (error) {
        this.options.onError(this.asError(error));
      }
    });
  }

  private cancelTimers(): void {
    if (this.debounce !== undefined) this.scheduler.clearTimeout(this.debounce);
    if (this.maximumWait !== undefined) this.scheduler.clearTimeout(this.maximumWait);
    this.debounce = this.maximumWait = undefined;
  }

  private scheduleDrain(): void {
    if (!this.loaded || this.stopped || !this.pending || this.draining) return;
    if (this.flushing) { this.requestDrain(); return; }
    const drain = () => { this.cancelTimers(); this.requestDrain(); };
    if (this.debounce !== undefined) this.scheduler.clearTimeout(this.debounce);
    this.debounce = this.scheduler.setTimeout(drain, 150);
    this.maximumWait ??= this.scheduler.setTimeout(drain, 1_000);
  }

  private requestDrain(): void {
    if (this.draining || !this.loaded || this.stopped || !this.pending) return;
    this.draining = this.schedule(() => this.drainLoop()).finally(() => {
      this.draining = null;
      this.status();
      if (this.loaded && this.pending && !this.stopped) this.requestDrain();
    });
  }

  private async drainLoop(): Promise<void> {
    if (!this.loaded || this.stopped) return;
    this.writing = true;
    this.status();
    let conflicts = 0;
    try {
      while (this.pending && !this.stopped) {
        const snapshot = this.pending;
        this.pending = null;

        if (snapshot.json === this.lastPersistedJson) {
          this.options.onError(null);
          continue;
        }

        try {
          const result = await this.options.io.write(snapshot.value, this.revision ?? "");
          this.revision = result.revision;
          this.lastPersistedJson = snapshot.json;
          this.options.onRevision(result.revision);
          this.options.onSource("app");
          if (!this.invalid) { this.options.onError(null); this.failure = null; }
          conflicts = 0;
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "revision_conflict" && conflicts++ === 0) {
            try {
              const result = await this.options.io.read();
              this.revision = result.revision;
              this.lastPersistedJson = JSON.stringify(result.value);
              this.options.onRevision(result.revision);
              this.pending ??= snapshot;
              continue;
            } catch (readError) {
              this.pending ??= snapshot;
              this.stopped = true;
              this.failure = this.asError(readError);
              this.options.onError(this.failure);
              continue;
            }
          }

          // Keep the newest full snapshot dirty. A later mutation replaces it
          // and re-arms persistence without losing any fields.
          this.pending ??= snapshot;
          this.stopped = true;
          this.failure = this.asError(error);
          this.options.onError(this.failure);
        }
      }
    } finally {
      this.writing = false;
      this.status();
    }
  }

  private adopt(value: T, revision: string, source: Source): void {
    this.revision = revision;
    this.lastPersistedJson = JSON.stringify(value);
    this.lastLocalJson = this.lastPersistedJson;
    this.options.onRevision(revision);
    this.options.onAdopt(value, source);
  }

  private schedule<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const scheduled = this.operations.then(operation, operation);
    this.operations = scheduled.catch(() => undefined);
    return scheduled;
  }

  private asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
