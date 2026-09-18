import { route } from "./test-auth.ts";
import { route as productionRoute, type Env } from "../src/index.ts";
import { CloudflareRegistry, type FinalizePublishInput } from "../src/store.ts";
export { SlopRoom } from "../src/room.ts";
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/__test/fixture" && request.method === "POST") {
      const { action, value } = (await request.json()) as { action: string; value: any };
      const registry = new CloudflareRegistry(env.DB!, env.BLOBS!);
      if (action === "reset") {
        await env.DB!.batch(
          ["publish_requests", "releases", "templates", "publishers", "documents"].map((table) =>
            env.DB!.prepare(`DELETE FROM ${table}`),
          ),
        );
        const objects = await env.BLOBS!.list();
        if (objects.objects.length)
          await env.BLOBS!.delete(objects.objects.map((item) => item.key));
        return Response.json(null);
      }
      if (action === "publish")
        return Response.json(await registry.finalizePublish(value as FinalizePublishInput));
      if (action === "object") {
        await registry.putObject(value.key, new Uint8Array(value.bytes), value.mime);
        return Response.json(null);
      }
      return new Response("Unknown fixture", { status: 400 });
    }
    if (url.pathname.startsWith("/__production/")) {
      url.pathname = url.pathname.slice("/__production".length);
      return productionRoute(new Request(url.href, request), {
        ...env,
        ALLOW_TEST_AUTH: "true",
      } as Env);
    }
    if (url.pathname === "/__test/no-bindings")
      return productionRoute(new Request(new URL("/api/catalog", url).href), {
        TOKEN_KEY: env.TOKEN_KEY,
        FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID,
      });
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;
