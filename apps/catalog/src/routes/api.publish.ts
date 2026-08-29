import { createFileRoute } from "@tanstack/react-router";
import { PublishEnvelopeSchema, SlopManifestSchema, canonicalPublishEnvelope } from "@hitslop/schema";
import { unzipSync } from "fflate";
import { workerEnv } from "../server-env";

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const decode = (value: string): Uint8Array => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
const ownedBuffer = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;
const digest = async (bytes: ArrayBuffer): Promise<{ raw: ArrayBuffer; hex: string }> => { const raw = await crypto.subtle.digest("SHA-256", bytes); return { raw, hex: hex(raw) }; };

export const Route = createFileRoute("/api/publish")({ server: { handlers: { POST: async ({ request }) => {
  try {
    const env = workerEnv(); const form = await request.formData(); const envelope = PublishEnvelopeSchema.parse(JSON.parse(String(form.get("envelope")))); const signature = String(form.get("signature"));
    if (Math.abs(Date.now() - envelope.timestamp) > 5 * 60_000) return Response.json({ error: "Publish envelope expired" }, { status: 400 });
    const artifact = form.get("artifact"); const manifestFile = form.get("manifest"); const shots = form.getAll("screenshots");
    if (!(artifact instanceof File) || !(manifestFile instanceof File) || shots.some((shot) => !(shot instanceof File))) return Response.json({ error: "Missing files" }, { status: 400 });
    const artifactBytes = await artifact.arrayBuffer(); const manifestBytes = await manifestFile.arrayBuffer(); const artifactHash = await digest(artifactBytes); const manifestHash = await digest(manifestBytes);
    if (artifactBytes.byteLength !== envelope.artifactBytes || artifactHash.hex !== envelope.artifactSha256 || manifestHash.hex !== envelope.manifestSha256) return Response.json({ error: "Artifact integrity check failed" }, { status: 400 });
    const manifest = SlopManifestSchema.parse(JSON.parse(new TextDecoder().decode(manifestBytes))); if (manifest.slug !== envelope.slug) return Response.json({ error: "Manifest slug mismatch" }, { status: 400 });
    const unpacked = unzipSync(new Uint8Array(artifactBytes));
    for (const name of Object.keys(unpacked)) {
      if (name.startsWith("/") || name.split("/").includes("..") || name.includes("\\")) return Response.json({ error: `Unsafe archive entry: ${name}` }, { status: 400 });
    }
    const zippedManifest = unpacked["manifest.json"];
    if (!zippedManifest) return Response.json({ error: "Artifact is missing manifest.json" }, { status: 400 });
    if ((await digest(ownedBuffer(zippedManifest))).hex !== envelope.manifestSha256) return Response.json({ error: "Artifact manifest does not match signed manifest" }, { status: 400 });
    SlopManifestSchema.parse(JSON.parse(new TextDecoder().decode(zippedManifest)));
    const publicKey = decode(envelope.publicKey); if ((await digest(publicKey.buffer as ArrayBuffer)).hex.slice(0, 32) !== envelope.publisherKeyId) return Response.json({ error: "Publisher key id mismatch" }, { status: 400 });
    const imported = await crypto.subtle.importKey("raw", ownedBuffer(publicKey), { name: "Ed25519" }, false, ["verify"]); if (!await crypto.subtle.verify("Ed25519", imported, ownedBuffer(decode(signature)), ownedBuffer(canonicalPublishEnvelope(envelope)))) return Response.json({ error: "Invalid publisher signature" }, { status: 401 });
    const artifactKey = `artifacts/sha256/${artifactHash.hex}.slop.zip`; await env.ARTIFACTS.put(artifactKey, artifactBytes, { sha256: artifactHash.raw, httpMetadata: { contentType: "application/zip", cacheControl: "public, max-age=31536000, immutable" } });
    const screenshots = await Promise.all(shots.map(async (value, index) => { const file = value as File; const bytes = await file.arrayBuffer(); const hash = await digest(bytes); const expected = envelope.screenshots[index]; if (!expected || hash.hex !== expected.sha256 || bytes.byteLength !== expected.bytes || file.type !== expected.contentType) throw new Error("Screenshot integrity check failed"); const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"; const key = `screenshots/sha256/${hash.hex}.${extension}`; await env.ARTIFACTS.put(key, bytes, { sha256: hash.raw, httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } }); return { key, sha256: hash.hex, bytes: bytes.byteLength, contentType: file.type }; }));
    const finalize = await fetch(`${env.CONVEX_SITE_URL}/internal/publish`, { method: "POST", headers: { authorization: `Bearer ${env.HITSLOP_INTERNAL_SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ requestId: envelope.requestId, publisherKeyId: envelope.publisherKeyId, publicKey: envelope.publicKey, displayName: envelope.displayName, slug: envelope.slug, artifactKey, artifactSha256: artifactHash.hex, artifactBytes: artifactBytes.byteLength, screenshots, manifest }) });
    if (!finalize.ok) throw new Error(`Convex finalize failed: ${await finalize.text()}`); return Response.json(await finalize.json(), { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
} } } });
