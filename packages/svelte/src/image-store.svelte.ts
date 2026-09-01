import { slop } from "@hitslop/runtime";
import { chooseLocalFile, fileToBase64, mediaSourceURL, safeMediaName } from "@hitslop/runtime/adapter";

export type ImageStoreOptions = { fallback: string };

export class ImageStore {
  src = $state("");
  hasCustomImage = $state(false);
  isLoading = $state(true);
  error = $state<string | null>(null);
  revision = $state<string | null>(null);
  private unwatch: (() => void) | null = null;

  constructor(readonly name: string, readonly options: ImageStoreOptions) {
    safeMediaName(name, "Image");
    this.src = options.fallback;
    void this.reload();
    this.unwatch = slop.media.onChange(() => { void this.reload(); });
  }

  choose(): void {
    chooseLocalFile("image/*", (file) => { void this.replace(file); });
  }

  async replace(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) { this.error = "Choose an image file."; return; }
    this.isLoading = true;
    this.error = null;
    try {
      const data = await fileToBase64(file, "image");
      const result = await slop.media.write(this.name, data, file.type);
      this.adopt(true, result.revision);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.isLoading = false;
    }
  }

  async remove(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      await slop.media.remove(this.name);
      this.adopt(false, null);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.isLoading = false;
    }
  }

  async reload(): Promise<void> {
    this.isLoading = true;
    try {
      const result = await slop.media.open(this.name);
      this.adopt(result.exists, result.revision);
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.adopt(false, null);
    } finally {
      this.isLoading = false;
    }
  }

  destroy(): void {
    this.unwatch?.();
    this.unwatch = null;
  }

  private adopt(exists: boolean, revision: string | null): void {
    this.hasCustomImage = exists;
    this.revision = revision;
    this.src = exists ? mediaSourceURL(this.name, revision) : this.options.fallback;
  }
}

export const imageStore = (name: string, options: ImageStoreOptions): ImageStore => new ImageStore(name, options);
