import type { RegistryBackend } from "./backend.js";
import type { CatalogResponse } from "@hitslop/schema";
import { handlePublish } from "./publish.js";

const contentAddressedKey = /^(?:artifacts\/sha256\/[a-f0-9]{64}\.slop\.zip|(?:previews|icons)\/sha256\/[a-f0-9]{64}\.png)$/;
const methodNotAllowed = (allowed: string): Response => new Response("Method not allowed", { status: 405, headers: { allow: allowed } });
const catalogHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
};

function artifactURL(request: Request, key: string): string {
  const requestURL = new URL(request.url);
  const origin = requestURL.hostname === "127.0.0.1" || requestURL.hostname === "localhost"
    ? requestURL.origin
    : "https://api.hitslop.com";
  const url = new URL("/api/artifact", origin);
  url.searchParams.set("key", key);
  return url.href;
}

async function handleCatalog(request: Request, backend: RegistryBackend): Promise<Response> {
  try {
    const templates = (await backend.listTemplates()).map((template) => ({
      ...template,
      preview: { ...template.preview, url: artifactURL(request, template.preview.key) },
      icon: { ...template.icon, url: artifactURL(request, template.icon.key) },
      download: { ...template.download, url: artifactURL(request, template.download.key) },
    })).map(({ preview, icon, download, ...template }) => ({
      ...template,
      preview: { url: preview.url, sha256: preview.sha256, bytes: preview.bytes },
      icon: { url: icon.url, sha256: icon.sha256, bytes: icon.bytes },
      download: { url: download.url, sha256: download.sha256, bytes: download.bytes },
    }));
    const catalog = { version: 1, templates } satisfies CatalogResponse;
    return Response.json(catalog, { headers: catalogHeaders });
  } catch (error) {
    console.error("Public catalog load failed", error);
    return Response.json({ error: "Catalog temporarily unavailable" }, {
      status: 503,
      headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
    });
  }
}

async function handleArtifact(request: Request, backend: RegistryBackend): Promise<Response> {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !contentAddressedKey.test(key)) return new Response("Invalid artifact key", { status: 400 });
  if (!await backend.objectExists(key)) return new Response("Artifact not found", { status: 404 });
  return new Response(null, { status: 302, headers: { location: backend.mediaURL(key), "cache-control": "public, max-age=31536000, immutable" } });
}

export async function route(request: Request, backend: RegistryBackend): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/publish") return request.method === "POST" ? handlePublish(request, backend) : methodNotAllowed("POST");
  if (pathname === "/api/artifact") return request.method === "GET" ? handleArtifact(request, backend) : methodNotAllowed("GET");
  if (pathname === "/api/catalog") return request.method === "GET" ? handleCatalog(request, backend) : methodNotAllowed("GET");
  return new Response("Not found", { status: 404 });
}
