import { dirname, join } from "node:path";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { canonicalPublishEnvelope, type PublishEnvelope } from "@hitslop/schema";
import { buildSlop, packSlop, sha256 } from "./project.ts";
import { runNative } from "./dev.ts";
import { getIdentity, sign } from "./identity.ts";

const contentType = (path: string): "image/png" | "image/jpeg" | "image/webp" =>
  path.endsWith(".webp") ? "image/webp" : path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "image/png";

const blobPart = (bytes: Uint8Array): BlobPart => Uint8Array.from(bytes);

export async function publishSlop(root: string, flags: { registry?: string; screenshot?: string[]; publisher?: string }): Promise<string> {
  const built = await buildSlop(root);
  const screenshotPaths = flags.screenshot?.length ? flags.screenshot : [join(root, "screenshots/cover.png")];
  if (!await stat(screenshotPaths[0]!).then(() => true).catch(() => false)) {
    await mkdir(dirname(screenshotPaths[0]!), { recursive: true });
    await runNative(["screenshot", built.directory, "--output", screenshotPaths[0]!]);
  }
  const screenshots = await Promise.all(screenshotPaths.map(async (path) => {
    const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
    return { path, bytes, sha256: sha256(bytes), contentType: contentType(path) };
  }));
  if (screenshots[0]?.contentType !== "image/png") throw new Error("The primary screenshot must be a PNG so it can be used by Finder and Quick Look.");
  const quickLook = join(built.directory, "QuickLook");
  await mkdir(quickLook, { recursive: true });
  await writeFile(join(quickLook, "Preview.png"), screenshots[0].bytes);
  await writeFile(join(quickLook, "Thumbnail.png"), screenshots[0].bytes);
  const packed = await packSlop(built.directory);
  const identity = await getIdentity(flags.publisher ?? built.manifest.author.name);
  const manifestBytes = await Bun.file(join(built.directory, "manifest.json")).bytes();
  const envelope: PublishEnvelope = {
    format: "hitslop-publish/1",
    requestId: crypto.randomUUID(),
    publisherKeyId: identity.keyId,
    publicKey: identity.publicKey,
    displayName: identity.displayName,
    slug: built.manifest.slug,
    manifestSha256: sha256(manifestBytes),
    artifactSha256: packed.sha256,
    artifactBytes: packed.bytes.byteLength,
    screenshots: screenshots.map(({ sha256: hash, bytes, contentType: type }) => ({ sha256: hash, bytes: bytes.byteLength, contentType: type })),
    timestamp: Date.now(),
  };
  const signature = await sign(canonicalPublishEnvelope(envelope), identity);
  const form = new FormData();
  form.set("envelope", JSON.stringify(envelope));
  form.set("signature", signature);
  form.set("manifest", new Blob([blobPart(manifestBytes)], { type: "application/json" }), "manifest.json");
  form.set("artifact", new Blob([blobPart(packed.bytes)], { type: "application/zip" }), `${built.manifest.slug}.slop.zip`);
  screenshots.forEach((shot) => form.append("screenshots", new Blob([blobPart(shot.bytes)], { type: shot.contentType }), shot.path.split("/").at(-1)));
  const endpoint = flags.registry ?? process.env.HITSLOP_REGISTRY_URL ?? "https://hitslop.app/api/publish";
  const response = await fetch(endpoint, { method: "POST", body: form });
  const body = await response.text();
  if (!response.ok) throw new Error(`Publish failed (${response.status}): ${body}`);
  return body;
}
