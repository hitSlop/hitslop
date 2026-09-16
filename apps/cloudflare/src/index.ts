import { authenticate, type Authenticate } from "./auth.ts";
import manifestSchema from "../public/schemas/v1/manifest.schema.json";
import { BodyLimitPlugin } from "@orpc/server/fetch";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { verifyRoomToken } from "./crypto.ts";
import { errorResponse, fail } from "./errors.ts";
import { router } from "./router.ts";
import type { SlopRoom } from "./room.ts";
import { CloudflareRegistry, type Registry } from "./store.ts";

export interface Env {
  DB?: D1Database;
  BLOBS?: R2Bucket;
  ROOMS?: DurableObjectNamespace<SlopRoom>;
  TOKEN_KEY: string;
  FIREBASE_PROJECT_ID: string;
}
export function registryFrom(env: Env, fallback?: Registry): Registry {
  if (fallback) return fallback;
  if (env.DB && env.BLOBS) return new CloudflareRegistry(env.DB, env.BLOBS);
  return fail("Catalog storage is unavailable", 503);
}
const handler = new OpenAPIHandler(router, {
  plugins: [new BodyLimitPlugin({ maxBodySize: 26 * 1024 * 1024 })],
});
export async function route(
  request: Request,
  env: Env,
  registry?: Registry,
  authenticateRequest: Authenticate = authenticate,
): Promise<Response> {
  const headers = new Headers({ "access-control-allow-origin": "*" });
  if (request.method === "OPTIONS") {
    headers.set(
      "access-control-allow-headers",
      "authorization,content-type,content-disposition,standard-server",
    );
    headers.set("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
    return new Response(null, { headers });
  }
  if (new URL(request.url).pathname === "/schemas/v1/manifest.schema.json") {
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response(null, { status: 405, headers: { allow: "GET,HEAD" } });
    headers.set("cache-control", "public, max-age=3600");
    headers.set("content-type", "application/schema+json");
    return new Response(request.method === "HEAD" ? null : JSON.stringify(manifestSchema), {
      headers,
    });
  }
  const socket = /^\/rooms\/([a-zA-Z0-9-]{1,80})\/socket$/.exec(new URL(request.url).pathname);
  if (socket) {
    try {
      if (request.method !== "GET")
        return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket")
        return new Response("Expected WebSocket upgrade", { status: 426 });
      if (!env.ROOMS) fail("Rooms are unavailable", 503);
      let claims;
      try {
        claims = await verifyRoomToken(
          env.TOKEN_KEY,
          request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
        );
      } catch {
        return fail("Unauthorized", 401);
      }
      if (claims.room !== socket[1]) fail("Wrong room route", 403);
      return await env.ROOMS!.getByName(socket[1]!).fetch(request);
    } catch (error) {
      return errorResponse(error);
    }
  }
  let storage: Registry;
  try {
    storage = registryFrom(env, registry);
  } catch (error) {
    return errorResponse(error);
  }
  const result = await handler.handle(request, {
    context: { request, env, registry: storage, headers, authenticate: authenticateRequest },
  });
  if (!result.matched) return new Response("Not found", { status: 404, headers });
  for (const [key, value] of headers) {
    // Never cache an error using a successful artifact's cache policy.
    if (key === "cache-control" && !result.response.ok) continue;
    result.response.headers.set(key, value);
  }
  return result.response;
}
