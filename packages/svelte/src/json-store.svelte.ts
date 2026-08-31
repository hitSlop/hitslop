import { slop } from "@hitslop/runtime";
import { JsonWriteQueue } from "./json-write-queue.js";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify($state.snapshot(value))) as T;
export class JsonStore<T> {
  current = $state() as T; isLoading = $state(true); error = $state<string | null>(null);
  revision = $state<string | null>(null); lastChangeSource = $state("package");
  private queue: JsonWriteQueue<T>; private unwatch: (() => void) | null = null;
  constructor(fallback: T) {
    this.current = clone(fallback);
    this.queue = new JsonWriteQueue({ fallback, clone, open: (initial) => slop.json.open(initial), read: () => slop.json.read<T>(), write: (value, revision) => slop.json.write(value, revision), onValue: (value) => { this.current = value; }, onRevision: (revision) => { this.revision = revision; }, onSource: (source) => { this.lastChangeSource = source; }, onError: (message) => { this.error = message; } });
    void this.reload(); this.unwatch = slop.json.onChange((event) => { if (event.revision !== this.queue.revision) void this.reload(); });
  }
  update(mutate: (value: T) => void): void { this.queue.enqueue(mutate); }
  async reload(): Promise<void> { this.isLoading = true; try { await this.queue.reload(); } catch (error) { this.error = error instanceof Error ? error.message : String(error); } finally { this.isLoading = false; } }
  destroy(): void { this.unwatch?.(); this.unwatch = null; }
}
export const jsonStore = <T>(initialValue: T): JsonStore<T> => new JsonStore(initialValue);
