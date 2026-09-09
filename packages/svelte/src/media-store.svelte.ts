import { slop } from "@hitslop/runtime";
import { chooseLocalFile, fileToBase64, LatestTask, mediaSourceURL, registerFlush, safeMediaName } from "@hitslop/runtime/adapter";

/** Shared lifecycle for named files and images; subclasses only supply policy. */
export class MediaStore<Fallback extends string | null> {
  src = $state<string | Fallback>();
  hasCustomMedia = $state(false);
  isLoading = $state(true);
  error = $state<string | null>(null);
  revision = $state<string | null>(null);
  private readonly task = new LatestTask();
  private readonly unwatch: () => void;
  private mutations = Promise.resolve();
  private disposed = false;
  private failure: unknown;
  private readonly unregisterFlush: () => void;

  constructor(readonly name: string, private readonly fallback: Fallback, private readonly accept: string) {
    safeMediaName(name);
    this.src = fallback;
    this.unregisterFlush = registerFlush(() => this.flush());
    this.unwatch = slop.media.onChange((event) => { if (!event.name || event.name === name) void this.reload(); });
    void this.reload();
  }
  choose(): void { chooseLocalFile(this.accept, (file) => { void this.replace(file).catch(() => undefined); }); }
  async replace(file: File): Promise<void> {
    if (this.accept === "image/*" && !file.type.startsWith("image/")) {
      this.error = "Choose an image file.";
      throw new Error(this.error);
    }
    await this.mutate(async () => {
      const data = await fileToBase64(file);
      const result = await slop.media.write(this.name, data, file.type || "application/octet-stream");
      return { exists: true, revision: result.revision };
    });
  }
  async remove(): Promise<void> {
    await this.mutate(async () => { await slop.media.remove(this.name); return { exists: false, revision: null }; });
  }
  private async mutate(operation: () => Promise<{ exists: boolean; revision: string | null }>): Promise<void> {
    if (this.disposed) throw new Error("Media store is closed.");
    this.task.invalidate();
    this.isLoading = true;
    this.error = null;
    const mutation = this.mutations.then(async () => { await operation(); this.failure = undefined; });
    this.mutations = mutation.catch(() => undefined);
    try { await mutation; await this.reload(); }
    catch (error) { this.failure = error; if (!this.disposed) { this.error = error instanceof Error ? error.message : String(error); this.isLoading = false; } throw error; }
  }
  async flush(): Promise<void> { await this.mutations; if (this.failure) throw this.failure; }
  async reload(): Promise<void> {
    if (this.disposed) return;
    this.isLoading = true;
    await this.task.run(() => slop.media.open(this.name), (result) => {
      this.hasCustomMedia = result.exists;
      this.revision = result.revision;
      this.src = result.exists ? mediaSourceURL(this.name, result.revision) : this.fallback;
      this.error = null;
    }, (error) => { this.error = error instanceof Error ? error.message : String(error); }, () => { this.isLoading = false; });
  }
  destroy(): void { this.disposed = true; this.task.dispose(); this.unwatch(); this.unregisterFlush(); }
}
