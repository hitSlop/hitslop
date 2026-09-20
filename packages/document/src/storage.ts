export type Stored = {
  checkpoint: Uint8Array | null;
  updates: Uint8Array[];
  generation: string;
  schemaKey: string | null;
};
export interface ByteStore {
  load(): Promise<Stored>;
  append(generation: string, updates: Uint8Array[]): Promise<string>;
  checkpoint(generation: string, bytes: Uint8Array, schemaKey: string): Promise<string>;
  close(): Promise<void>;
}
