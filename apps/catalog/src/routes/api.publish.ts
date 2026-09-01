import { createFileRoute } from "@tanstack/react-router";
import { PublishEnvelopeSchema, SlopManifestSchema, canonicalPublishEnvelope } from "@hitslop/schema";
import { unzipSync } from "fflate";
import { workerEnv } from "../server-env";
import { validatePackagePath, validateStaticPreviews } from "../publish-package";
import { inspectZip, validateSkin } from "../publish-validation";

const MAX_MANIFEST_BYTES = 64 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const decode = (value: string): Uint8Array => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
const ownedBuffer = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;
const digest = async (bytes: ArrayBuffer): Promise<{ raw: ArrayBuffer; hex: string }> => {
  const raw = await crypto.subtle.digest("SHA-256", bytes);
  return { raw, hex: hex(raw) };
};

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
