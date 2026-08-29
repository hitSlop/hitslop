import { httpRouter } from "convex/server";
import { httpAction, env } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
http.route({ path: "/internal/publish", method: "POST", handler: httpAction(async (ctx, request) => {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!env.HITSLOP_INTERNAL_SECRET || supplied !== env.HITSLOP_INTERNAL_SECRET) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body: unknown = await request.json(); if (!body || typeof body !== "object") return Response.json({ error: "Invalid body" }, { status: 400 });
  const value = body as Record<string, unknown>;
  for (const key of ["requestId", "publisherKeyId", "publicKey", "displayName", "slug", "artifactKey", "artifactSha256"]) if (typeof value[key] !== "string") return Response.json({ error: `Invalid ${key}` }, { status: 400 });
  if (typeof value.artifactBytes !== "number" || !Array.isArray(value.screenshots) || typeof value.manifest !== "object") return Response.json({ error: "Invalid release metadata" }, { status: 400 });
  const result = await ctx.runMutation(internal.publish.finalize, value as never); return Response.json(result);
}) });
export default http;
