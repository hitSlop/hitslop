export type JsonSnapshot<T> = { json: string; value: T };

type Source = "package" | "app" | "external";
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
  onError: (message: string | null) => void;
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

  constructor(private options: Options<T>) {
    this.lastPersistedJson = options.fallback.json;
  }

  localChanged(json: string, value: T): void {
    this.localVersion += 1;

    // A write already in flight may change what is persisted, so a reversion to
    // the previously persisted value still has to remain queued until it lands.
    if (!this.writing && json === this.lastPersistedJson) {
      this.pending = null;
      this.stopped = false;
      this.options.onError(null);
      return;
    }

    this.pending = { json, value };
    this.stopped = false;
    this.requestDrain();
  }

  reload(): Promise<void> {
    const wasLoaded = this.loaded;
    const requestedAtVersion = this.localVersion;

    // Once loaded, reload is an explicit escape hatch: discard edits that were
    // pending when it was requested. Mutations made after this call still win.
    if (wasLoaded) {
      this.pending = null;
      this.stopped = false;
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

        const local = this.options.getLocal();
        const changedDuringReload = this.localVersion !== requestedAtVersion;
        const localWins = wasLoaded
          ? changedDuringReload && local.json !== persistedJson
          : local.json !== this.options.fallback.json;

        if (localWins) {
          this.pending = local;
          this.requestDrain();
        } else {
          this.pending = null;
          this.adopt(result.value, result.revision, wasLoaded ? "external" : "package");
        }
        this.options.onError(null);
      } catch (error) {
        const message = this.message(error);
        this.options.onError(message);
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
        this.options.onError(this.message(error));
      }
    });
  }

  private requestDrain(): void {
    if (this.draining || !this.loaded || this.stopped || !this.pending) return;
    this.draining = this.schedule(() => this.drainLoop()).finally(() => {
      this.draining = null;
      if (this.loaded && this.pending && !this.stopped) this.requestDrain();
    });
  }

  private async drainLoop(): Promise<void> {
    if (!this.loaded || this.stopped) return;
    this.writing = true;
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
          this.options.onError(null);
        } catch (error) {
          if (this.message(error).includes("revision_conflict")) {
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
              this.options.onError(this.message(readError));
              continue;
            }
          }

          // Keep the newest full snapshot dirty. A later mutation replaces it
          // and re-arms persistence without losing any fields.
          this.pending ??= snapshot;
          this.stopped = true;
          this.options.onError(this.message(error));
        }
      }
    } finally {
      this.writing = false;
    }
  }

  private adopt(value: T, revision: string, source: Source): void {
    this.revision = revision;
    this.lastPersistedJson = JSON.stringify(value);
    this.options.onRevision(revision);
    this.options.onAdopt(value, source);
  }

  private schedule<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    const scheduled = this.operations.then(operation, operation);
    this.operations = scheduled.catch(() => undefined);
    return scheduled;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
