import { slop } from "@hitslop/runtime";
import { chooseLocalFile, fileToBase64, mediaSourceURL, safeMediaName } from "@hitslop/runtime/adapter";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ExternalStore, errorMessage } from "./external-store.js";

export type ImageStoreOptions = { fallback: string };

type ImageState = {
  src: string;
  hasCustomImage: boolean;
  isLoading: boolean;
  error: string | null;
  revision: string | null;
};

export type ImageStore = ImageState & {
  choose: () => void;
  replace: (file: File) => Promise<void>;
  remove: () => Promise<void>;
  reload: () => Promise<void>;
};

/** Hook-independent core, exported for tests. Use `useImageStore` in apps. */
export class ImageStoreCore extends ExternalStore<ImageState> {
  private readonly name: string;
  private readonly fallback: string;
  private loaded = false;

  constructor(name: string, options: ImageStoreOptions) {
    super({ src: options.fallback, hasCustomImage: false, isLoading: true, error: null, revision: null });
    this.name = safeMediaName(name, "Image");
    this.fallback = options.fallback;
  }

  attach = (): (() => void) => {
    if (!this.loaded) { this.loaded = true; void this.reload(); }
    return slop.media.onChange(() => { void this.reload(); });
  };

  choose = (): void => {
    chooseLocalFile("image/*", (file) => { void this.replace(file); });
  };

  replace = async (file: File): Promise<void> => {
    if (!file.type.startsWith("image/")) {
      this.patch({ error: "Choose an image file." });
      return;
    }
    this.patch({ isLoading: true, error: null });
    try {
      const data = await fileToBase64(file, "image");
      const result = await slop.media.write(this.name, data, file.type);
      this.adopt(true, result.revision);
    } catch (error) {
      this.patch({ error: errorMessage(error) });
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
      hasCustomImage: exists,
      revision,
      src: exists ? mediaSourceURL(this.name, revision) : this.fallback,
    });
  }
}

export function useImageStore(name: string, options: ImageStoreOptions): ImageStore {
  const [store] = useState(() => new ImageStoreCore(name, options));
  useEffect(() => store.attach(), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return useMemo(
    () => ({ ...state, choose: store.choose, replace: store.replace, remove: store.remove, reload: store.reload }),
    [state, store],
  );
}
