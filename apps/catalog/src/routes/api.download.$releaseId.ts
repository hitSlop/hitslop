import { createFileRoute } from "@tanstack/react-router";
import { convexClient, api } from "../convex";
import { workerEnv } from "../server-env";

export const Route = createFileRoute("/api/download/$releaseId")({ server: { handlers: { GET: async ({ params, request }) => {
  const env = workerEnv(); const client = convexClient(env.CONVEX_URL); const release = await client.query(api.catalog.release, { releaseId: params.releaseId as never });
  if (!release) return new Response("Release not found", { status: 404 });
  const prior = request.headers.get("cookie")?.match(/(?:^|;\s*)hitslop_installation=([^;]+)/)?.[1]; const installationId = prior ? decodeURIComponent(prior) : crypto.randomUUID(); await client.mutation(api.catalog.recordDownload, { installationId, templateId: release.templateId, releaseId: release._id });
  const location = new URL("/api/artifact", request.url); location.searchParams.set("key", release.artifactKey); const headers = new Headers({ location: location.toString(), "cache-control": "private, no-store" }); if (!prior) headers.append("set-cookie", `hitslop_installation=${encodeURIComponent(installationId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`); return new Response(null, { status: 302, headers });
} } } });
