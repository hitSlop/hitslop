import { createFileRoute } from "@tanstack/react-router";
import { convexClient, api } from "../convex";
import { workerEnv } from "../server-env";

export const Route = createFileRoute("/api/download/$releaseId")({ server: { handlers: { GET: async ({ params, request }) => {
  const env = workerEnv(); const client = convexClient(env.CONVEX_URL); const release = await client.query(api.catalog.release, { releaseId: params.releaseId as never });
  if (!release) return new Response("Release not found", { status: 404 });
  const location = new URL("/api/artifact", request.url);
  location.searchParams.set("key", release.artifactKey);
  return new Response(null, { status: 302, headers: { location: location.toString(), "cache-control": "private, no-store" } });
} } } });
