import type { APIInputs } from "@hitslop/api";
import type { CatalogResponse } from "@hitslop/schema";
import { fail } from "./errors.ts";
import type { Registry } from "./store.ts";

export const catalogHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
};

export const artifactKey =
  /^(?:artifacts\/sha256\/[a-f0-9]{64}\.slop\.zip|(?:previews|icons)\/sha256\/[a-f0-9]{64}\.png|documents\/[a-zA-Z0-9-]{1,80}\/package\.slop\.zip)$/;

export function publicOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function artifactURL(request: Request, key: string): string {
  const url = new URL("/api/artifact", publicOrigin(request));
  url.searchParams.set("key", key);
  return url.href;
}

export async function handleCatalog(
  request: Request,
  registry: Registry,
  input: APIInputs["catalog"]["list"],
) {
  const cursor = input.cursor;
  const limit = Number(input.limit ?? "50");
  if (cursor && (cursor.length < 1 || cursor.length > 160)) fail("Invalid catalog cursor");
  const { templates, nextCursor } = await registry.listTemplates({
    ...(cursor ? { cursor } : {}),
    limit: Number.isFinite(limit) ? limit : 50,
  });
  const catalog = {
    version: 1,
    templates: templates.map((template) => ({
      ...template,
      preview: {
        url: artifactURL(request, template.preview.key),
        sha256: template.preview.sha256,
        bytes: template.preview.bytes,
      },
      icon: {
        url: artifactURL(request, template.icon.key),
        sha256: template.icon.sha256,
        bytes: template.icon.bytes,
      },
      download: {
        url: artifactURL(request, template.download.key),
        sha256: template.download.sha256,
        bytes: template.download.bytes,
      },
    })),
    ...(nextCursor ? { nextCursor } : {}),
  } satisfies CatalogResponse;
  return catalog;
}

export async function handleArtifact(registry: Registry, key: string) {
  if (!key || !artifactKey.test(key)) fail("Invalid artifact key");
  const object = await registry.getObject(key);
  if (!object) return fail("Artifact not found", 404);
  return new Blob([Uint8Array.from(object.bytes)], { type: object.contentType });
}

export async function handleRecordCreation(
  body: APIInputs["catalog"]["recordCreation"],
  registry: Registry,
) {
  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  if (!templateId || templateId.length > 160) fail("A valid templateId is required.");
  if (!(await registry.recordCreation(templateId))) fail("Template not found", 404);
  return { ok: true };
}
