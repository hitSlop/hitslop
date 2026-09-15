import type { TSchema } from "typebox";
import { validateDocument, isSyncSchema } from "@hitslop/schema/document";
import type { SyncCommit, SyncSnapshot, SyncStatus } from "@hitslop/schema/sync";
import { Replica, type DocumentValue } from "./replica.js";
import { describeChanges } from "./review.js";
import { canonical, decode, digest, encode, hashEncoded, pack, unpack, utf8 } from "./encoding.js";

export type { DocumentIO, DocumentState } from "@hitslop/schema/document-runtime";
import type { DocumentIO, DocumentState } from "@hitslop/schema/document-runtime";
type Metadata = { format: 2; schema: string; materialized: { revision: string; hash: string } | null; receipts: Record<string, string> };
type Identity = { format: 1; documentId: string };
type Revision = { format: 1; documentId: string; schema: string; frontiers: ReturnType<Replica<TSchema>["doc"]["oplogFrontiers"]>; nonce: string };
const writer = () => {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return ((BigInt(bytes[0]!) << 32n) + BigInt(bytes[1]!) || 1n).toString();
};
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

function applicationFromFile<S extends TSchema>(schema: S, value: unknown): DocumentValue<S> {
  if (!record(value) || !record(value.$slop) || value.$slop.format !== 1 || typeof value.$slop.baseRevision !== "string") throw new Error("Invalid document envelope");
  return validateDocument(schema, value.data) as DocumentValue<S>;
}

/** One document-lifetime engine. File, UI and future transport changes meet here. */
export class DocumentEngine<S extends TSchema> {
  replica!: Replica<S>;
  state: DocumentState = { isReady: false, isDirty: false, isSaving: false, error: null, projectionError: null };
  private identity!: Identity;
  private metadata!: Metadata;
  private disk!: SyncSnapshot;
  private fingerprint = "";
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private changed = 0;
  private saved = -1;
  private lastStatus = "";
  private constructor(readonly schema: S, private readonly io: DocumentIO) {}

