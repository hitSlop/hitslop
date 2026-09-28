export type Stored = {
  checkpoint: Uint8Array | null;
  updates: Uint8Array[];
  generation: string;
  schemaKey: string | null;
  /** Host-owned logical document identity; renewed by Duplicate, never by a Loro edit. */
  docId: string;
  readerRevision: number;
};
export type StorageMetadata = Pick<
  Stored,
  "generation" | "schemaKey" | "docId" | "readerRevision"
> & {
  checkpointBytes: number;
  updateBytes: number;
  updateRows: number;
};
export function metadataOf(stored: Stored): StorageMetadata {
  return {
    generation: stored.generation,
    schemaKey: stored.schemaKey,
    docId: stored.docId,
    readerRevision: stored.readerRevision,
    checkpointBytes: stored.checkpoint?.length ?? 0,
    updateBytes: stored.updates.reduce((sum, bytes) => sum + bytes.length, 0),
    updateRows: stored.updates.length,
  };
}
export interface ByteStore {
  load(): Promise<Stored>;
  metadata(): Promise<StorageMetadata>;
  append(generation: string, updates: Uint8Array[]): Promise<string>;
  checkpoint(generation: string, bytes: Uint8Array, schemaKey: string): Promise<string>;
  close(): Promise<void>;
}
