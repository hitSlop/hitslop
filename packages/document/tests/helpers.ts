import type { ByteStore, Stored } from "../src/storage";
export class MemoryStore implements ByteStore {
  stored: Stored = { checkpoint: null, updates: [], generation: "0", schemaKey: null };
  async load() {
    return structuredClone(this.stored);
  }
  async append(generation: string, updates: Uint8Array[]) {
    this.check(generation);
    this.stored.updates.push(...updates.map((b) => b.slice()));
    return this.advance();
  }
  async checkpoint(generation: string, checkpoint: Uint8Array, schemaKey: string) {
    this.check(generation);
    this.stored = { ...this.stored, checkpoint: checkpoint.slice(), schemaKey, updates: [] };
    return this.advance();
  }
  private advance() {
    return (this.stored.generation = String(Number(this.stored.generation) + 1));
  }
  private check(generation: string) {
    if (generation !== this.stored.generation) throw new Error("revision_conflict");
  }
  async close() {}
}
