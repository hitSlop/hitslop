import { slop } from "@hitslop/runtime";

export type ImageStoreOptions = { fallback: string };

const safeName = (name: string): string => {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw new Error("Image store names must use lowercase letters, numbers, and hyphens");
  return name;
};

const fileData = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error("Could not read that image"));
  reader.onload = () => {
    const value = String(reader.result ?? ""), comma = value.indexOf(",");
    if (comma < 0) reject(new Error("Could not read that image"));
    else resolve(value.slice(comma + 1));
  };
  reader.readAsDataURL(file);
});

export class ImageStore {
  src = $state("");
  hasCustomImage = $state(false);
  isLoading = $state(true);
  error = $state<string | null>(null);
  revision = $state<string | null>(null);
  private unwatch: (() => void) | null = null;

  constructor(readonly name: string, readonly options: ImageStoreOptions) {
    safeName(name);
    this.src = options.fallback;
    void this.reload();
    this.unwatch = slop.media.onChange(() => { void this.reload(); });
  }

  choose(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (file) void this.replace(file);
    }, { once: true });
    document.body.append(input);
    input.click();
  }

  async replace(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) { this.error = "Choose an image file."; return; }
    this.isLoading = true;
    this.error = null;
    try {
      const data = await fileData(file);
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
    this.src = exists ? `/media/${this.name}?revision=${encodeURIComponent(revision ?? "current")}` : this.options.fallback;
  }
}

export const imageStore = (name: string, options: ImageStoreOptions): ImageStore => new ImageStore(name, options);
