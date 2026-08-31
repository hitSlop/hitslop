import { createFileRoute } from "@tanstack/react-router";
import { PublishEnvelopeSchema, SlopManifestSchema, canonicalPublishEnvelope, type SlopManifest } from "@hitslop/schema";
import { decode as decodePng } from "fast-png";
import { unzipSync } from "fflate";
import { workerEnv } from "../server-env";
import { validatePackagePath, validateStaticPreviews } from "../publish-package";

const MAX_ENTRIES = 256;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const decode = (value: string): Uint8Array => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
const ownedBuffer = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;
const digest = async (bytes: ArrayBuffer): Promise<{ raw: ArrayBuffer; hex: string }> => {
  const raw = await crypto.subtle.digest("SHA-256", bytes);
  return { raw, hex: hex(raw) };
};

function safeArchivePath(name: string): boolean {
  if (!name || name.length > 240 || name.startsWith("/") || name.includes("\\") || name.includes("\0")) return false;
  return name.replace(/\/$/, "").split("/").every((part) => part && part !== "." && part !== "..");
}

function inspectZip(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.byteLength - 65_557);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("Artifact is not a valid ZIP archive");
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const diskEntries = view.getUint16(eocd + 8, true);
  const entries = view.getUint16(eocd + 10, true);
  const centralBytes = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entries || entries === 0xffff || centralBytes === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("Multi-disk and ZIP64 artifacts are not supported");
  }
  if (entries === 0 || entries > MAX_ENTRIES) throw new Error(`Artifact must contain 1–${MAX_ENTRIES} entries`);
  if (centralOffset + centralBytes > eocd) throw new Error("Artifact has an invalid ZIP directory");

  const names = new Set<string>();
  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Artifact has an invalid ZIP entry");
    const madeBy = view.getUint16(offset + 4, true);
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const localOffset = view.getUint32(offset + 42, true);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || localOffset + 30 > bytes.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Artifact has an invalid ZIP entry");
    if ((flags & 1) !== 0) throw new Error("Encrypted ZIP entries are not supported");
    if (method !== 0 && method !== 8) throw new Error("Artifact contains an unsupported compression method");
    const unixMode = madeBy >> 8 === 3 ? (externalAttributes >>> 16) & 0xffff : 0;
    if ((unixMode & 0xf000) === 0xa000) throw new Error("Artifact cannot contain symlinks");
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!safeArchivePath(name)) throw new Error(`Unsafe archive entry: ${name}`);
    validatePackagePath(name);
    if (names.has(name)) throw new Error(`Artifact contains duplicate entry ${name}`);
    names.add(name);
    if (uncompressed > MAX_ENTRY_BYTES) throw new Error(`Artifact entry is too large: ${name}`);
    total += uncompressed;
    if (total > MAX_TOTAL_BYTES) throw new Error("Artifact expands beyond the 50 MiB limit");
    if (compressed > bytes.byteLength) throw new Error("Artifact has an invalid compressed size");
    offset = end;
  }
  if (offset !== centralOffset + centralBytes) throw new Error("Artifact has an invalid ZIP directory size");
}

function validatePng(bytes: Uint8Array, label: string): ReturnType<typeof decodePng> {
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image`); }
}

function validateSkin(files: Record<string, Uint8Array>, manifest: SlopManifest): void {
  if (!("skin" in manifest.presentation)) return;
  const skin = files[manifest.presentation.skin];
  if (!skin) throw new Error(`Artifact is missing ${manifest.presentation.skin}`);
  const png = validatePng(skin, "Window skin");
  if (png.width !== manifest.presentation.width || png.height !== manifest.presentation.height) throw new Error(`Window skin must be exactly ${manifest.presentation.width}x${manifest.presentation.height} pixels`);
  if (png.channels !== 4) throw new Error("Window skin must be an RGBA PNG image");
}

export const Route = createFileRoute("/api/publish")({ server: { handlers: { POST: async ({ request }) => {
  try {
    const env = workerEnv();
    const form = await request.formData();
    const envelopeValue = form.get("envelope");
    const artifact = form.get("artifact");
    const signatureValue = form.get("signature");
    if (typeof envelopeValue !== "string" || typeof signatureValue !== "string" || !(artifact instanceof File)) return Response.json({ error: "Missing publish fields" }, { status: 400 });
    const envelope = PublishEnvelopeSchema.parse(JSON.parse(envelopeValue));
    if (Math.abs(Date.now() - envelope.timestamp) > 5 * 60_000) return Response.json({ error: "Publish envelope expired" }, { status: 400 });
    if (artifact.size !== envelope.artifactBytes) return Response.json({ error: "Artifact size does not match signed envelope" }, { status: 400 });

    const publicKey = decode(envelope.publicKey);
    if ((await digest(ownedBuffer(publicKey))).hex.slice(0, 32) !== envelope.publisherKeyId) return Response.json({ error: "Publisher key id mismatch" }, { status: 400 });
    const imported = await crypto.subtle.importKey("raw", ownedBuffer(publicKey), { name: "Ed25519" }, false, ["verify"]);
    if (!await crypto.subtle.verify("Ed25519", imported, ownedBuffer(decode(signatureValue)), ownedBuffer(canonicalPublishEnvelope(envelope)))) return Response.json({ error: "Invalid publisher signature" }, { status: 401 });

    const artifactBytes = await artifact.arrayBuffer();
    const artifactHash = await digest(artifactBytes);
    if (artifactHash.hex !== envelope.artifactSha256) return Response.json({ error: "Artifact hash does not match signed envelope" }, { status: 400 });
    const zipped = new Uint8Array(artifactBytes);
    inspectZip(zipped);
    const unpacked = unzipSync(zipped);
    const manifestBytes = unpacked["manifest.json"];
    if (!manifestBytes || !unpacked["app.html"]) throw new Error("Artifact must contain manifest.json and app.html");
    if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new Error("manifest.json exceeds 64 KiB");
    const preview = validateStaticPreviews(unpacked);
    const manifest = SlopManifestSchema.parse(JSON.parse(decoder.decode(manifestBytes)));
    validateSkin(unpacked, manifest);

    const previewHash = await digest(ownedBuffer(preview));
    const artifactKey = `artifacts/sha256/${artifactHash.hex}.slop.zip`;
    const previewKey = `previews/sha256/${previewHash.hex}.png`;
    await Promise.all([
      env.ARTIFACTS.put(artifactKey, artifactBytes, { sha256: artifactHash.raw, httpMetadata: { contentType: "application/zip", cacheControl: "public, max-age=31536000, immutable" } }),
      env.ARTIFACTS.put(previewKey, ownedBuffer(preview), { sha256: previewHash.raw, httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" } }),
    ]);
    const finalize = await fetch(`${env.CONVEX_SITE_URL}/internal/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.HITSLOP_INTERNAL_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({
        requestId: envelope.requestId, publisherKeyId: envelope.publisherKeyId, publicKey: envelope.publicKey, displayName: envelope.displayName,
        artifactKey, artifactSha256: artifactHash.hex, artifactBytes: artifactBytes.byteLength,
        previewKey, previewSha256: previewHash.hex, previewBytes: preview.byteLength, manifest,
      }),
    });
    if (!finalize.ok) throw new Error(`Convex finalize failed: ${await finalize.text()}`);
    return Response.json(await finalize.json(), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
} } } });
