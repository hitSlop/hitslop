import type { APIEnvironment } from "./env";
import { handleArtifact } from "./artifacts";
import { handleDownload } from "./download";
import { handlePublish } from "./publish";

const methodNotAllowed = (allowed: string): Response => new Response("Method not allowed", { status: 405, headers: { allow: allowed } });

export async function route(request: Request, env: APIEnvironment): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/publish") return request.method === "POST" ? handlePublish(request, env) : methodNotAllowed("POST");
  if (pathname === "/api/artifact") return request.method === "GET" ? handleArtifact(request, env) : methodNotAllowed("GET");
  const download = pathname.match(/^\/api\/download\/([^/]+)$/);
  if (download) return request.method === "GET" ? handleDownload(request, env, decodeURIComponent(download[1]!)) : methodNotAllowed("GET");
  return new Response("Not found", { status: 404 });
}

export default {
  fetch(request: Request, env: APIEnvironment): Promise<Response> {
    return route(request, env);
  },
} satisfies ExportedHandler<APIEnvironment>;
