import { slop } from "@hitslop/runtime";
import { JsonPersister, type JsonSnapshot } from "@hitslop/runtime/adapter";
import { untrack } from "svelte";

const snapshot = <T>(value: T): JsonSnapshot<T> => {
  const json = JSON.stringify($state.snapshot(value));
  if (json === undefined) throw new Error("JsonStore values must be JSON-serializable");
  return { json, value: JSON.parse(json) as T };
};

export class JsonStore<T> {
  current = $state() as T;
  isLoading = $state(true);
  error = $state<string | null>(null);
  revision = $state<string | null>(null);
  lastChangeSource = $state("package");
  private persister: JsonPersister<T>;
  private unwatch: (() => void) | null = null;
  private stopEffect: (() => void) | null = null;

  constructor(fallback: T) {
    const fallbackSnapshot = snapshot(fallback);
    this.current = fallbackSnapshot.value;
    this.persister = new JsonPersister<T>({
      fallback: fallbackSnapshot,
      io: {
        open: (initial) => slop.json.open(initial),
        read: () => slop.json.read<T>(),
        write: (value, revision) => slop.json.write(value, revision),
      },
      getLocal: () => snapshot(this.current),
      onAdopt: (value, source) => { this.current = value; this.lastChangeSource = source; },
      onRevision: (revision) => { this.revision = revision; },
      onSource: (source) => { this.lastChangeSource = source; },
      onError: (message) => { this.error = message; },
    });

    // Snapshotting reads the complete proxy tree, so one effect run observes all
    // nested mutations. This intentionally favors small, document-sized JSON.
    // The root is not component-owned and must be released by destroy().
    this.stopEffect = $effect.root(() => {
      $effect(() => {
        let local: JsonSnapshot<T>;
        try {
          local = snapshot(this.current);
        } catch (error) {
          untrack(() => { this.error = error instanceof Error ? error.message : String(error); });
          return;
        }
        untrack(() => this.persister.localChanged(local.json, local.value));
      });
    });

    void this.reload();
    this.unwatch = slop.json.onChange((event) => this.persister.externalChanged(event.revision));
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    try {
      await this.persister.reload();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.isLoading = false;
    }
  }

  destroy(): void {
    this.unwatch?.();
    this.unwatch = null;
    this.stopEffect?.();
    this.stopEffect = null;
  }
}

export const jsonStore = <T>(initialValue: T): JsonStore<T> => new JsonStore(initialValue);
