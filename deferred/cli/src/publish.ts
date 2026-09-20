import { createAPIClient } from "@hitslop/api/client";
import { canonicalPublishEnvelope, type PublishEnvelope } from "@hitslop/schema";
import { buildSlop, packSlop } from "./project.ts";
import { getIdentity, sign } from "./identity.ts";
import { prepareTemplateCaptures } from "./template-capture.ts";

const blobPart = (bytes: Uint8Array): BlobPart => Uint8Array.from(bytes);

export async function publishSlop(
  root: string,
  flags: { registry?: string; preview?: string; icon?: string },
): Promise<string> {
  const built = await buildSlop(root);
  await prepareTemplateCaptures(built.directory, flags);

  const packed = await packSlop(built.directory);
  const identity = await getIdentity();
  const envelope: PublishEnvelope = {
    format: "hitslop-publish/1",
    requestId: crypto.randomUUID(),
    publisherKeyId: identity.keyId,
    publicKey: identity.publicKey,
    artifactSha256: packed.sha256,
    artifactBytes: packed.bytes.byteLength,
    timestamp: Date.now(),
  };
  const signature = await sign(canonicalPublishEnvelope(envelope), identity);
  const endpoint = flags.registry ?? process.env.HITSLOP_REGISTRY_URL ?? "https://api.hitslop.com";
  const result = await createAPIClient(endpoint).catalog.publish({
    envelope: JSON.stringify(envelope),
    signature,
    artifact: new File([blobPart(packed.bytes)], `${built.manifest.slug}.slop.zip`, {
      type: "application/zip",
    }),
  });
  return JSON.stringify(result);
}
