import { slop } from "@slop/runtime";
import { JsonWriteQueue } from "./json-write-queue.js";

function clone<T>(value: T): T {
  const plain = $state.snapshot(value) as T;
  return JSON.parse(JSON.stringify(plain)) as T;
}

export class JsonStore<T> {
  current = $state() as T;
  isLoading = $state(true);
  error = $state<string | null>(null);
  revision = $state<string | null>(null);
  lastChangeSource = $state("package");

  #storeID: string;
  #queue: JsonWriteQueue<T>;
  #unwatch: (() => void) | null = null;

  constructor(storeID: string, fallback: T) {
    this.#storeID = storeID;
    this.current = clone(fallback);
    this.#queue = new JsonWriteQueue<T>({
      fallback,
      clone,
      read: () => slop.jsonRead<T>(this.#storeID),
      write: (value, revision) => slop.jsonWrite(this.#storeID, value, revision),
      onValue: (value) => { this.current = value; },
      onRevision: (revision) => { this.revision = revision; },
      onSource: (source) => { this.lastChangeSource = source; },
      onError: (message) => { this.error = message; },
    });
    this.#start();
  }

  /**
   * Optimistically applies a synchronous mutation recipe and persists it.
   * Recipes may be replayed after loading or a revision conflict, so capture
   * timestamps, IDs, and other nondeterministic values before calling update.
   */
  update(mutate: (value: T) => void): void {
    this.#queue.enqueue(mutate);
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    try {
      await this.#queue.reload();
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
    this.#unwatch = slop.watch("json", this.#storeID, (event) => {
      if (event.source === "app" && event.revision === this.#queue.revision) return;
      this.lastChangeSource = event.source;
      void this.reload();
    });
  }

}

export function jsonStore<T>(storeID: string, fallback: T): JsonStore<T> {
  return new JsonStore(storeID, fallback);
}
