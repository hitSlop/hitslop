import type { ByteStore, Stored } from "./storage.ts";
const encode = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const decode = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export function hostCall(args: Record<string, unknown>): Promise<any> {
  return (globalThis as any).webkit.messageHandlers.storage.postMessage(args);
}
export class HostStore implements ByteStore {
  async load(): Promise<Stored> {
    const raw = await hostCall({ method: "load" });
    return {
      ...raw,
      checkpoint: raw.checkpoint ? decode(raw.checkpoint) : null,
      updates: raw.updates.map(decode),
    };
  }
  async append(generation: string, updates: Uint8Array[]) {
    return (await hostCall({ method: "append", generation, updates: updates.map(encode) }))
      .generation;
  }
  async checkpoint(generation: string, bytes: Uint8Array, schemaKey: string) {
    return (await hostCall({ method: "checkpoint", generation, bytes: encode(bytes), schemaKey }))
      .generation;
  }
  async close() {
    /* Swift closes after the JS shutdown reply, retaining ownership throughout. */
  }
}
