import { createFileRoute } from "@tanstack/react-router";
import { convexClient, api } from "../convex";
import { workerEnv } from "../server-env";

export const Route = createFileRoute("/api/catalog")({ server: { handlers: { GET: async ({ request }) => {
  const term = new URL(request.url).searchParams.get("term") ?? ""; const env = workerEnv();
  return Response.json(await convexClient(env.CONVEX_URL).query(api.catalog.search, { term, limit: 36 }));
} } } });