  static async open<S extends TSchema>(options: { schema: S; initial: DocumentValue<S>; io: DocumentIO }): Promise<DocumentEngine<S>> {
    if (!isSyncSchema(options.schema)) throw new Error("Document data requires an S.Document schema");
    const engine = new DocumentEngine(options.schema, options.io);
    engine.fingerprint = await digest(utf8(canonical(options.schema)));
    const disk = await options.io.open();
    engine.disk = disk;
    engine.metadata = { format: 2, schema: engine.fingerprint, materialized: null, receipts: {} };
    if (disk.identity !== null || disk.checkpoint !== null) {
      if (!disk.identity || !disk.checkpoint) throw new Error("Incomplete collaboration state; recover the journal before opening");
      const identity = unpack(disk.identity);
      if (!record(identity) || identity.format !== 1 || typeof identity.documentId !== "string" || !identity.documentId) throw new Error("Invalid document identity");
      engine.identity = identity as Identity;
      engine.replica = new Replica({ schema: options.schema, peerId: writer(), snapshot: decode(disk.checkpoint) });
      if (!disk.metadata) throw new Error("Incomplete document state");
      engine.metadata = engine.parseMetadata(disk.metadata);
    } else {
      if (disk.external || disk.metadata) throw new Error("Incomplete document state");
      const initial = options.initial;
      engine.identity = { format: 1, documentId: crypto.randomUUID() };
      engine.replica = new Replica({ schema: options.schema, peerId: writer(), initial });
    }
    engine.state.isReady = true;
    await engine.flush().catch(() => undefined);
    engine.notify();
    return engine;
  }
  get dataVersion(): string { return this.version(); }
  /** Host-only replication payload; account credentials never enter the engine. */
  async sharingSnapshot() {
    await this.flush();
    return { documentId: this.identity.documentId, schema: this.fingerprint,
      checkpoint: encode(this.replica.exportSnapshot()), version: this.dataVersion };
  }
  async receiveShared(value: { documentId: string; schema: string; checkpoint: string }): Promise<void> {
    if (value.documentId !== this.identity.documentId || value.schema !== this.fingerprint) throw new Error("Shared document identity or schema does not match");
    this.importUpdates(decode(value.checkpoint));
    await this.flush();
  }
  /** A copy starts from visible content, never the original document's history. */
  async independentCopy(): Promise<{ identity: string; checkpoint: string; metadata: string; projection: string }> {
    await this.flush();
    if (this.state.projectionError) throw new Error("Review the JSON file before making a copy");
    const replica = new Replica({ schema: this.schema, peerId: writer(), initial: this.current });
    return this.materializeReplica(replica, crypto.randomUUID());
  }
  private async materializeReplica(replica: Replica<S>, documentId: string) {
    const revision = pack({ format: 1, documentId, schema: this.fingerprint, frontiers: replica.doc.oplogFrontiers(), nonce: crypto.randomUUID() } satisfies Revision);
    const projection = pack({ $slop: { format: 1, baseRevision: revision }, data: replica.current() });
    return { identity: pack({ format: 1, documentId }), checkpoint: encode(replica.exportSnapshot()), projection,
      metadata: pack({ format: 2, schema: this.fingerprint, receipts: {}, materialized: { revision, hash: await hashEncoded(projection) } } satisfies Metadata) };
  }
  /** Bootstrap a new local package from an existing replica, before opening its UI. */
  static async sharedSeed(schema: TSchema, value: { documentId: string; schema: string; checkpoint: string }) {
    const fingerprint = await digest(utf8(canonical(schema)));
    if (value.schema !== fingerprint || !value.documentId) throw new Error("Shared document schema does not match this template");
    const replica = new Replica({ schema, peerId: writer(), snapshot: decode(value.checkpoint) });
    const engine = new DocumentEngine(schema, { open: async () => { throw new Error("Seed has no storage"); }, commit: async () => { throw new Error("Seed has no storage"); } });
    engine.fingerprint = fingerprint;
    return engine.materializeReplica(replica, value.documentId);
  }
  get current(): DocumentValue<S> { return this.replica.current(); }
  subscribe(callback: () => void): () => void { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  private notify() { this.state.isDirty = this.saved !== this.changed; for (const callback of this.listeners) callback(); }
  change(mutate: (draft: DocumentValue<S>) => void): void {
    this.replica.update(mutate);
    this.changed++;
    this.notify();
    this.scheduleSave();
  }
  importUpdates(bytes: Uint8Array): void {
    this.replica.importUpdates(bytes);
    this.changed++;
    this.notify();
    this.scheduleSave();
  }
  private version(): string { return canonical(this.replica.doc.oplogFrontiers()); }
  private parseMetadata(bytes: string): Metadata {
    const value = unpack(bytes);
    if (!record(value) || value.format !== 2 || value.schema !== this.fingerprint || !record(value.receipts)) throw new Error("Invalid document metadata or schema");
    if (!Object.values(value.receipts).every(x => typeof x === "string")) throw new Error("Invalid import receipts");
    if (value.materialized !== null && (!record(value.materialized) || typeof value.materialized.hash !== "string" || typeof value.materialized.revision !== "string")) throw new Error("Invalid materialization metadata");
    return value as Metadata;
  }
  private revision(): string {
    return pack({ format: 1, documentId: this.identity.documentId, schema: this.fingerprint, frontiers: this.replica.doc.oplogFrontiers(), nonce: crypto.randomUUID() } satisfies Revision).trim();
  }
  private async importExternal(): Promise<void> {
    this.state.projectionError = null;
    const { external, externalHash } = this.disk;
    if (!external || externalHash === this.metadata.materialized?.hash) return;
    try {
      const envelope = unpack(external);
      if (!record(envelope) || !record(envelope.$slop) || envelope.$slop.format !== 1 || typeof envelope.$slop.baseRevision !== "string" || Object.keys(envelope).some(k => k !== "$slop" && k !== "data") || Object.keys(envelope.$slop).some(k => k !== "format" && k !== "baseRevision")) throw new Error("The JSON file needs its original $slop revision or explicit review");
      const edited = validateDocument(this.schema, envelope.data) as DocumentValue<S>;
      const token = envelope.$slop.baseRevision;
      const revision = unpack(token);
      if (!record(revision) || revision.format !== 1 || revision.documentId !== this.identity.documentId || revision.schema !== this.fingerprint || !Array.isArray(revision.frontiers)) throw new Error("The file references another document, schema, or unknown revision");
      const inputHash = await digest(utf8(canonical(edited)));
      const receiptKey = await digest(utf8(token));
      if (Object.hasOwn(this.metadata.receipts, receiptKey)) {
        if (this.metadata.receipts[receiptKey] !== inputHash) throw new Error("This revision was already edited; review this additional stale-buffer save");
        return;
      }
      const frontiers = revision.frontiers as Revision["frontiers"];
      if (!frontiers.every(x => record(x) && typeof x.peer === "string" && /^\d+$/.test(x.peer) && Number.isSafeInteger(x.counter) && (x.counter as number) >= 0)) throw new Error("Invalid revision frontiers");
      // forkAt checks history availability; do not turn an unknown frontier into current state.
      const branch = this.replica.doc.forkAt(frontiers);
      if (canonical(branch.oplogFrontiers()) !== canonical(frontiers)) {
        // forkAt may retain the oplog beyond the checked-out state: compare state frontiers.
        if (canonical(branch.frontiers()) !== canonical(frontiers)) throw new Error("Revision history is unavailable");
      }
      if (canonical(branch.getMap("data").toJSON()) === canonical(edited)) return;
      this.replica.applyAt(frontiers, edited);
      this.metadata.receipts[receiptKey] = inputHash;
      this.changed++;
      this.notify();
    } catch (error) { this.state.projectionError = errorText(error); }
  }
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private maxTimer: ReturnType<typeof setTimeout> | undefined;
  private flushing: Promise<void> | undefined;
  private recheck = false;
  private clearSaveTimers(): void {
    clearTimeout(this.idleTimer); clearTimeout(this.maxTimer);
    this.idleTimer = this.maxTimer = undefined;
  }
  private scheduleSave(): void {
    // An active flush drains changes made during its commit.
    if (this.flushing) return;
    clearTimeout(this.idleTimer);
    const save = () => { void this.flush().catch(() => undefined); };
    this.idleTimer = setTimeout(save, 250);
    this.maxTimer ??= setTimeout(save, 1000);
  }
  flush(): Promise<void> {
    this.clearSaveTimers();
    if (this.flushing && this.queue === this.flushing) return this.flushing;
    const task = this.queue.catch(() => {}).then(async () => {
      do { this.recheck = false; await this.persist(); } while (this.saved !== this.changed || this.recheck);
    });
    this.queue = this.flushing = task;
    const settled = () => { if (this.flushing === task) this.flushing = undefined; };
    void task.then(settled, settled);
    return task;
  }
  externalChanged(): Promise<void> { this.recheck = true; return this.flush(); }
  private async persist(): Promise<void> {
    this.state.isSaving = true;
    this.notify();
    try {
      const latest = await this.io.open();
      if (latest.generation !== this.disk.generation) {
        // Recovery of an uncertain commit must not replace the live replica or lose typing.
        if (latest.identity) {
          const identity = unpack(latest.identity);
          if (!record(identity) || identity.documentId !== this.identity.documentId) throw new Error("Document identity changed on disk");
        }
        if (latest.checkpoint) this.replica.importUpdates(decode(latest.checkpoint));
        if (latest.metadata) {
          const recovered = this.parseMetadata(latest.metadata);
          this.metadata = { ...recovered, receipts: { ...recovered.receipts, ...this.metadata.receipts } };
        }
      }
      this.disk = latest;
      await this.importExternal();
      const captured = this.changed;
      const checkpoint = encode(this.replica.exportSnapshot());
      const metadata = structuredClone(this.metadata);
      let projection: string | undefined;
      if (!this.state.projectionError) {
        // Healthy no-op opens must not produce new revision tokens or rewrite files.
        if (latest.checkpoint === checkpoint && latest.externalHash === metadata.materialized?.hash && latest.metadata) {
          this.saved = captured;
          this.state.error = null;
          await this.report();
          return;
        }
        const revision = this.revision();
        projection = pack({ $slop: { format: 1, baseRevision: revision }, data: this.current });
        metadata.materialized = { revision, hash: await hashEncoded(projection) };
      }
      this.disk = await this.io.commit({ expectedGeneration: latest.generation, expectedExternal: latest.externalHash,
        identity: pack(this.identity), checkpoint, metadata: pack(metadata),
        ...(projection === undefined ? {} : { projection }), preserveExternal: false });
      this.metadata = metadata;
      this.saved = captured;
      this.state.error = null;
      await this.report();
    } catch (error) { this.state.error = errorText(error); await this.report(); throw error; }
    finally { this.state.isSaving = false; this.notify(); }
  }
  private proposal(): { canApply: boolean; proposal: string; incoming?: DocumentValue<S> } {
    try {
      const file = this.disk.external ? unpack(this.disk.external) : null;
      const incoming = applicationFromFile(this.schema, file);
      return { canApply: true, incoming, proposal: describeChanges(this.replica.mapping, this.current, incoming) || "The file contains the current application data. Keeping or applying will restore its revision metadata." };
    } catch { return { canApply: false, proposal: "The external file is not valid application data. Correct it in your editor, or keep the current document." }; }
  }
  private reviewToken(): string { return pack({ version: this.version(), hash: this.disk.externalHash }); }
  private async report(): Promise<void> {
    const needsReview = this.state.projectionError !== null;
    const details = needsReview ? this.proposal() : { canApply: false, proposal: "" };
    const status: SyncStatus = { message: this.state.error ?? (needsReview ? `Changes are saved; the JSON file needs review. ${this.state.projectionError}` : ""),
      token: this.reviewToken(), proposal: details.proposal, canApply: details.canApply, needsReview, persistenceError: this.state.error !== null };
    const key = canonical(status);
    if (key !== this.lastStatus) { await this.io.status?.(status); this.lastStatus = key; }
  }
  async resolveReview(token: string, action: "apply" | "keep" | "cancel"): Promise<boolean> {
    if (action === "cancel") return true;
    const task = this.queue.catch(() => {}).then(async () => {
      const latest = await this.io.open();
      if (token !== this.reviewToken() || latest.externalHash !== this.disk.externalHash || latest.generation !== this.disk.generation) {
        await this.persist();
        return false;
      }
      const proposal = this.proposal();
      if (action === "apply" && (!proposal.canApply || !proposal.incoming)) return false;
      const branch = new Replica({ schema: this.schema, peerId: writer(), snapshot: this.replica.exportSnapshot() });
      if (action === "apply") branch.update(draft => {
        for (const key of Object.keys(draft)) delete draft[key];
        Object.assign(draft, proposal.incoming);
      });
      const revision = pack({ format: 1, documentId: this.identity.documentId, schema: this.fingerprint,
        frontiers: branch.doc.oplogFrontiers(), nonce: crypto.randomUUID() } satisfies Revision);
      const projection = pack({ $slop: { format: 1, baseRevision: revision }, data: branch.current() });
      const metadata = structuredClone(this.metadata);
      metadata.materialized = { revision, hash: await hashEncoded(projection) };
      // Awaiting hashing may have allowed typing. Never approve a changed proposal.
      if (token !== this.reviewToken()) { await this.report(); return false; }
      try {
        const committed = await this.io.commit({ expectedGeneration: latest.generation, expectedExternal: latest.externalHash,
          identity: pack(this.identity), checkpoint: encode(branch.exportSnapshot()), metadata: pack(metadata), projection, preserveExternal: true });
        this.replica.importUpdates(branch.exportUpdates());
        this.changed++;
        this.disk = committed;
        this.metadata = metadata;
        this.state.projectionError = null;
        this.notify();
        // Includes edits made while native persistence was in flight.
        do { await this.persist(); } while (this.saved !== this.changed);
      } catch (error) {
        this.state.error = errorText(error);
        await this.report();
        throw error;
      }
      return true;
    });
    this.queue = task;
    return task;
  }
}
