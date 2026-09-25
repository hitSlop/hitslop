import { createHandles, nodeAt, type At, type Handle, type Observer } from "./handles";
import { OperationRejectedError } from "./errors";
import { LoroDoc, type LoroEventBatch } from "loro-crdt";
import {
  isScalar,
  schemaKey,
  textStyles,
  unwrap,
  validate,
  type Definition,
  type ObjectNode,
  type Value,
  type Input,
  type Node,
  type Path,
  type Snapshot,
} from "./schema.ts";
import type { ByteStore } from "./storage.ts";
import { Commands, applyOperation, fill, project, type Operation } from "./operations";
import { patch } from "./projection";
import { importJSON } from "./json-import";
import { base64 } from "./bridge";
export type { Operation, Destination } from "./operations";
export type SaveStatus = "saved" | "saving" | "save-failed";
/** `ui` for authored code, `cli` for socket requests; the message is kept in history. */
export type CommitOptions = { origin?: string; message?: string };
export type Scope<N extends ObjectNode> = Commands & {
  readonly fields: Handle<N>;
  readonly at: At;
};
const MAX_CHECKPOINT_BYTES = 32 * 1024 * 1024;
const paths = new WeakMap<object, { owner: object; path: Path }>();
const key = (path: Path) => JSON.stringify(path);
export class Document<N extends ObjectNode> extends Commands {
  private engine = new LoroDoc();
  private pending: Uint8Array[] = [];
  private generation = "0";
  private logRows = 0;
  private logBytes = 0;
  private checkpointBytes = 0;
  private checkpointImport = false;
  private drafts = new Set<() => void>();
  private previews = new Map<string, { path: Path; value: unknown }>();
  private preparations: Array<(commit: (callback: () => void) => void) => Promise<void>> = [];
  private committingPreparation = false;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private stop?: () => void;
  private stopEvents?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private closing = false;
  private preparingClose?: Promise<void>;
  private snapshot!: Value<N>;
  private view!: Value<N>;
  private origin = "ui";
  status: SaveStatus = "saved";
  error: string | null = null;
  readonly key: string;
  readonly fields: Handle<N>;
  private observer: Observer;
  private register = (value: object, path: Path) => paths.set(value, { owner: this, path });
  private constructor(
    readonly definition: Definition<N>,
    private storage: ByteStore,
  ) {
    super((op) => this.apply(op));
    this.key = schemaKey(definition.descriptor);
    this.observer = {
      subscribe: (listener) => this.subscribe(listener),
      beforeFlush: (draft) => {
        this.drafts.add(draft);
        return () => this.drafts.delete(draft);
      },
      read: (path) => (this.closed ? undefined : read(this.view, path)),
      preview: (path, value) => this.preview(path, value),
    };
    this.fields = createHandles(definition.fields.node, this, this.observer);
  }
  static async open<N extends ObjectNode>(
    definition: Definition<N>,
    storage: ByteStore,
    initial: Input<N>,
  ): Promise<Document<N>> {
    const doc = new Document(definition, storage);
    try {
      const styles = textStyles(definition.descriptor.root);
      if (Object.keys(styles).length) doc.engine.configTextStyle(styles);
      const stored = await storage.load();
      doc.generation = stored.generation;
      doc.checkpointBytes = stored.checkpoint?.length ?? 0;
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
        // project() below walks every container and validates each stored value.
      } else {
        validate(definition.descriptor.root, initial);
        fill(doc.engine.getMap("data"), definition.descriptor.root, initial);
        doc.engine.commit();
        const snapshot = doc.engine.export({ mode: "snapshot" });
        doc.generation = await storage.checkpoint(doc.generation, snapshot, doc.key);
        doc.checkpointBytes = snapshot.length;
      }
      doc.snapshot = doc.view = doc.projectAll();
      doc.stop = doc.engine.subscribeLocalUpdates((bytes) => {
        doc.pending.push(bytes.slice());
      });
      doc.stopEvents = doc.engine.subscribe((batch) => doc.onEvents(batch));
      return doc;
    } catch (error) {
      doc.engine.free();
      await storage.close();
      throw error;
    }
  }
  /** Immutable snapshot, including uncommitted previews. */
  get current(): Value<N> {
    return this.view;
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
  private projectAll(previous?: Value<N>): Value<N> {
    const root = this.definition.descriptor.root;
    return project(root, this.engine.getMap("data"), previous, [], this.register) as Value<N>;
  }
  /** Events arrive synchronously on commit and import; only touched containers are re-read. */
  private onEvents(batch: LoroEventBatch) {
    if (this.closed || batch.by === "checkout") return;
    const root = this.definition.descriptor.root;
    try {
      this.snapshot = patch(root, this.engine, this.snapshot, batch, this.register) as Value<N>;
    } catch {
      this.snapshot = this.projectAll(this.snapshot);
    }
    this.view = this.applyPreviews(this.snapshot);
  }
  /** Handle for a snapshot object, row, record entry or tree node from this document. */
  at<T extends Node>(value: Snapshot<T>): Handle<T> {
    return this.handleAt(this, value);
  }
  private handleAt(commands: Commands, value: object): any {
    if (value === this.view || value === this.snapshot)
      return commands === this ? this.fields : createHandles(this.definition.fields.node, commands);
    const entry = value && typeof value === "object" ? paths.get(value) : undefined;
    if (!entry || entry.owner !== this) throw new Error("at() requires an object from this document's snapshot");
    const node = nodeAt(this.definition.descriptor.root, entry.path);
    return createHandles(node, commands, commands === this ? this.observer : undefined, entry.path);
  }
  private transactionFailure: unknown;
  private collecting = false;
  private assertWritable() {
    if (this.closed || (this.closing && !this.committingPreparation) || this.collecting) {
      const error = new OperationRejectedError(
        "Document is closed, closing, or running a transaction; use tx.fields inside transactions",
      );
      if (this.collecting) this.transactionFailure ??= error;
      throw error;
    }
  }
  apply(op: Operation, options: CommitOptions = {}) {
    this.assertWritable();
    const result = applyOperation(this.engine, this.definition.descriptor.root, op);
    this.dropPreview(op);
    this.engine.commit({ origin: options.origin ?? this.origin, message: options.message });
    this.changed();
    return result;
  }
  /** One synchronous, all-or-nothing commit. Reads stay on the pre-change snapshot. */
  change<R>(callback: (tx: Scope<N>) => R, options: CommitOptions = {}): R {
    return this.stage(callback, options);
  }
  /** Import desired values through the same staged operation boundary as authored changes. */
  importJSON(value: unknown, options: CommitOptions & { fresh?: boolean } = {}) {
    this.stage(tx => importJSON(this.definition.descriptor.root, this.snapshot, value, tx, options.fresh), options, true);
  }
  /** Opaque optimistic-concurrency token; stable across close/reopen and checkpointing. */
  snapshotFor(documentPath: string) {
    return {
      data: this.snapshot,
      schema: this.definition.descriptor,
      version: base64.encode(new TextEncoder().encode(JSON.stringify([
        documentPath, this.key, base64.encode(this.engine.oplogVersion().encode()),
      ]))),
    };
  }
  private stage<R>(callback: (tx: Scope<N>) => R, options: CommitOptions, checkImport = false): R {
    this.assertWritable();
    const staged = this.engine.fork();
    let active = true;
    let count = 0;
    const touched: Operation[] = [];
    const tx = new Commands((op) => {
      if (!active) throw new OperationRejectedError("Transaction callback has ended");
      if (this.transactionFailure) throw this.transactionFailure;
      try {
        const result = applyOperation(staged, this.definition.descriptor.root, op);
        touched.push(op);
        count++;
        return result;
      } catch (error) {
        this.transactionFailure = error;
        throw error;
      }
    });
    const scoped = Object.assign(tx, {
      fields: createHandles(this.definition.fields.node, tx),
      at: (value: object) => this.handleAt(tx, value),
    }) as Scope<N>;
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
        staged.commit({ origin: options.origin ?? this.origin, message: options.message });
        if (checkImport) {
          project(this.definition.descriptor.root, staged.getMap("data"));
          if (staged.export({ mode: "snapshot" }).length > MAX_CHECKPOINT_BYTES)
            throw new OperationRejectedError("Import exceeds the 32 MiB storage limit");
        }
        const bytes = staged.export({ mode: "update", from: this.engine.oplogVersion() });
        this.collecting = false;
        this.engine.import(bytes);
        // Imported operations do not trigger subscribeLocalUpdates.
        this.pending.push(bytes);
        // Preserve the accepted absolute values as a checkpoint. Replaying separately
        // batched floating-point counter increments can otherwise change rounding.
        if (checkImport) this.checkpointImport = true;
        for (const op of touched) this.dropPreview(op);
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
  /** Compatibility name for compiled contract-1 apps; prefer change(). */
  transaction<R>(callback: (tx: Scope<N>) => R): R {
    return this.change(callback);
  }
  applyAll(operations: Operation[], options: CommitOptions = {}): void {
    this.assertWritable();
    if (!Array.isArray(operations)) throw new OperationRejectedError("Expected operations array");
    if (!operations.length) return;
    // Route JSON batches through the same eager staging and acceptance boundary.
    this.change((tx) => {
      for (const op of operations) tx.execute(op);
    }, options);
  }
  /** Internal synchronization seam. No transport or author-facing raw engine. */
  importUpdates(bytes: Uint8Array): void {
    this.assertWritable();
    const staged = this.engine.fork();
    try {
      const result = staged.import(bytes);
      if (result.pending?.size) throw new Error("Missing dependencies; request catch-up");
      // Remote bytes are untrusted: validate the whole candidate state before accepting it.
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
  private preview(path: Path, value: unknown) {
    if (this.closed) return;
    const node = previewNode(this.definition.descriptor.root, path);
    validate(node, value);
    this.previews.set(key(path), { path, value });
    this.view = this.applyPreviews(this.snapshot);
    this.notify();
  }
  private applyPreviews(snapshot: Value<N>): Value<N> {
    let view: any = snapshot;
    for (const [id, { path, value }] of this.previews) {
      const next = overlay(view, path, value);
      if (next === undefined) this.previews.delete(id);
      else view = next;
    }
    return view;
  }
  private dropPreview(op: Operation) {
    if (!this.previews.size || !Array.isArray(op?.path)) return;
    const prefix = key(op.path).slice(0, -1);
    for (const id of this.previews.keys()) if (id.startsWith(prefix)) this.previews.delete(id);
  }
  /** Previews become ordinary edits at flush, close and export. */
  private commitPreviews() {
    if (!this.previews.size || this.closed) return;
    // Committed edits drop their previews; a failed commit keeps them for the next flush.
    const edits = [...this.previews.values()];
    try {
      this.change((tx) => {
        for (const { path, value } of edits) {
          try {
            tx.execute({ type: "set", path, value: value as any });
          } catch {
            // The previewed row or index was removed meanwhile; drop the preview.
            this.previews.delete(key(path));
            this.transactionFailure = undefined;
          }
        }
      });
    } catch {}
    this.view = this.applyPreviews(this.snapshot);
  }
  private changed() {
    this.view = this.applyPreviews(this.snapshot);
    if (!this.error) this.status = "saving";
    this.notify();
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(() => {});
    }, 200);
  }
  /** Host capabilities stage durable bytes before committing their document references. */
  stageSave(work: (commit: (callback: () => void) => void) => Promise<void>): Promise<void> {
    this.assertWritable();
    if (this.preparingClose) return Promise.reject(new Error("Document is closing"));
    this.preparations.push(work);
    this.status = "saving";
    this.notify();
    return this.flush();
  }
  flush(): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Document closed"));
    if (!this.closing) this.flushDrafts();
    clearTimeout(this.timer);
    this.timer = undefined;
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        try {
          while (this.preparations.length) {
            try {
              await this.preparations[0]!(callback => {
                this.committingPreparation = true;
                try { callback(); } finally { this.committingPreparation = false; }
              });
            } catch (error) {
              if (error instanceof OperationRejectedError) this.preparations.shift();
              throw error;
            }
            this.preparations.shift();
          }
          while (this.pending.length) {
            const updates = this.pending.slice();
            const bytes = updates.reduce((n, b) => n + b.length, 0);
            if (
              this.checkpointImport || this.logRows + updates.length >= 256 ||
              this.logBytes + bytes >= 4 * 1024 * 1024 ||
              this.checkpointBytes + this.logBytes + bytes > MAX_CHECKPOINT_BYTES
            ) {
              await this.writeCheckpoint();
              continue;
            }
            try {
              this.generation = await this.storage.append(this.generation, updates);
            } catch (error) {
              // A commit can succeed before its reply is lost. Retrying Loro bytes is idempotent.
              await this.reloadStorageMetadata();
              throw error;
            }
            this.pending.splice(0, updates.length);
            this.logRows += updates.length;
            this.logBytes += updates.reduce((n, b) => n + b.length, 0);
          }
          this.status = this.pending.length ? "saving" : "saved";
          this.error = null;
          this.notify();
        } catch (error) {
          if (error instanceof OperationRejectedError) {
            this.error = null;
            this.status = this.pending.length || this.preparations.length ? "saving" : "saved";
            this.notify();
            if (this.status === "saving") this.timer ??= setTimeout(() => {
              this.timer = undefined;
              void this.flush().catch(() => {});
            }, 200);
            throw error;
          }
          this.status = "save-failed";
          this.error = String(error);
          this.notify();
          throw error;
        }
      });
    this.queue = task;
    return task;
  }
  /** Synchronous barrier immediately before a snapshot or version-checked edit. */
  flushDrafts() {
    this.assertWritable();
    for (const draft of this.drafts) draft();
    this.commitPreviews();
  }
  async compact() {
    await this.flush();
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        try {
          await this.writeCheckpoint();
        } catch (error) {
          this.status = "save-failed";
          this.error = String(error);
          this.notify();
          throw error;
        }
      });
    this.queue = task;
    await task;
  }
  private async reloadStorageMetadata() {
    const disk = await this.storage.load();
    this.generation = disk.generation;
    this.checkpointBytes = disk.checkpoint?.length ?? 0;
    this.logRows = disk.updates.length;
    this.logBytes = disk.updates.reduce((n, b) => n + b.length, 0);
  }
  private async writeCheckpoint() {
    this.engine.commit();
    const count = this.pending.length;
    const snapshot = this.engine.export({ mode: "snapshot" });
    if (snapshot.length > MAX_CHECKPOINT_BYTES)
      throw new Error("Document exceeds the 32 MiB storage limit");
    const imported = this.checkpointImport;
    this.checkpointImport = false;
    try {
      this.generation = await this.storage.checkpoint(this.generation, snapshot, this.key);
    } catch (error) {
      this.checkpointImport ||= imported;
      await this.reloadStorageMetadata();
      throw error;
    }
    this.pending.splice(0, count);
    this.checkpointBytes = snapshot.length;
    this.logRows = 0;
    this.logBytes = 0;
  }
  prepareClose(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.preparingClose) return this.preparingClose;
    for (const draft of this.drafts) draft();
    this.commitPreviews();
    this.closing = true;
    this.preparingClose = this.flush().catch((error) => {
      this.closing = false;
      this.preparingClose = undefined;
      throw error;
    });
    return this.preparingClose;
  }
  cancelClose() {
    if (!this.closed) {
      this.closing = false;
      this.preparingClose = undefined;
    }
  }
  async close() {
    if (this.closed) return;
    await this.prepareClose();
    if (this.closed) return;
    this.closed = true;
    this.notify();
    this.stop?.();
    this.stopEvents?.();
    this.engine.free();
    this.listeners.clear();
    await this.storage.close();
  }
}
/** Walk a snapshot by identity path. */
function read(value: any, path: Path): unknown {
  for (const part of path) {
    if (value === undefined || value === null) return undefined;
    if (typeof part === "string") value = value[part];
    else if ("id" in part) value = findByID(value, part.id);
    else if ("key" in part) value = Object.hasOwn(value, part.key) ? value[part.key] : undefined;
    else value = value[part.index];
  }
  return value;
}
function findByID(nodes: any, id: string): any {
  if (!Array.isArray(nodes)) return undefined;
  for (const node of nodes) {
    if (node.$id === id) return node;
    const nested = findByID(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}
function previewNode(root: Node, path: Path): Node {
  const last = path.at(-1);
  const node =
    last && typeof last === "object" && "index" in last
      ? (unwrap(nodeAt(root, path.slice(0, -1))) as any).item
      : nodeAt(root, path);
  const scalar = unwrap(node);
  if (!isScalar(scalar)) throw new OperationRejectedError("Only scalar values can be previewed");
  return scalar;
}
/** Copy-on-write replacement along an identity path; undefined when the path vanished. */
function overlay(value: any, path: Path, next: unknown): any {
  if (!path.length) return next;
  if (value === undefined || value === null) return undefined;
  const [part, ...rest] = path;
  if (typeof part === "string" || "key" in part!) {
    const name = typeof part === "string" ? part : part!.key;
    if (typeof part !== "string" && !Object.hasOwn(value, name)) return undefined;
    const child = overlay(value[name], rest, next);
    if (child === undefined && rest.length) return undefined;
    if (child === value[name]) return value;
    const copy = Object.freeze({ ...value, [name]: child });
    const entry = paths.get(value);
    if (entry) paths.set(copy, entry);
    return copy;
  }
  if ("index" in part!) {
    if (!Array.isArray(value) || part.index >= value.length) return undefined;
    if (value[part.index] === next) return value;
    const copy = [...value];
    copy[part.index] = next;
    return Object.freeze(copy);
  }
  if (!Array.isArray(value)) return undefined;
  const id = part!.id;
  const index = value.findIndex((row: any) => row.$id === id);
  if (index >= 0) {
    const child = overlay(value[index], rest, next);
    if (child === undefined) return undefined;
    if (child === value[index]) return value;
    const copy = [...value];
    copy[index] = child;
    return Object.freeze(copy);
  }
  // Tree nodes nest under children.
  for (let i = 0; i < value.length; i++) {
    const children = value[i].children;
    if (!Array.isArray(children)) continue;
    const replaced = overlay(children, path, next);
    if (replaced === undefined) continue;
    if (replaced === children) return value;
    const copy = [...value];
    copy[i] = Object.freeze({ ...value[i], children: replaced });
    const entry = paths.get(value[i]);
    if (entry) paths.set(copy[i], entry);
    return Object.freeze(copy);
  }
  return undefined;
}
