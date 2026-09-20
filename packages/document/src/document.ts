import { createHandles, type Handle } from "./handles";
import { OperationRejectedError } from "./errors";
import { LoroDoc } from "loro-crdt";
import {
  schemaKey,
  validate,
  type Definition,
  type ObjectNode,
  type Value,
  type Input,
} from "./schema.ts";
import type { ByteStore } from "./storage.ts";
import { Commands, applyOperation, fill, project, type Operation } from "./operations";
export type { Operation, Destination } from "./operations";
export type SaveStatus = "saved" | "saving" | "save-failed";
export class Document<N extends ObjectNode> extends Commands {
  private engine = new LoroDoc();
  private pending: Uint8Array[] = [];
  private generation = "0";
  private logRows = 0;
  private logBytes = 0;
  private drafts = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private stop?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private closing = false;
  private snapshot!: Value<N>;
  status: SaveStatus = "saved";
  error: string | null = null;
  readonly key: string;
  readonly fields: Handle<N>;
  private constructor(
    readonly definition: Definition<N>,
    private storage: ByteStore,
  ) {
    super((op) => this.apply(op));
    this.key = schemaKey(definition.descriptor);
    this.fields = createHandles(definition.fields.node, this, {
      subscribe: (listener) => this.subscribe(listener),
      beforeFlush: (draft) => {
        this.drafts.add(draft);
        return () => this.drafts.delete(draft);
      },
      read: (path) => {
        if (this.closed) return undefined;
        let value: any = this.current;
        for (const part of path)
          value =
            typeof part === "string"
              ? value?.[part]
              : value?.find((row: any) => row.$id === part.id);
        return typeof value === "string" ? value : undefined;
      },
    });
  }
  static async open<N extends ObjectNode>(
    definition: Definition<N>,
    storage: ByteStore,
    initial: Input<N>,
  ): Promise<Document<N>> {
    const doc = new Document(definition, storage);
    try {
      const stored = await storage.load();
      doc.generation = stored.generation;
      doc.logRows = stored.updates.length;
      doc.logBytes = stored.updates.reduce((n, b) => n + b.length, 0);
      if (stored.schemaKey !== null && stored.schemaKey !== doc.key)
        throw new Error("Incompatible document schema");
      if (!stored.checkpoint && stored.updates.length)
        throw new Error("Missing document checkpoint");
      if (stored.checkpoint) {
        doc.engine.import(stored.checkpoint);
        if (stored.updates.length) {
          const result = doc.engine.importBatch(stored.updates);
          if (result.pending?.size) throw new Error("Incomplete update history");
        }
        validate(definition.descriptor.root, doc.engine.getMap("data").toJSON());
      } else {
        validate(definition.descriptor.root, initial);
        fill(doc.engine.getMap("data"), definition.descriptor.root, initial);
        doc.engine.commit();
        doc.generation = await storage.checkpoint(
          doc.generation,
          doc.engine.export({ mode: "snapshot" }),
          doc.key,
        );
      }
      doc.snapshot = project(definition.descriptor.root, doc.engine.getMap("data")) as Value<N>;
      doc.stop = doc.engine.subscribeLocalUpdates((bytes) => {
        doc.pending.push(bytes.slice());
      });
      return doc;
    } catch (error) {
      doc.engine.free();
      await storage.close();
      throw error;
    }
  }
  get current(): Value<N> {
    return this.snapshot;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notify() {
    for (const listener of this.listeners) listener();
  }
  private transactionFailure: unknown;
  private collecting = false;
  private assertWritable() {
    if (this.closed || this.closing || this.collecting) {
      const error = new OperationRejectedError(
        "Document is closed, closing, or running a transaction; use tx.fields inside transactions",
      );
      if (this.collecting) this.transactionFailure ??= error;
      throw error;
    }
  }
  apply(op: Operation) {
    this.assertWritable();
    const result = applyOperation(this.engine, this.definition.descriptor.root, op);
    this.engine.commit();
    this.changed();
    return result;
  }
  transaction<R>(callback: (tx: Commands & { readonly fields: Handle<N> }) => R): R {
    this.assertWritable();
    const staged = this.engine.fork();
    let active = true;
    let count = 0;
    const tx = new Commands((op) => {
      if (!active) throw new OperationRejectedError("Transaction callback has ended");
      if (this.transactionFailure) throw this.transactionFailure;
      try {
        const result = applyOperation(staged, this.definition.descriptor.root, op);
        count++;
        return result;
      } catch (error) {
        this.transactionFailure = error;
        throw error;
      }
    });
    const scoped = Object.assign(tx, { fields: createHandles(this.definition.fields.node, tx) });
    this.collecting = true;
    this.transactionFailure = undefined;
    try {
      staged.setPeerId(this.engine.peerIdStr);
      const result = callback(scoped);
      if (result && typeof (result as any).then === "function") {
        void Promise.resolve(result).catch(() => {});
        throw new OperationRejectedError("Transaction callbacks must be synchronous");
      }
      active = false;
      if (this.transactionFailure) throw this.transactionFailure;
      if (count) {
        staged.commit();
        project(this.definition.descriptor.root, staged.getMap("data"));
        const bytes = staged.export({ mode: "update", from: this.engine.oplogVersion() });
        this.engine.import(bytes);
        // Imported operations do not trigger subscribeLocalUpdates.
        this.pending.push(bytes);
        this.collecting = false;
        this.changed();
      }
      return result;
    } finally {
      active = false;
      this.collecting = false;
      this.transactionFailure = undefined;
      staged.free();
    }
  }
  applyAll(operations: Operation[]): void {
    this.assertWritable();
    if (!Array.isArray(operations)) throw new OperationRejectedError("Expected operations array");
    if (!operations.length) return;
    // Route JSON batches through the same eager staging and acceptance boundary.
    this.transaction((tx) => {
      for (const op of operations) tx.execute(op);
    });
  }
  /** Internal synchronization seam. No transport or author-facing raw engine. */
  importUpdates(bytes: Uint8Array): void {
    this.assertWritable();
    const staged = this.engine.fork();
    try {
      const result = staged.import(bytes);
      if (result.pending?.size) throw new Error("Missing dependencies; request catch-up");
      project(this.definition.descriptor.root, staged.getMap("data"));
      this.engine.import(bytes);
      this.pending.push(bytes.slice());
      this.changed();
    } finally {
      staged.free();
    }
  }
  exportUpdates(from?: ReturnType<LoroDoc["oplogVersion"]>) {
    return this.engine.export({ mode: "update", from });
  }
  exportSnapshot() {
    return this.engine.export({ mode: "snapshot" });
  }
  version() {
    return this.engine.oplogVersion();
  }
  private changed() {
    this.snapshot = project(
      this.definition.descriptor.root,
      this.engine.getMap("data"),
      this.snapshot,
    ) as Value<N>;
    if (!this.error) this.status = "saving";
    this.notify();
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(() => {});
    }, 200);
  }
  flush(): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Document closed"));
    if (!this.closing) for (const draft of this.drafts) draft();
    clearTimeout(this.timer);
    this.timer = undefined;
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        try {
          while (this.pending.length) {
            const updates = this.pending.slice();
            try {
              this.generation = await this.storage.append(this.generation, updates);
            } catch (error) {
              // A commit can succeed before its reply is lost. Retrying Loro bytes is idempotent.
              const disk = await this.storage.load();
              this.generation = disk.generation;
              throw error;
            }
            this.pending.splice(0, updates.length);
            this.logRows += updates.length;
            this.logBytes += updates.reduce((n, b) => n + b.length, 0);
          }
          if (this.logRows >= 256 || this.logBytes >= 4 * 1024 * 1024) {
            const count = this.pending.length;
            try {
              this.generation = await this.storage.checkpoint(
                this.generation,
                this.engine.export({ mode: "snapshot" }),
                this.key,
              );
            } catch (error) {
              this.generation = (await this.storage.load()).generation;
              throw error;
            }
            this.pending.splice(0, count);
            this.logRows = 0;
            this.logBytes = 0;
          }
          this.status = this.pending.length ? "saving" : "saved";
          this.error = null;
          this.notify();
        } catch (error) {
          this.status = "save-failed";
          this.error = String(error);
          this.notify();
          throw error;
        }
      });
    this.queue = task;
    return task;
  }
  async compact() {
    await this.flush();
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        // Snapshot captures all current edits, including any made while waiting.
        this.engine.commit();
        const count = this.pending.length;
        try {
          this.generation = await this.storage.checkpoint(
            this.generation,
            this.engine.export({ mode: "snapshot" }),
            this.key,
          );
          this.pending.splice(0, count);
          this.logRows = 0;
          this.logBytes = 0;
        } catch (error) {
          this.generation = (await this.storage.load()).generation;
          this.status = "save-failed";
          this.error = String(error);
          this.notify();
          throw error;
        }
      });
    this.queue = task;
    await task;
  }
  async close() {
    if (this.closed) return;
    for (const draft of this.drafts) draft();
    this.closing = true;
    try {
      await this.flush();
    } catch (error) {
      this.closing = false;
      throw error;
    }
    this.closed = true;
    this.notify();
    this.stop?.();
    this.engine.free();
    this.listeners.clear();
    await this.storage.close();
  }
}
