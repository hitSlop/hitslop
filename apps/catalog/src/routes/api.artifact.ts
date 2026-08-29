import { createFileRoute } from "@tanstack/react-router";
import { workerEnv } from "../server-env";

export const Route = createFileRoute("/api/artifact")({ server: { handlers: { GET: async ({ request }) => {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !(key.startsWith("artifacts/") || key.startsWith("screenshots/")) || key.includes("..")) return new Response("Invalid artifact key", { status: 400 });
  const object = await workerEnv().ARTIFACTS.get(key);
  if (!object) return new Response("Artifact not found", { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
} } } });
