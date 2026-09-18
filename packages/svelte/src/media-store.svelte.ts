import { documentScope } from "./document-scope.js";
import { onDestroy, untrack } from "svelte";
import { slop } from "@hitslop/runtime";
import {
  chooseLocalFile,
  fileToBase64,
  LatestTask,
  registerFlush,
  type Mutations,
} from "@hitslop/runtime/adapter";
import {
  documentMeta,
  pathInfo,
  read,
  type Address,
  type MediaSchema,
  type MediaReference,
} from "@hitslop/schema/document";
import type { Result } from "@hitslop/schema/document-protocol";
import { registerDocumentWriter } from "./document-lifecycle.js";

export type MediaPath = Address<MediaSchema, true>;
export type MediaDocument = Pick<Mutations<Promise<Result>>, "set" | "unset"> & {
  readonly data: unknown;
  readonly authority: string | undefined;
  readonly canWrite: boolean;
};

/** A document reference plus a local view of immutable bytes. Never a second document owner. */
export class MediaStore<Fallback extends string | null> {
  src = $state<string | Fallback>();
  isLoading = $state(false);
  pending = $state(0);
  error = $state<string | null>(null);
  reference = $state.raw<Readonly<MediaReference>>();
  private readonly task = new LatestTask();
  private queue: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private disposed = false;
  private readonly unregister: () => void;
  private readonly unwatch: () => void;
  private readonly unwriter: () => void;

  constructor(
    private readonly document: MediaDocument,
    private readonly path: MediaPath,
    private readonly fallback: Fallback,
    private readonly kind: "image" | "file",
    private readonly accept: string,
  ) {
    if (!path[pathInfo].removable || documentMeta(path[pathInfo].schema)?.media !== true)
      throw new Error("Media stores require an optional S.Media() field");
    this.src = fallback;
    this.unregister = registerFlush("attachment", () => this.flush());
    this.unwriter = registerDocumentWriter(document, () => this.flush());
    this.unwatch = slop.media.onChange((event) => {
      if (!event.sha256 || event.sha256 === this.reference?.sha256) void this.reload();
    });
    let previousHash: string | undefined;
    $effect(() => {
      const reference = read(document.data, path);
      untrack(() => {
        this.reference = reference;
        if (previousHash !== reference?.sha256) void this.reload();
        previousHash = reference?.sha256;
      });
    });
    onDestroy(() => {
      void this.destroy();
    });
  }
  choose(): void {
    if (this.stopped || !this.document.canWrite) return;
    chooseLocalFile(this.accept, (file) => {
      void this.replace(file);
    });
  }
  private mutate(operation: () => Promise<Result>): Promise<Result> {
    if (this.stopped)
      return Promise.resolve({
        ok: false,
        error: { code: "closed", message: "Attachment store is closed" },
      });
    const authority = this.document.authority;
    this.pending++;
    const next = this.queue.then(async (): Promise<Result> => {
      try {
        this.error = null;
        if (!this.document.canWrite) throw new Error("Reconnect before editing this attachment");
        if (authority !== this.document.authority)
          throw new Error("Document authority changed; select the attachment again");
        const result = await operation();
        if (!result.ok) this.error = result.error.message;
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.error = message;
        documentScope(this.document).report({ source: "media", message });
        return { ok: false, error: { code: "storage_unavailable", message } };
      } finally {
        this.pending--;
      }
    });
    this.queue = next;
    return next;
  }
  replace(file: File): Promise<Result> {
    const authority = this.document.authority;
    return this.mutate(async () => {
      const descriptor = await slop.media.add(await fileToBase64(file), this.kind);
      if (authority !== this.document.authority || !this.document.canWrite)
        throw new Error("Document authority changed or disconnected; select the attachment again");
      return this.document.set(this.path, {
        ...descriptor,
        ...(file.name ? { filename: file.name.slice(0, 255) } : {}),
      });
    });
  }
  clear(): Promise<Result> {
    return this.mutate(() => this.document.unset(this.path));
  }
  async reload(): Promise<void> {
    if (this.disposed) return;
    const hash = this.reference?.sha256;
    this.task.invalidate();
    if (!hash) {
      this.src = this.fallback;
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    await this.task.run(
      () => slop.media.open(hash),
      (result) => {
        this.src = result.src ?? this.fallback;
        this.error = result.src ? null : "Attachment is not available yet. Reconnect or retry.";
        if (this.error)
          documentScope(this.document).report({ source: "media", message: this.error });
      },
      (error) => {
        this.src = this.fallback;
        this.error = error instanceof Error ? error.message : String(error);
        documentScope(this.document).report({ source: "media", message: this.error });
      },
      () => {
        this.isLoading = false;
      },
    );
  }
  async flush(): Promise<void> {
    await this.queue;
  }
  async destroy(): Promise<void> {
    if (this.disposed) return;
    this.stopped = true;
    await this.flush();
    this.disposed = true;
    this.task.dispose();
    this.unwatch();
    this.unregister();
    this.unwriter();
  }
}
