import type { ByteStore } from "../src/storage";

/** Seed another peer through the same byte-store contract as production. */
export async function copyStore(source: ByteStore, target: ByteStore) {
  const stored = await source.load();
  let generation = (await target.load()).generation;
  if (stored.checkpoint && stored.schemaKey) {
    generation = await target.checkpoint(generation, stored.checkpoint, stored.schemaKey);
  }
  if (stored.updates.length) await target.append(generation, stored.updates);
}
