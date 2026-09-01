import { slop } from "@hitslop/runtime";

export type FileStoreOptions = { accept?: string };

const safeName = (name: string): string => {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw new Error("File store names must use lowercase letters, numbers, and hyphens");
  return name;
};

const fileData = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error("Could not read that file"));
  reader.onload = () => {
    const value = String(reader.result ?? ""), comma = value.indexOf(",");
    if (comma < 0) reject(new Error("Could not read that file"));
    else resolve(value.slice(comma + 1));
  };
  reader.readAsDataURL(file);
});

export class FileStore {
  src = $state<string | null>(null);
  hasCustomFile = $state(false);
  isLoading = $state(true);
  error = $state<string | null>(null);
  revision = $state<string | null>(null);
  private unwatch: (() => void) | null = null;

  constructor(readonly name: string, readonly options: FileStoreOptions = {}) {
    safeName(name);
    void this.reload();
    this.unwatch = slop.media.onChange(() => { void this.reload(); });
  }

  choose(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = this.options.accept ?? "";
    input.hidden = true;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (file) void this.replace(file).catch(() => undefined);
    }, { once: true });
    document.body.append(input);
    input.click();
  }

  async replace(file: File): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const data = await fileData(file);
      const result = await slop.media.write(this.name, data, file.type || "application/octet-stream");
      this.adopt(true, result.revision);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      throw error;
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
      throw error;
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
    this.hasCustomFile = exists;
    this.revision = revision;
    this.src = exists ? `/media/${this.name}?revision=${encodeURIComponent(revision ?? "current")}` : null;
  }
}

export const fileStore = (name: string, options: FileStoreOptions = {}): FileStore => new FileStore(name, options);
