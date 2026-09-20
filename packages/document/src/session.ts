import type { ThemeController, ThemeValues } from "./theme-runtime";
import type { Document, Operation } from "./document";
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
    | "theme.reset";
  values?: ThemeValues;
  token?: string;
  op?: Operation;
  ops?: Operation[];
};
export type Reply = {
  ok: boolean;
  epoch: string;
  state?: unknown;
  schema?: unknown;
  error?: string;
};
/** A serialized command stream, not an exactly-once protocol. Never replay mutations. */
export class Session {
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  constructor(
    private doc: Document<any>,
    public readonly epoch: string,
    private theme?: ThemeController,
  ) {}
  handle(request: Request): Promise<Reply> {
    if (this.closing)
      return Promise.resolve({ ok: false, epoch: this.epoch, error: "Document is closing" });
    const task = this.queue
      .catch(() => {})
      .then(async (): Promise<Reply> => {
        try {
          if (typeof request.id !== "string" || !request.id || request.id.length > 128)
            throw new Error("Invalid request ID");
          if (request.method === "hello") return { ok: true, epoch: this.epoch };
          if (["theme.get", "theme.set", "theme.reset"].includes(request.method)) {
            if (!this.theme) throw new Error("Theme controls unavailable");
            if (request.method !== "theme.get" && request.epoch !== this.epoch)
              throw new Error("Session changed; inspect theme before retrying");
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
              throw new Error("Session changed; run slop get before issuing another edit");
            if (request.method === "batch") {
              if (!request.ops) throw new Error("Missing operations");
              this.doc.applyAll(request.ops);
            } else if (request.method === "apply") {
              if (!request.op) throw new Error("Missing operation");
              this.doc.apply(request.op);
            } else if (request.method !== "compact") throw new Error("Unknown method");
          }
          if (request.method === "compact") await this.doc.compact();
          else await this.doc.flush();
          return { ok: true, epoch: this.epoch, state: this.doc.current };
        } catch (error) {
          return { ok: false, epoch: this.epoch, error: String(error) };
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
