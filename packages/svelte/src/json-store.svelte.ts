import { slop, SlopError } from "@hitslop/runtime";
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
  try {
    const detached = $state.snapshot(value);
    assertJSON(detached);
    return { json: JSON.stringify(detached), value: detached as T };
  } catch (error) {
    throw new SlopError("validation_failed", error instanceof Error ? error.message : String(error));
  }
};

export class JsonStore<S extends TSchema> {
  current = $state() as Static<S>;
  isLoading = $state(true);
  isReady = $state(false);
  isDirty = $state(false);
  isSaving = $state(false);
  error = $state<string | null>(null);
  errorCode = $state<SlopError["code"] | null>(null);
  revision = $state<string | null>(null);
  lastChangeSource = $state("package");
  private persister: JsonPersister<Static<S>>;
  readonly schema: S;
  private unwatch: (() => void) | null = null;
  private stopEffect: (() => void) | null = null;
  private unregisterFlush: (() => void) | null = null;
  private destroyed = false;
  private finalSnapshot: JsonSnapshot<Static<S>> | null = null;
  private finalError: Error | null = null;

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
        write: (value, revision) => slop.json.write(this.parse(value, false), revision),
      },
      getLocal: () => this.getLocal(),
      onAdopt: (value, source) => {
        this.current = value; this.lastChangeSource = source;
        if (this.destroyed) this.finalSnapshot = snapshot(value);
      },
      onRevision: (revision) => { this.revision = revision; },
      onSource: (source) => { this.lastChangeSource = source; },
      onError: (error) => this.setError(error),
      onStatus: ({ isDirty, isSaving }) => { this.isDirty = isDirty; this.isSaving = isSaving; },
    });

    // Snapshotting reads the complete proxy tree, so one effect run observes all
    // nested mutations. This intentionally favors small, document-sized JSON.
    // The root is not component-owned and must be released by destroy().
    this.stopEffect = $effect.root(() => {
      $effect(() => {
        let local: JsonSnapshot<Static<S>>;
        try {
          local = snapshot(this.current);
        } catch (error) {
          untrack(() => this.persister.localInvalid(error as Error));
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
    if (this.destroyed) throw new SlopError("closed", "JSON store is destroyed");
    this.isLoading = true;
    try {
      await this.persister.reload();
      this.isReady = true;
    } catch (error) {
      this.setError(error);
    } finally {
      this.isLoading = false;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    try { this.finalSnapshot = snapshot(this.current); }
    catch (error) { this.finalError = error as Error; }
    this.destroyed = true;
    this.unwatch?.();
    this.unwatch = null;
    this.stopEffect?.();
    this.stopEffect = null;
    // Keep failed writes registered so the host barrier can report/retry them.
    void this.flush().catch(() => undefined);
  }

  async flush(): Promise<void> {
    try {
      let local: JsonSnapshot<Static<S>>;
      try { local = this.getLocal(); }
      catch (error) { this.persister.localInvalid(error as Error); throw error; }
      this.persister.localChanged(local.json, local.value);
      await this.persister.flush();
      if (this.destroyed) {
        this.unregisterFlush?.();
        this.unregisterFlush = null;
      }
    } catch (error) { this.setError(error); throw error; }
  }

  private getLocal(): JsonSnapshot<Static<S>> {
    if (this.finalError) throw this.finalError;
    return this.finalSnapshot ?? snapshot(this.current);
  }

  private setError(error: unknown): void {
    this.error = error == null ? null : error instanceof Error ? error.message : String(error);
    this.errorCode = error instanceof SlopError ? error.code : null;
  }

  private parse(value: unknown, checkJSON = true): Static<S> {
    try {
      if (checkJSON) assertJSON(value);
      return validate(this.schema, value);
    } catch (error) {
      throw new SlopError("validation_failed", error instanceof Error ? error.message : String(error));
    }
  }
}

export function jsonStore<S extends TSchema>(options: JsonStoreOptions<S>): JsonStore<S> {
  return new JsonStore(options);
}
