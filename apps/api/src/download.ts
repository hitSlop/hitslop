import type { APIEnvironment } from "./env";
import { api, convexClient } from "./convex";

export async function handleDownload(request: Request, env: APIEnvironment, releaseId: string): Promise<Response> {
  const release = await convexClient(env.CONVEX_URL).query(api.catalog.release, { releaseId: releaseId as never });
  if (!release) return new Response("Release not found", { status: 404 });
  const location = new URL("/api/artifact", request.url);
  location.searchParams.set("key", release.artifactKey);
  return new Response(null, { status: 302, headers: { location: location.toString(), "cache-control": "private, no-store" } });
}
