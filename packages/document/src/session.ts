import type { ThemeController, ThemeValues } from "./theme-runtime";
import type { Document, Operation } from "./document";
import type { AttachmentController } from "./attachments";
import { base64 } from "./bridge";
import { OperationRejectedError } from "./errors";
export type Request = {
  id: string;
  epoch?: string;
  documentPath: string;
  method:
    | "hello"
    | "get"
    | "schema"
    | "apply"
    | "batch"
    | "compact"
    | "theme.get"
    | "theme.set"
    | "theme.reset"
    | "attachments.put"
    | "attachments.read"
    | "attachments.list";
  bytes?: string;
  attachmentID?: string;
  values?: ThemeValues;
  token?: string;
  op?: Operation;
  ops?: Operation[];
};
/** Every code except "failed" means the request was not applied; "failed" means the outcome is unknown. */
export type ReplyCode = "rejected" | "session_changed" | "closing" | "failed";
export type Reply = {
  ok: boolean;
  epoch: string;
  state?: unknown;
  schema?: unknown;
  error?: string;
  code?: ReplyCode;
};
class SessionChangedError extends Error {}
/** A serialized command stream, not an exactly-once protocol. Never replay mutations. */
export class Session {
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  constructor(
    private doc: Document<any>,
    public readonly epoch: string,
    private theme?: ThemeController,
    private attachments?: AttachmentController,
  ) {}
  handle(request: Request): Promise<Reply> {
    if (this.closing)
      return Promise.resolve({ ok: false, epoch: this.epoch, error: "Document is closing", code: "closing" });
    const task = this.queue
      .catch(() => {})
      .then(async (): Promise<Reply> => {
        try {
          if (typeof request.id !== "string" || !request.id || request.id.length > 128)
            throw new OperationRejectedError("Invalid request ID");
          if (request.method === "hello") return { ok: true, epoch: this.epoch };
          await this.doc.flush();
          if (request.method.startsWith("attachments.")) {
            if (!this.attachments) throw new OperationRejectedError("Attachments unavailable");
            if (request.method === "attachments.put" && request.epoch !== this.epoch)
              throw new SessionChangedError("Session changed; inspect attachments before retrying");
            const state = request.method === "attachments.put"
              ? await this.attachments.store.put(base64.decode(request.bytes!))
              : request.method === "attachments.read"
                ? { bytes: base64.encode(await this.attachments.store.read(request.attachmentID!)) }
                : await this.attachments.list();
            return { ok: true, epoch: this.epoch, state };
          }
          if (["theme.get", "theme.set", "theme.reset"].includes(request.method)) {
            if (!this.theme) throw new OperationRejectedError("Theme controls unavailable");
            if (request.method !== "theme.get" && request.epoch !== this.epoch)
              throw new SessionChangedError("Session changed; inspect theme before retrying");
            await this.doc.flush();
            const state =
              request.method === "theme.get"
                ? this.theme.get()
                : request.method === "theme.set"
                  ? await this.theme.set(request.values!)
                  : await this.theme.reset(request.token);
            return { ok: true, epoch: this.epoch, state };
          }
          if (request.method === "schema")
            return { ok: true, epoch: this.epoch, schema: this.doc.definition.descriptor };
          if (request.method !== "get") {
            if (request.epoch !== this.epoch)
              throw new SessionChangedError("Session changed; run slop get before issuing another edit");
            if (request.method === "batch") {
              if (!request.ops) throw new OperationRejectedError("Missing operations");
              this.doc.applyAll(request.ops, { origin: "cli" });
            } else if (request.method === "apply") {
              if (!request.op) throw new OperationRejectedError("Missing operation");
              this.doc.apply(request.op, { origin: "cli" });
            } else if (request.method !== "compact") throw new OperationRejectedError("Unknown method");
          }
          if (request.method === "compact") await this.doc.compact();
          else await this.doc.flush();
          return { ok: true, epoch: this.epoch, state: this.doc.current };
        } catch (error) {
          const code: ReplyCode = error instanceof SessionChangedError ? "session_changed"
            : error instanceof OperationRejectedError ? "rejected" : "failed";
          return { ok: false, epoch: this.epoch, error: String(error), code };
        }
      });
    this.queue = task;
    return task;
  }
  async flush() {
    await this.queue;
    await this.doc.flush();
  }
  async prepareClose() {
    this.closing = true;
    await this.queue;
    try {
      await this.doc.prepareClose();
    } catch (error) {
      this.closing = false;
      throw error;
    }
  }
  cancelClose() {
    this.doc.cancelClose();
    this.closing = false;
  }
  async close() {
    await this.prepareClose();
    try {
      await this.doc.close();
    } catch (error) {
      this.cancelClose();
      throw error;
    }
  }
}
