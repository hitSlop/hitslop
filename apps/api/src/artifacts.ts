import type { APIEnvironment } from "./env";

const contentAddressedKey = /^(?:artifacts\/sha256\/[a-f0-9]{64}\.slop\.zip|(?:previews|icons)\/sha256\/[a-f0-9]{64}\.png)$/;

export async function handleArtifact(request: Request, env: APIEnvironment): Promise<Response> {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !contentAddressedKey.test(key)) return new Response("Invalid artifact key", { status: 400 });
  const object = await env.ARTIFACTS.get(key);
  if (!object) return new Response("Artifact not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
