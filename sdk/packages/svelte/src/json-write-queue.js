/** @template T */
export class JsonWriteQueue {
  /**
   * @param {{
   *   fallback: T,
   *   clone: (value: T) => T,
   *   read: () => Promise<{value: T | undefined, revision: string}>,
   *   write: (value: T, revision: string | undefined) => Promise<{revision: string}>,
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
    this.pending = [];
    this.draining = null;
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

  async reload() {
    await this.reloadPersisted();
    this.applyPending();
    this.options.onError(null);
  }

  async flush() {
    await this.drain();
  }

  drain() {
    if (!this.draining) {
      this.draining = this.drainLoop().finally(() => {
        this.draining = null;
      });
    }
    return this.draining;
  }

  async drainLoop() {
    while (this.pending.length > 0) {
      const mutate = this.pending[0];
      let retry = false;
      while (true) {
        const next = this.options.clone(this.persisted);
        mutate(next);
        try {
          const result = await this.options.write(next, this.revision ?? undefined);
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
            await this.reloadPersisted();
            this.applyPending();
            continue;
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
    this.persisted = snapshot.value === undefined
      ? this.options.clone(this.options.fallback)
      : this.options.clone(snapshot.value);
    this.revision = snapshot.value === undefined ? null : snapshot.revision;
    this.options.onRevision(this.revision);
  }

  applyPending() {
    const next = this.options.clone(this.persisted);
    for (const mutate of this.pending) mutate(next);
    this.options.onValue(next);
  }
}
