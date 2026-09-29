import type { BridgeReply as Result } from "@hitslop/schema/bridge";
import type { ByteStore, Stored } from "../../src/storage";
import { base64, hostCall } from "../../src/bridge";
const { encode, decode } = base64;
let prefetched: Promise<Result<"load">> | undefined;
export class HostStore implements ByteStore {
  metadata() {
    return hostCall({ method: "metadata" });
  }
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
