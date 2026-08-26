import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { exec, getAsset, getView, query, readMeta } from "./db.ts";
import { watchSlop, type Change } from "./watch.ts";

const RUNTIME_PATH = join(import.meta.dir, "../runtime/slop.js");

function injectRuntime(html: string): string {
  if (html.includes("/slop.js")) return html;
  const tag = `<script src="/slop.js"></script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => `${h}\n${tag}`);
  return `${tag}\n${html}`;
}

type Client = { send: (change: Change) => void };

export type ServeOpts = {
  db: Database;
  slopPath: string;
  port?: number;
  hostname?: string;
};

export async function serveSlop(opts: ServeOpts): Promise<{
  url: string;
  port: number;
  stop: () => void;
  meta: Record<string, string>;
}> {
  const { db, slopPath } = opts;
  const hostname = opts.hostname ?? "127.0.0.1";
  const clients = new Set<Client>();
  const runtime = await Bun.file(RUNTIME_PATH).text();

  const stopWatch = watchSlop(slopPath, db, (change) => {
    for (const c of clients) c.send(change);
  });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });

  const readBody = async (req: Request): Promise<{ sql: string; params: unknown[] }> => {
    const body = (await req.json()) as { sql?: unknown; params?: unknown };
    if (typeof body.sql !== "string" || !body.sql.trim()) {
      throw new Error("sql is required");
    }
    const params = Array.isArray(body.params) ? body.params : [];
    return { sql: body.sql, params };
  };

  const server = Bun.serve({
    hostname,
    port: opts.port ?? 0,
    idleTimeout: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;

      if (pathname === "/slop.js") {
        return new Response(runtime, {
          headers: { "content-type": "text/javascript; charset=utf-8" },
        });
      }

      if (pathname === "/slop/meta") {
        return json({ ...readMeta(db), file: slopPath });
      }

      if (pathname === "/slop/query" && req.method === "POST") {
        try {
          const { sql, params } = await readBody(req);
          return json(query(db, sql, params));
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 400);
        }
      }

      if (pathname === "/slop/exec" && req.method === "POST") {
        try {
          const { sql, params } = await readBody(req);
          return json(exec(db, sql, params));
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 400);
        }
      }

      if (pathname === "/slop/events") {
        let client: Client | undefined;
        const stream = new ReadableStream({
          start(controller) {
            const send = (change: Change) => {
              try {
                controller.enqueue(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
              } catch {
                /* closed */
              }
            };
            client = { send };
            clients.add(client);
            controller.enqueue(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
          },
          cancel() {
            if (client) clients.delete(client);
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        });
      }

      if (pathname.startsWith("/assets/")) {
        const asset = getAsset(db, pathname.slice("/assets".length));
        if (!asset) return new Response("not found", { status: 404 });
        return new Response(asset.body, { headers: { "content-type": asset.mime } });
      }

      if (pathname === "/" || pathname === "/index.html") {
        const view = getView(db, "/");
        if (!view) return new Response("this .slop has no view at '/'", { status: 404 });
        return new Response(injectRuntime(view.body), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      return new Response("not found", { status: 404 });
    },
  });

  const url = `http://${hostname}:${server.port}/`;
  const meta = readMeta(db);

  return {
    url,
    port: server.port,
    meta,
    stop() {
      stopWatch();
      for (const _ of clients) {
        /* drop */
      }
      clients.clear();
      server.stop(true);
    },
  };
}
