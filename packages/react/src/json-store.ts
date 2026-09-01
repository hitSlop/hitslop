import { slop } from "@hitslop/runtime";
import { JsonPersister, type JsonSnapshot } from "@hitslop/runtime/adapter";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ExternalStore, errorMessage } from "./external-store.js";

type Source = "package" | "app" | "external";

type JsonState<T> = {
  /** Latest value. Treat it as immutable; change it through `set` or `update`. */
  value: T;
  isLoading: boolean;
  error: string | null;
  revision: string | null;
  lastChangeSource: Source;
};

export type JsonStore<T> = JsonState<T> & {
  /** Replace the whole value. */
  set: (value: T) => void;
  /** Clone the current value, mutate the clone, and persist the result. */
  update: (mutate: (draft: T) => void) => void;
  /** Discard pending edits and re-read the canonical store. */
  reload: () => Promise<void>;
};

const snapshot = <T>(value: T): JsonSnapshot<T> => {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error("JSON store values must be JSON-serializable");
  return { json, value: JSON.parse(json) as T };
};

/** Hook-independent core, exported for tests. Use `useJsonStore` in apps. */
export class JsonStoreCore<T> extends ExternalStore<JsonState<T>> {
  private local: JsonSnapshot<T>;
  private readonly persister: JsonPersister<T>;
  private loaded = false;

  constructor(initial: T) {
    const fallback = snapshot(initial);
    super({ value: fallback.value, isLoading: true, error: null, revision: null, lastChangeSource: "package" });
    this.local = fallback;
    this.persister = new JsonPersister<T>({
      fallback,
      io: {
        open: (value) => slop.json.open(value),
        read: () => slop.json.read<T>(),
        write: (value, revision) => slop.json.write(value, revision),
      },
      getLocal: () => this.local,
      onAdopt: (value, source) => {
        this.local = { json: JSON.stringify(value), value };
        this.patch({ value, lastChangeSource: source });
      },
      onRevision: (revision) => this.patch({ revision }),
      onSource: (source) => this.patch({ lastChangeSource: source }),
      onError: (error) => this.patch({ error }),
    });
  }

  /** Starts the initial load once and watches for external changes. */
  attach = (): (() => void) => {
    if (!this.loaded) { this.loaded = true; void this.reload(); }
    return slop.json.onChange((event) => this.persister.externalChanged(event.revision));
  };

  set = (value: T): void => {
    let local: JsonSnapshot<T>;
    try {
      local = snapshot(value);
    } catch (error) {
      this.patch({ error: errorMessage(error) });
      return;
    }
    this.local = local;
    this.patch({ value: local.value });
    this.persister.localChanged(local.json, local.value);
  };

  update = (mutate: (draft: T) => void): void => {
    const draft = snapshot(this.local.value).value;
    mutate(draft);
    this.set(draft);
  };

  reload = async (): Promise<void> => {
    this.patch({ isLoading: true });
    try {
      await this.persister.reload();
    } catch {
      // The persister already surfaced the failure through onError.
    } finally {
      this.patch({ isLoading: false });
    }
  };
}

export function useJsonStore<T>(initial: T): JsonStore<T> {
  const [store] = useState(() => new JsonStoreCore(initial));
  useEffect(() => store.attach(), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return useMemo(
    () => ({ ...state, set: store.set, update: store.update, reload: store.reload }),
    [state, store],
  );
}
