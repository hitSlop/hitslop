import type { APIInputs } from "@hitslop/api";
import { parsePublishEnvelope, parseManifest, canonicalPublishEnvelope } from "@hitslop/schema";
import { unzipSync } from "fflate";
import { validatePackageMetadata, validateStaticImages } from "./publish-package.ts";
import { inspectZip, validateSkin } from "./publish-validation.ts";
import { digest } from "./crypto.ts";
import { fail } from "./errors.ts";
import type { Registry } from "./store.ts";

const MAX_MANIFEST_BYTES = 64 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });
function inputValue<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid publish input");
  }
}
const decode = (value: string): Uint8Array =>
  inputValue(() =>
    Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) =>
      character.charCodeAt(0),
    ),
  );
const owned = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;

export async function handlePublish(input: APIInputs["catalog"]["publish"], registry: Registry) {
  const { envelope: envelopeValue, artifact, signature: signatureValue } = input;
  const envelope = inputValue(() => parsePublishEnvelope(JSON.parse(envelopeValue)));
  if (Math.abs(Date.now() - envelope.timestamp) > 5 * 60_000) fail("Publish envelope expired");
  if (artifact.size !== envelope.artifactBytes)
    fail("Artifact size does not match signed envelope");
  const publicKey = decode(envelope.publicKey);
  if ((await digest(owned(publicKey))).slice(0, 32) !== envelope.publisherKeyId)
    fail("Publisher key id mismatch");
  const signature = decode(signatureValue);
  if (publicKey.length !== 32 || signature.length !== 64)
    fail("Invalid publisher key or signature");
  const imported = await crypto.subtle.importKey(
    "raw",
    owned(publicKey),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "Ed25519",
      imported,
      owned(signature),
      owned(canonicalPublishEnvelope(envelope)),
    ))
  ) {
    fail("Invalid publisher signature", 401);
  }
  const artifactBytes = new Uint8Array(await artifact.arrayBuffer());
  const artifactHash = await digest(artifactBytes);
  if (artifactHash !== envelope.artifactSha256)
    fail("Artifact hash does not match signed envelope");
  inputValue(() => inspectZip(artifactBytes));
  const unpacked = inputValue(() => unzipSync(artifactBytes));
  inputValue(() => validatePackageMetadata(unpacked));
  const manifestBytes = unpacked["manifest.json"];
  if (!manifestBytes || !unpacked["app.html"])
    fail("Artifact must contain manifest.json and app.html");
  if (!manifestBytes || manifestBytes.byteLength > MAX_MANIFEST_BYTES)
    fail("manifest.json exceeds 64 KiB");
  const { preview, icon } = inputValue(() => validateStaticImages(unpacked));
  const manifest = inputValue(() => parseManifest(JSON.parse(decoder.decode(manifestBytes))));
  inputValue(() => validateSkin(unpacked, manifest));
  const previewHash = await digest(owned(preview));
  const iconHash = await digest(owned(icon));
  const artifactKey = `artifacts/sha256/${artifactHash}.slop.zip`;
  const previewKey = `previews/sha256/${previewHash}.png`;
  const iconKey = `icons/sha256/${iconHash}.png`;
  await Promise.all([
    registry.putObject(artifactKey, artifactBytes, "application/zip"),
    registry.putObject(previewKey, preview, "image/png"),
    registry.putObject(iconKey, icon, "image/png"),
  ]);
  const result = await registry.finalizePublish({
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
  return result;
}
