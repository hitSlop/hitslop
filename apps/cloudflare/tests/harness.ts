import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
export function workerHarness(key = "isolated-room-integration-test-key") {
  let directory: string, origin: string, process: ReturnType<typeof Bun.spawn>;
  let port: number;
  async function start() {
    process = Bun.spawn(
      [
        "node",
        resolve(import.meta.dir, "../node_modules/wrangler/bin/wrangler.js"),
        "dev",
        "tests/worker.ts",
        "--local",
        "--port",
        String(port),
        "--persist-to",
        directory,
        "--var",
        `TOKEN_KEY:${key}`,
      ],
      {
        cwd: resolve(import.meta.dir, ".."),
        stdout: "ignore",
        stderr: "inherit",
        env: {
          ...Bun.env,
          CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
          WRANGLER_SEND_METRICS: "false",
        },
      },
    );
    for (let i = 0; i < 400; i++) {
      if (process.exitCode !== null) throw new Error(`Wrangler exited ${process.exitCode}`);
      try {
        await fetch(origin);
        return;
      } catch {
        await Bun.sleep(50);
      }
    }
    throw new Error("Wrangler startup timed out");
  }
  async function stop() {
    process?.kill();
    if (process) await process.exited;
  }
  async function initialize() {
    directory = await mkdtemp(resolve(tmpdir(), "hitslop-room-test-"));
    const reserve = Bun.serve({ port: 0, fetch: () => new Response() });
    port = reserve.port!;
    reserve.stop(true);
    origin = `http://127.0.0.1:${port}`;
    const migration = Bun.spawn(
      [
        "node",
        resolve(import.meta.dir, "../node_modules/wrangler/bin/wrangler.js"),
        "d1",
        "execute",
        "DB",
        "--local",
        "--persist-to",
        directory,
        "--file",
        resolve(import.meta.dir, "../migrations/0001_init.sql"),
        "--yes",
      ],
      {
        cwd: resolve(import.meta.dir, ".."),
        stdout: "ignore",
        stderr: "inherit",
        env: {
          ...Bun.env,
          CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
          WRANGLER_SEND_METRICS: "false",
        },
      },
    );
    if ((await migration.exited) !== 0) throw new Error("Local test migration failed");
    await start();
  }
  async function dispose() {
    await stop();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
  return {
    get origin() {
      return origin;
    },
    key,
    initialize,
    start,
    stop,
    dispose,
    call(path: string, init?: RequestInit) {
      return fetch(new URL(path, origin), init);
    },
    async fixture(action: string, value?: unknown) {
      const response = await fetch(`${origin}/__test/fixture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  };
}
