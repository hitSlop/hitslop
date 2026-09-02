import { join, resolve } from "node:path";
import { cp, mkdir, rm } from "node:fs/promises";
import { canonicalPublishEnvelope, type PublishEnvelope } from "@hitslop/schema";
import { buildSlop, packSlop } from "./project.ts";
import { runNative } from "./dev.ts";
import { getIdentity, sign } from "./identity.ts";
import { validateTemplatePackage } from "./install.ts";
import { validateIconPng, validateStaticPng, writeDefaultIcon } from "./static-preview.ts";

const blobPart = (bytes: Uint8Array): BlobPart => Uint8Array.from(bytes);

export async function publishSlop(root: string, flags: { registry?: string; preview?: string; icon?: string }): Promise<string> {
  const built = await buildSlop(root);
  const quickLook = join(built.directory, "QuickLook");
  const preview = join(quickLook, "Preview.png");
  await mkdir(quickLook, { recursive: true });
  if (flags.preview) await cp(resolve(flags.preview), preview);
  else await runNative(["screenshot", built.directory, "--output", preview]);
  validateStaticPng(new Uint8Array(await Bun.file(preview).arrayBuffer()), "The template preview");
  const icon = join(quickLook, "Icon.png");
  if (flags.icon) await cp(resolve(flags.icon), icon);
  else {
    await rm(icon, { force: true });
    await runNative(["screenshot", built.directory, "--target", "icon", "--if-present", "--output", icon]);
    if (!await Bun.file(icon).exists()) await writeDefaultIcon(preview, icon);
  }
  validateIconPng(new Uint8Array(await Bun.file(icon).arrayBuffer()));
  // Static rendering may initialize a lazy store. Published templates never
  // carry seed data; each created document initializes its own state.
  await rm(join(built.directory, "stores"), { recursive: true, force: true });
  await validateTemplatePackage(built.directory, { requirePreview: true });

  const packed = await packSlop(built.directory);
  const identity = await getIdentity();
  const envelope: PublishEnvelope = {
    format: "hitslop-publish/2",
    requestId: crypto.randomUUID(),
    publisherKeyId: identity.keyId,
    publicKey: identity.publicKey,
    displayName: identity.displayName,
    artifactSha256: packed.sha256,
    artifactBytes: packed.bytes.byteLength,
    timestamp: Date.now(),
  };
  const signature = await sign(canonicalPublishEnvelope(envelope), identity);
  const form = new FormData();
  form.set("envelope", JSON.stringify(envelope));
  form.set("signature", signature);
  form.set("artifact", new Blob([blobPart(packed.bytes)], { type: "application/zip" }), `${built.manifest.slug}.slop.zip`);
  const endpoint = flags.registry ?? process.env.HITSLOP_REGISTRY_URL ?? "https://hitslop.app/api/publish";
  const response = await fetch(endpoint, { method: "POST", body: form });
  const body = await response.text();
  if (!response.ok) throw new Error(`Publish failed (${response.status}): ${body}`);
  return body;
}
