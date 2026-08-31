import { afterEach, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { mockHostPlugin } from "../src/dev.ts";

let root: string | undefined;
let closeEmitter: EventEmitter | undefined;

afterEach(async () => {
  closeEmitter?.emit("close"); closeEmitter = undefined;
  if (root) await rm(root, { recursive: true, force: true }); root = undefined;
});

test("mounted mock bridge opens and persists both canonical stores", async () => {
  root = await mkdtemp(join(tmpdir(), "hitslop-dev-bridge-"));
  closeEmitter = new EventEmitter();
  let mountedAt = "";
  let middleware: ((request: IncomingMessage, response: ServerResponse) => Promise<void>) | undefined;
  const plugin = mockHostPlugin(root);
  const configure = plugin.configureServer;
  if (typeof configure !== "function") throw new Error("mock host plugin is missing its server hook");
  const configureServer = configure as unknown as (server: ViteDevServer) => void;
  configureServer({
    httpServer: closeEmitter,
    middlewares: {
      use(path: string, handler: typeof middleware) {
        mountedAt = path;
        middleware = handler;
      },
    },
  } as unknown as ViteDevServer);
  expect(mountedAt).toBe("/__hitslop");

  async function call(path: string, body: Record<string, unknown> = {}) {
    if (!middleware) throw new Error("mock host middleware was not installed");
    const request = Readable.from([JSON.stringify(body)]) as IncomingMessage;
    request.url = path;
    let status = 200;
    let payload = "";
    const response = {
      get statusCode() { return status; },
      set statusCode(value: number) { status = value; },
      setHeader() {},
      end(value: string) { payload = value; },
    } as unknown as ServerResponse;
    await middleware(request, response);
    return { status, value: JSON.parse(payload) as unknown };
  }

  // Connect strips the mount prefix before invoking middleware. This was the
  // path shape that previously fell through to the bridge's Not found branch.
  const opened = await call("/json/open", { value: { count: 1 } });
  expect(opened.status).toBe(200);
  const first = opened.value as { value: { count: number }; revision: string };
  expect(first.value.count).toBe(1);

  const written = await call("/json/write", { value: { count: 2 }, expectedRevision: first.revision });
  expect(written.status).toBe(200);
  const read = await call("/json/read");
  expect((read.value as { value: { count: number } }).value.count).toBe(2);

  expect((await call("/sqlite/execute", { sql: "CREATE TABLE note (value TEXT NOT NULL)" })).status).toBe(200);
  expect((await call("/sqlite/execute", { sql: "INSERT INTO note (value) VALUES (?)", parameters: ["saved"] })).status).toBe(200);
  const query = await call("/sqlite/query", { sql: "SELECT value FROM note" });
  expect(query.value).toEqual([{ value: "saved" }]);
}, 15_000);
