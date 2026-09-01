import { slop } from "@hitslop/runtime";
import { chooseLocalFile, fileToBase64, mediaSourceURL, safeMediaName } from "@hitslop/runtime/adapter";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ExternalStore, errorMessage } from "./external-store.js";

export type FileStoreOptions = { accept?: string };

type FileState = {
  src: string | null;
  hasCustomFile: boolean;
  isLoading: boolean;
  error: string | null;
  revision: string | null;
};

export type FileStore = FileState & {
  choose: () => void;
  replace: (file: File) => Promise<void>;
  remove: () => Promise<void>;
  reload: () => Promise<void>;
};

/** Hook-independent core, exported for tests. Use `useFileStore` in apps. */
export class FileStoreCore extends ExternalStore<FileState> {
  private readonly name: string;
  private readonly accept: string;
  private loaded = false;

  constructor(name: string, options: FileStoreOptions = {}) {
    super({ src: null, hasCustomFile: false, isLoading: true, error: null, revision: null });
    this.name = safeMediaName(name, "File");
    this.accept = options.accept ?? "";
  }

  attach = (): (() => void) => {
    if (!this.loaded) { this.loaded = true; void this.reload(); }
    return slop.media.onChange(() => { void this.reload(); });
  };

  choose = (): void => {
    chooseLocalFile(this.accept, (file) => { void this.replace(file).catch(() => undefined); });
  };

  replace = async (file: File): Promise<void> => {
    this.patch({ isLoading: true, error: null });
    try {
      const data = await fileToBase64(file);
      const result = await slop.media.write(this.name, data, file.type || "application/octet-stream");
      this.adopt(true, result.revision);
    } catch (error) {
      this.patch({ error: errorMessage(error) });
      throw error;
    } finally {
      this.patch({ isLoading: false });
    }
  };

  remove = async (): Promise<void> => {
    this.patch({ isLoading: true, error: null });
    try {
      await slop.media.remove(this.name);
      this.adopt(false, null);
    } catch (error) {
      this.patch({ error: errorMessage(error) });
      throw error;
    } finally {
      this.patch({ isLoading: false });
    }
  };

  reload = async (): Promise<void> => {
    this.patch({ isLoading: true });
    try {
      const result = await slop.media.open(this.name);
      this.adopt(result.exists, result.revision);
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: errorMessage(error) });
      this.adopt(false, null);
    } finally {
      this.patch({ isLoading: false });
    }
  };

  private adopt(exists: boolean, revision: string | null): void {
    this.patch({
      hasCustomFile: exists,
      revision,
      src: exists ? mediaSourceURL(this.name, revision) : null,
    });
  }
}

export function useFileStore(name: string, options: FileStoreOptions = {}): FileStore {
  const [store] = useState(() => new FileStoreCore(name, options));
  useEffect(() => store.attach(), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return useMemo(
    () => ({ ...state, choose: store.choose, replace: store.replace, remove: store.remove, reload: store.reload }),
    [state, store],
  );
}
