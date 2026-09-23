import type { ByteStore, Stored } from "./storage.ts";
import { OperationRejectedError } from "./errors";
// Safari 18.2+ has native base64 on Uint8Array; the fallbacks avoid per-byte callbacks.
const native = Uint8Array as unknown as {
  fromBase64?: (text: string) => Uint8Array;
  prototype: { toBase64?: () => string };
};
const encode = (bytes: Uint8Array) => {
  if (native.prototype.toBase64) return (bytes as any).toBase64() as string;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16_384)
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 16_384)));
  return btoa(chunks.join(""));
};
const decode = (text: string) => {
  if (native.fromBase64) return native.fromBase64(text);
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
export const base64 = { encode, decode };
/** Native replies `{ rejected }` for refusals that retrying cannot fix; thrown errors stay retryable. */
export async function hostCall(args: Record<string, unknown>): Promise<any> {
  const reply = await (globalThis as any).webkit.messageHandlers.storage.postMessage(args);
  if (reply && typeof reply.rejected === "string") throw new OperationRejectedError(reply.rejected);
  return reply;
}
// Request stored bytes as soon as the runtime evaluates so the native read overlaps
// WASM compilation. The first HostStore load consumes it; failures surface there.
let prefetched: Promise<any> | undefined = (globalThis as any).webkit?.messageHandlers?.storage
  ? hostCall({ method: "load" })
  : undefined;
prefetched?.catch(() => {});
export class HostStore implements ByteStore {
  async load(): Promise<Stored> {
    const pending = prefetched;
    prefetched = undefined;
    const raw = await (pending ?? hostCall({ method: "load" }));
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
