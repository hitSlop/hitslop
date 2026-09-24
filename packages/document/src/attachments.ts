import { base64, hostCall } from "./bridge";
import { OperationRejectedError } from "./errors";

export const attachmentLimits = { file: 10 * 1024 * 1024, total: 100 * 1024 * 1024, count: 256 } as const;
export type AttachmentInfo = { id: string; byteLength: number };
export type AttachmentRef = AttachmentInfo & { name: string; mimeType: string };
export interface AttachmentStore {
  put(bytes: Uint8Array): Promise<AttachmentInfo>;
  read(id: string): Promise<Uint8Array>;
  list(): Promise<AttachmentInfo[]>;
}
export const assertAttachmentID = (id: string) => {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid attachment ID");
};
const utf8Length = (text: string) => new TextEncoder().encode(text).length;
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
const checkSize = (size: number) => {
  if (size > attachmentLimits.file) throw new Error("Attachment exceeds 10 MiB");
};
export class MemoryAttachments implements AttachmentStore {
  private files = new Map<string, Uint8Array>();
  private total = 0;
  async put(bytes: Uint8Array) {
    checkSize(bytes.length);
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
    const id = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
    if (!this.files.has(id)) {
      if (this.files.size >= attachmentLimits.count || this.total + bytes.length > attachmentLimits.total)
        throw new OperationRejectedError("Document attachment limit reached (100 MiB or 256 files)");
      this.files.set(id, bytes.slice());
      this.total += bytes.length;
    }
    return { id, byteLength: bytes.length };
  }
  async read(id: string) {
    assertAttachmentID(id);
    const bytes = this.files.get(id);
    if (!bytes) throw new Error("Attachment not found");
    return bytes.slice();
  }
  async list() { return [...this.files].map(([id, bytes]) => ({ id, byteLength: bytes.length })); }
}
export class HostAttachments implements AttachmentStore {
  async put(bytes: Uint8Array): Promise<AttachmentInfo> {
    checkSize(bytes.length);
    return hostCall({ method: "attachments.put", bytes: base64.encode(bytes) });
  }
  async read(id: string) {
    assertAttachmentID(id);
    return base64.decode((await hostCall({ method: "attachments.read", attachmentID: id })).bytes);
  }
  async list(): Promise<AttachmentInfo[]> { return (await hostCall({ method: "attachments.list" })).files; }
}
type SaveParticipant = { stageSave(work: (commit: (callback: () => void) => void) => Promise<void>): Promise<void> };
export class AttachmentController {
  constructor(private document: SaveParticipant, readonly store: AttachmentStore) {}
  async import(file: File, options: { commit(ref: AttachmentRef): void }): Promise<AttachmentRef> {
    // Invalid input never enters the durable save/retry queue.
    checkSize(file.size);
    if (!file.name || utf8Length(file.name) > 255 || file.type.length > 255)
      throw new Error("Invalid attachment metadata");
    let ref: AttachmentRef;
    await this.document.stageSave(async commit => {
      const saved = await this.store.put(new Uint8Array(await file.arrayBuffer()));
      ref = { ...saved, name: file.name, mimeType: file.type || "application/octet-stream" };
      commit(() => {
        // The bytes are already durable, so an authored commit failure is final, never a save retry.
        let result: unknown;
        try { result = options.commit(ref); }
        catch (error) { throw new OperationRejectedError(`Attachment commit failed: ${messageOf(error)}`); }
        if (result && typeof (result as any).then === "function") {
          void Promise.resolve(result).catch(() => {});
          throw new OperationRejectedError("Attachment commit must be synchronous");
        }
      });
    });
    return ref!;
  }
  /** Pass the saved `mimeType` so object URLs for images and media resolve with the right type. */
  async read(id: string, options: { type?: string } = {}): Promise<Blob> {
    return new Blob([await this.store.read(id) as Uint8Array<ArrayBuffer>], { type: options.type ?? "" });
  }
  list() { return this.store.list(); }
}
let active: AttachmentController | undefined;
export function configureAttachments(document: SaveParticipant, native: boolean) {
  return active = new AttachmentController(document, native ? new HostAttachments() : new MemoryAttachments());
}
function current() {
  if (!active) throw new Error("Attachments require an open hitSlop document");
  return active;
}
/** The host installs one controller per document WebView, before mounting authored UI. */
export const attachments = {
  import: (file: File, options: { commit(ref: AttachmentRef): void }) => current().import(file, options),
  read: (id: string, options?: { type?: string }) => current().read(id, options),
  list: () => current().list(),
};
