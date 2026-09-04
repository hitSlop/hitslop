import { PublishEnvelopeSchema, SlopManifestSchema, canonicalPublishEnvelope } from "@hitslop/schema";
import { unzipSync } from "fflate";
import type { RegistryBackend } from "./backend.js";
import { validatePackageMetadata, validateStaticImages } from "./publish-package.js";
import { inspectZip, validateSkin } from "./publish-validation.js";

const MAX_MANIFEST_BYTES = 64 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const decode = (value: string): Uint8Array => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
const ownedBuffer = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;
const digest = async (bytes: ArrayBuffer): Promise<string> => hex(await crypto.subtle.digest("SHA-256", bytes));

export async function handlePublish(request: Request, backend: RegistryBackend): Promise<Response> {
  try {
    const form = await request.formData();
    const envelopeValue = form.get("envelope");
    const artifact = form.get("artifact");
    const signatureValue = form.get("signature");
    if (typeof envelopeValue !== "string" || typeof signatureValue !== "string" || !(artifact instanceof File)) {
      return Response.json({ error: "Missing publish fields" }, { status: 400 });
    }

    const envelope = PublishEnvelopeSchema.parse(JSON.parse(envelopeValue));
    if (Math.abs(Date.now() - envelope.timestamp) > 5 * 60_000) return Response.json({ error: "Publish envelope expired" }, { status: 400 });
    if (artifact.size !== envelope.artifactBytes) return Response.json({ error: "Artifact size does not match signed envelope" }, { status: 400 });

    const publicKey = decode(envelope.publicKey);
    if ((await digest(ownedBuffer(publicKey))).slice(0, 32) !== envelope.publisherKeyId) return Response.json({ error: "Publisher key id mismatch" }, { status: 400 });
    const imported = await crypto.subtle.importKey("raw", ownedBuffer(publicKey), { name: "Ed25519" }, false, ["verify"]);
    if (!await crypto.subtle.verify("Ed25519", imported, ownedBuffer(decode(signatureValue)), ownedBuffer(canonicalPublishEnvelope(envelope)))) {
      return Response.json({ error: "Invalid publisher signature" }, { status: 401 });
    }

    const artifactBytes = await artifact.arrayBuffer();
    const artifactHash = await digest(artifactBytes);
    if (artifactHash !== envelope.artifactSha256) return Response.json({ error: "Artifact hash does not match signed envelope" }, { status: 400 });
    const zipped = new Uint8Array(artifactBytes);
    inspectZip(zipped);
    const unpacked = unzipSync(zipped);
    validatePackageMetadata(unpacked);
    const manifestBytes = unpacked["manifest.json"];
    if (!manifestBytes || !unpacked["app.html"]) throw new Error("Artifact must contain manifest.json and app.html");
    if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new Error("manifest.json exceeds 64 KiB");
    const { preview, icon } = validateStaticImages(unpacked);
    const manifest = SlopManifestSchema.parse(JSON.parse(decoder.decode(manifestBytes)));
    validateSkin(unpacked, manifest);

    const previewHash = await digest(ownedBuffer(preview));
    const iconHash = await digest(ownedBuffer(icon));
    const artifactKey = `artifacts/sha256/${artifactHash}.slop.zip`;
    const previewKey = `previews/sha256/${previewHash}.png`;
    const iconKey = `icons/sha256/${iconHash}.png`;
    await Promise.all([
      backend.putObject(artifactKey, zipped, "application/zip"),
      backend.putObject(previewKey, preview, "image/png"),
      backend.putObject(iconKey, icon, "image/png"),
    ]);

    const result = await backend.finalizePublish({
      requestId: envelope.requestId,
      publisherKeyId: envelope.publisherKeyId,
      publicKey: envelope.publicKey,
      artifactKey,
      artifactSha256: artifactHash,
      artifactBytes: artifactBytes.byteLength,
      previewKey,
      previewSha256: previewHash,
      previewBytes: preview.byteLength,
      iconKey,
      iconSha256: iconHash,
      iconBytes: icon.byteLength,
      manifest,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
