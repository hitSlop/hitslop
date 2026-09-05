import { slop } from "@hitslop/runtime";
import { JsonPersister, registerFlush, type JsonSnapshot } from "@hitslop/runtime/adapter";
import { untrack } from "svelte";
import type { Static, TSchema } from "typebox";
import { validate } from "@hitslop/schema/validation";
import { assertJSON } from "@hitslop/schema/json";

export type JsonStoreOptions<S extends TSchema> = {
  schema: S;
  initial: NoInfer<Static<S>>;
};

const snapshot = <T>(value: T): JsonSnapshot<T> => {
  const detached = $state.snapshot(value);
  assertJSON(detached);
  const json = JSON.stringify(detached);
  return { json, value: JSON.parse(json) as T };
};

export class JsonStore<S extends TSchema> {
  current = $state() as Static<S>;
  isLoading = $state(true);
  isReady = $state(false);
  isDirty = $state(false);
  isSaving = $state(false);
  error = $state<string | null>(null);
  revision = $state<string | null>(null);
  lastChangeSource = $state("package");
  private persister: JsonPersister<Static<S>>;
  readonly schema: S;
  private unwatch: (() => void) | null = null;
  private stopEffect: (() => void) | null = null;
  private unregisterFlush: (() => void) | null = null;

  constructor(options: JsonStoreOptions<S>) {
    this.schema = options.schema;
    const fallbackSnapshot = snapshot(this.parse(options.initial));
    this.current = fallbackSnapshot.value;
    this.persister = new JsonPersister<Static<S>>({
      fallback: fallbackSnapshot,
      io: {
        open: async (initial) => {
          const result = await slop.json.open(initial);
          return { ...result, value: this.parse(result.value) };
        },
        read: async () => {
          const result = await slop.json.read<unknown>();
          return { ...result, value: this.parse(result.value) };
        },
        write: (value, revision) => slop.json.write(this.parse(value), revision),
      },
      getLocal: () => snapshot(this.parse(this.current)),
      onAdopt: (value, source) => { this.current = value; this.lastChangeSource = source; },
      onRevision: (revision) => { this.revision = revision; },
      onSource: (source) => { this.lastChangeSource = source; },
      onError: (message) => { this.error = message; },
      onStatus: ({ isDirty, isSaving }) => { this.isDirty = isDirty; this.isSaving = isSaving; },
    });

    // Snapshotting reads the complete proxy tree, so one effect run observes all
    // nested mutations. This intentionally favors small, document-sized JSON.
    // The root is not component-owned and must be released by destroy().
    this.stopEffect = $effect.root(() => {
      $effect(() => {
        let local: JsonSnapshot<Static<S>>;
        try {
          local = snapshot(this.parse(this.current));
        } catch (error) {
          untrack(() => { this.error = error instanceof Error ? error.message : String(error); });
          return;
        }
        untrack(() => this.persister.localChanged(local.json, local.value));
      });
    });

    void this.reload();
    this.unregisterFlush = registerFlush(() => this.flush());
    this.unwatch = slop.json.onChange((event) => this.persister.externalChanged(event.revision));
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    try {
      await this.persister.reload();
      this.isReady = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.isLoading = false;
    }
  }

  destroy(): void {
    if (!this.isLoading) void this.flush().catch(() => undefined);
    this.unregisterFlush?.();
    this.unregisterFlush = null;
    this.unwatch?.();
    this.unwatch = null;
    this.stopEffect?.();
    this.stopEffect = null;
  }

  async flush(): Promise<void> {
    const local = snapshot(this.parse(this.current));
    this.persister.localChanged(local.json, local.value);
    await this.persister.flush();
  }

  private parse(value: unknown): Static<S> {
    assertJSON(value);
    return validate(this.schema, value);
  }
}

export function jsonStore<S extends TSchema>(options: JsonStoreOptions<S>): JsonStore<S> {
  return new JsonStore(options);
}
