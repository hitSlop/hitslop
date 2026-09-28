import type { ByteStore, Stored } from "./storage";
import { metadataOf } from "./storage";
import identity from "./runtime-identity.json";
export class MemoryStore implements ByteStore {
  private stored: Stored;
  /** Peer replicas of one document share its ID; a new store is a new document. */
  constructor(docId: string = crypto.randomUUID()) {
    this.stored = {
      checkpoint: null,
      updates: [],
      generation: "0",
      schemaKey: null,
      docId,
      readerRevision: identity.storageRevision,
    };
  }
  async load() {
    return structuredClone(this.stored);
  }
  async metadata() {
    return metadataOf(this.stored);
  }
  private check(generation: string) {
    if (generation !== this.stored.generation) throw new Error("revision_conflict");
  }
  async append(generation: string, updates: Uint8Array[]) {
    this.check(generation);
    const metadata = metadataOf(this.stored);
    if (
      metadata.updateRows + updates.length > 4096 ||
      metadata.checkpointBytes + metadata.updateBytes + updates.reduce((n, b) => n + b.length, 0) >
        32 * 1024 * 1024
    )
      throw new Error("Document exceeds storage limits");
    this.stored.updates.push(...updates.map((b) => b.slice()));
    return (this.stored.generation = String(Number(generation) + 1));
  }
  async checkpoint(generation: string, bytes: Uint8Array, schemaKey: string) {
    this.check(generation);
    if (bytes.length > 32 * 1024 * 1024) throw new Error("Checkpoint exceeds storage limits");
    this.stored = {
      ...this.stored,
      checkpoint: bytes.slice(),
      updates: [],
      schemaKey,
      generation: String(Number(generation) + 1),
    };
    return this.stored.generation;
  }
  async close() {}
}
