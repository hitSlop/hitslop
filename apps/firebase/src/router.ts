import type { RegistryBackend } from "./backend.js";
import { handlePublish } from "./publish.js";

const contentAddressedKey = /^(?:artifacts\/sha256\/[a-f0-9]{64}\.slop\.zip|(?:previews|icons)\/sha256\/[a-f0-9]{64}\.png)$/;
const methodNotAllowed = (allowed: string): Response => new Response("Method not allowed", { status: 405, headers: { allow: allowed } });

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
  return new Response("Not found", { status: 404 });
}
