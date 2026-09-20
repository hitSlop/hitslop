import type { Document, Operation } from "./document";
import { canonicalJSON } from "./schema";
export type Request = {
  id: string;
  schemaHash: string;
  epoch?: string;
  documentPath: string;
  method: "hello" | "get" | "schema" | "apply" | "batch" | "compact";
  op?: Operation;
  ops?: Operation[];
};
export type Reply = {
  ok: boolean;
  epoch: string;
  state?: unknown;
  schema?: unknown;
  error?: string;
  retryable?: boolean;
};
/** Receipts contain only intent and outcome, never historical document snapshots.
 * A bounded session epoch makes expired retries fail, rather than execute again. */
export class Session {
  private queue: Promise<unknown> = Promise.resolve();
  private receipts = new Map<string, { body: string; durable: boolean; error?: string }>();
  private closing = false;
  private expires = Date.now() + 600_000;
  constructor(
    private doc: Document<any>,
    public epoch: string,
  ) {}
  handle(request: Request): Promise<Reply> {
    if (this.closing)
      return Promise.resolve({ ok: false, epoch: this.epoch, error: "Document is closing" });
    const task = this.queue
      .catch(() => {})
      .then(async (): Promise<Reply> => {
        let retryable = false;
        try {
          if (
            typeof request.id !== "string" ||
            !request.id ||
            request.id.length > 128 ||
            request.schemaHash !== this.doc.key
          )
            throw new Error("schema/id mismatch");
          if (request.method === "hello") return { ok: true, epoch: this.epoch };
          if (request.method === "get" || request.method === "schema")
            return {
              ok: true,
              epoch: this.epoch,
              state: this.doc.current,
              ...(request.method === "schema" ? { schema: this.doc.definition.descriptor } : {}),
            };
          if (request.epoch !== this.epoch)
            throw new Error("Session epoch changed; inspect state before issuing a new command");
          const body = canonicalJSON(request),
            old = this.receipts.get(request.id);
          if (old) {
            if (old.body !== body) throw new Error("Request ID reused for a different command");
            if (old.error) throw new Error(old.error);
            if (!old.durable) {
              retryable = true;
              if (request.method === "compact") await this.doc.compact();
              else await this.doc.flush();
              for (const receipt of this.receipts.values())
                if (!receipt.error) receipt.durable = true;
            }
            return { ok: true, epoch: this.epoch, state: this.doc.current };
          }
          if (this.receipts.size >= 256 || Date.now() >= this.expires) {
            if ([...this.receipts.values()].some((r) => !r.durable && !r.error))
              throw new Error("Retry the pending save before starting a new retry window");
            this.receipts.clear();
            this.epoch = crypto.randomUUID();
            this.expires = Date.now() + 600_000;
            throw new Error("Retry window expired; inspect state before issuing a new command");
          }
          const receipt = { body, durable: false, error: undefined as string | undefined };
          try {
            if (request.method === "batch") {
              if (!request.ops) throw new Error("Missing operations");
              this.doc.applyAll(request.ops);
            } else if (request.method === "apply") {
              if (!request.op) throw new Error("Missing operation");
              this.doc.apply(request.op);
            } else if (request.method !== "compact") throw new Error("Unknown method");
          } catch (error) {
            receipt.error = String(error);
            this.receipts.set(request.id, receipt);
            throw error;
          }
          this.receipts.set(request.id, receipt);
          retryable = true;
          if (request.method === "compact") await this.doc.compact();
          else await this.doc.flush();
          for (const saved of this.receipts.values()) if (!saved.error) saved.durable = true;
          return { ok: true, epoch: this.epoch, state: this.doc.current };
        } catch (error) {
          return { ok: false, epoch: this.epoch, error: String(error), retryable };
        }
      });
    this.queue = task;
    return task;
  }
  async flush() {
    await this.queue;
    await this.doc.flush();
    for (const receipt of this.receipts.values()) if (!receipt.error) receipt.durable = true;
  }
  async close() {
    this.closing = true;
    await this.queue;
    try {
      await this.doc.close();
    } catch (error) {
      this.closing = false;
      throw error;
    }
  }
}
