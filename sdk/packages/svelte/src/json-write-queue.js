/** @template T */
export class JsonWriteQueue {
  /**
   * @param {{
   *   fallback: T,
   *   clone: (value: T) => T,
   *   read: () => Promise<{value: T, revision: string}>,
   *   write: (value: T, revision: string) => Promise<{revision: string}>,
   *   onValue: (value: T) => void,
   *   onRevision: (revision: string | null) => void,
   *   onSource: (source: string) => void,
   *   onError: (message: string | null) => void
   * }} options
   */
  constructor(options) {
    this.options = options;
    this.persisted = options.clone(options.fallback);
    this.revision = null;
    this.loaded = false;
    this.pending = [];
    this.draining = null;
    this.operations = Promise.resolve();
    options.onValue(options.clone(this.persisted));
  }

  /** @param {(value: T) => void} mutate */
  enqueue(mutate) {
    this.pending.push(mutate);
    try {
      this.applyPending();
      void this.drain();
    } catch (error) {
      this.pending.pop();
      this.applyPending();
      this.options.onError(error instanceof Error ? error.message : String(error));
    }
  }

  reload() {
    const reloading = this.schedule(async () => {
      await this.reloadPersisted();
      this.loaded = true;
      this.applyPending();
      this.options.onError(null);
    });
    return reloading.then(() => {
      if (this.pending.length > 0) void this.drain();
    });
  }

  async flush() {
    await this.drain();
  }

  drain() {
    if (!this.draining) {
      this.draining = this.schedule(() => this.drainLoop()).finally(() => {
        this.draining = null;
      });
    }
    return this.draining;
  }

  async drainLoop() {
    if (!this.loaded) {
      try {
        await this.reloadPersisted();
        this.loaded = true;
        this.applyPending();
        this.options.onError(null);
      } catch (error) {
        this.options.onError(error instanceof Error ? error.message : String(error));
        return;
      }
    }

    while (this.pending.length > 0) {
      const mutate = this.pending[0];
      let retry = false;
      while (true) {
        const next = this.options.clone(this.persisted);
        try {
          mutate(next);
        } catch (error) {
          this.pending.shift();
          this.options.onError(error instanceof Error ? error.message : String(error));
          this.applyPending();
          break;
        }
        try {
          const result = await this.options.write(next, this.revision);
          this.persisted = next;
          this.revision = result.revision;
          this.options.onRevision(this.revision);
          this.pending.shift();
          this.options.onSource("app");
          this.options.onError(null);
          this.applyPending();
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!retry && message.includes("revision_conflict")) {
            retry = true;
            try {
              await this.reloadPersisted();
              this.applyPending();
              continue;
            } catch (reloadError) {
              this.options.onError(
                reloadError instanceof Error ? reloadError.message : String(reloadError),
              );
              return;
            }
          }
          this.pending.shift();
          this.options.onError(message);
          this.applyPending();
          break;
        }
      }
    }
  }

  async reloadPersisted() {
    const snapshot = await this.options.read();
    this.persisted = this.options.clone(snapshot.value);
    this.revision = snapshot.revision;
    this.options.onRevision(this.revision);
  }

  schedule(operation) {
    const scheduled = this.operations.then(operation, operation);
    this.operations = scheduled.catch(() => {});
    return scheduled;
  }

  applyPending() {
    const next = this.options.clone(this.persisted);
    for (const mutate of this.pending) mutate(next);
    this.options.onValue(next);
  }
}
