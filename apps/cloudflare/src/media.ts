import { digest } from "./crypto.ts";
import { fail } from "./errors.ts";
import type { Registry } from "./store.ts";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const sha256 = /^[a-f0-9]{64}$/;

export const mediaKey = (hash: string) => `media/sha256/${hash}`;

export async function handleMediaPut(input: Blob, registry: Registry, contentType: string | null) {
  if (input.size > MAX_MEDIA_BYTES) fail("Media exceeds 25 MiB", 413);
  const bytes = new Uint8Array(await input.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES) fail("Media exceeds 25 MiB", 413);
  const hash = await digest(bytes);
  // File deserialization does not preserve MIME in all Fetch adapters.
  const mime = contentType || input.type || "application/octet-stream";
  if (mime.length > 127) fail("Invalid media type");
  await registry.putObject(mediaKey(hash), bytes, mime);
  return { sha256: hash, bytes: bytes.byteLength, mime };
}

export async function handleMediaGet(registry: Registry, hash: string) {
  if (!sha256.test(hash)) fail("Invalid media digest");
  const object = await registry.getObject(mediaKey(hash));
  if (!object) return fail("Media not found", 404);
  return new Blob([Uint8Array.from(object.bytes)], { type: object.contentType });
}
