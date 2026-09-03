import { slop } from "@hitslop/runtime";
import { JsonPersister, type JsonSnapshot } from "@hitslop/runtime/adapter";
import { untrack } from "svelte";
import type * as z from "zod";

export type JsonStoreOptions<Schema extends z.ZodType> = {
  schema: Schema;
  initial: z.input<Schema>;
};

type JsonSchema<T> = {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> } };
};

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
  readonly schema: JsonSchema<T>;
  private unwatch: (() => void) | null = null;
  private stopEffect: (() => void) | null = null;

  constructor(options: { schema: JsonSchema<T>; initial: unknown }) {
    this.schema = options.schema;
    const fallbackSnapshot = snapshot(this.parse(options.initial));
    this.current = fallbackSnapshot.value;
    this.persister = new JsonPersister<T>({
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
    });

    // Snapshotting reads the complete proxy tree, so one effect run observes all
    // nested mutations. This intentionally favors small, document-sized JSON.
    // The root is not component-owned and must be released by destroy().
    this.stopEffect = $effect.root(() => {
      $effect(() => {
        let local: JsonSnapshot<T>;
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

  private parse(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const detail = result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "value";
      return `${path}: ${issue.message}`;
    }).join("; ");
    throw new Error(`JSON schema validation failed: ${detail}`);
  }
}

export const jsonStore = <Schema extends z.ZodType>(options: JsonStoreOptions<Schema>): JsonStore<z.output<Schema>> =>
  new JsonStore<z.output<Schema>>(options);
