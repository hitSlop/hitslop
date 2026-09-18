import { afterEach, expect, test } from "bun:test";
import { compileModule } from "svelte/compiler";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "@hitslop/schema/document";
import { MemoryAuthority } from "@hitslop/schema/document-authority";
import type { Request, Result } from "@hitslop/schema/document-protocol";
import { registerDocumentWriter } from "../src/document-lifecycle.js";

Bun.plugin({
  name: "create-document-client-tests",
  setup(build) {
    build.onResolve({ filter: /^svelte$/ }, () => ({
      path: resolve(
        dirname(fileURLToPath(import.meta.resolve("svelte/package.json"))),
        "src/index-client.js",
      ),
    }));
    build.onLoad({ filter: /create-document\.svelte\.ts$/ }, async ({ path }) => ({
      contents: compileModule(
        new Bun.Transpiler({ loader: "ts" }).transformSync(
          (await Bun.file(path).text()).replace(
            /from ["']svelte["']/g,
            `from ${JSON.stringify(resolve(dirname(fileURLToPath(import.meta.resolve("svelte/package.json"))), "src/index-client.js"))}`,
          ),
        ),
        { filename: path, generate: "client" },
      ).js.code,
      loader: "js",
    }));
  },
});
const { createDocument } = await import("../src/create-document.svelte.ts");
// @ts-expect-error Svelte internal component harness has no public declarations.
const { effect_root, push, pop, render_effect, flush } = await import("svelte/internal/client");
const { flush: flushAll } = await import("@hitslop/runtime");
const schema = S.Document({ count: S.Integer({ minimum: 0 }), title: S.String() });
const fields = S.paths(schema),
  initial = { count: 0, title: "Initial" };
const originalWindow = globalThis.window;
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  globalThis.window = originalWindow;
});
function setup(failOpen = false) {
  const authority = new MemoryAuthority(schema, initial);
  let ready = 0,
    hostFlushes = 0,
    connected = true,
    failFlush = false;
  const connections = new Set<() => void>();
  globalThis.window = {
    slop: {
      ready: () => ready++,
      document: {
        get connected() {
          return connected;
        },
        get writable() {
          return connected;
        },
        open: async () => {
          if (failOpen) throw new Error("Failed open");
          return authority.open();
        },
        send: async (request: Request): Promise<Result> => authority.execute(request),
        subscribe: authority.subscribe.bind(authority),
        flush: async () => {
          hostFlushes++;
          if (failFlush) throw new Error("disk unavailable");
        },
        onConnection: (listener: () => void) => {
          connections.add(listener);
          return () => {
            connections.delete(listener);
          };
        },
      },
    },
  } as unknown as Window & typeof globalThis;
  let store!: ReturnType<typeof createDocument<typeof schema>>;
  const disposeRoot = effect_root(() => {
    push({}, true);
    store = createDocument({ schema, initial });
    pop();
  });
  flush();
  cleanups.push(async () => {
    failFlush = false;
    try {
      await store.destroy();
    } catch {
      /* failed initialization */
    }
    disposeRoot();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return {
    store,
    disposeRoot,
    ready: () => ready,
    flushes: () => hostFlushes,
    failFlush: (value: boolean) => {
      failFlush = value;
    },
    disconnect() {
      connected = false;
      for (const listener of connections) listener();
    },
  };
}

test("store owns readiness and cleanup; repeated explicit commands update immutable reads", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  flush();
  expect(h.ready()).toBe(1);
  expect(Object.isFrozen(h.store.data)).toBe(true);
  for (let n = 1; n <= 3; n++) {
    expect((await h.store.increment(fields.count)).ok).toBe(true);
    expect(h.store.data.count).toBe(n);
  }
  await h.store.destroy();
  const before = h.flushes();
  h.disposeRoot();
  await flushAll();
  expect(h.flushes()).toBe(before);
});

test("failed first open still signals ready and never advertises writable state", async () => {
  const h = setup(true);
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  flush();
  expect(h.ready()).toBe(1);
  expect(h.store.canWrite).toBe(false);
  expect(h.store.error?.message).toContain("Failed open");
  h.disposeRoot();
});

test("connection status is reactive without replacing the data snapshot", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  flush();
  let dataRuns = 0,
    statusRuns = 0;
  const disposeEffects = effect_root(() => {
    render_effect(() => {
      h.store.data;
      dataRuns++;
    });
    render_effect(() => {
      h.store.connected;
      statusRuns++;
    });
  });
  h.disconnect();
  flush();
  expect(h.store.connected).toBe(false);
  expect(dataRuns).toBe(1);
  expect(statusRuns).toBe(2);
  disposeEffects();
  await h.store.destroy();
  h.disposeRoot();
});

test("native flush permits a resolved rejection and unregisters after teardown", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  expect((await h.store.increment(fields.count, -1)).ok).toBe(false);
  await flushAll();
  await h.store.destroy();
  h.disposeRoot();
  const before = h.flushes();
  await flushAll();
  expect(h.flushes()).toBe(before);
});

test("failed destruction keeps recovery and the flush barrier registered", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  h.failFlush(true);
  await expect(h.store.destroy()).rejects.toThrow();
  await expect(flushAll()).rejects.toThrow();
  expect(h.store.error).not.toBeNull();
  h.failFlush(false);
  await h.store.destroy();
  h.disposeRoot();
  await flushAll();
});

test("store fields are stable, text is schema checked, and pending is path aware", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  const fields = h.store.fields;
  expect(h.store.fields).toBe(fields);
  expect(h.store.text(fields.title)).toBe(h.store.text(fields.title));
  expect(() => h.store.text(S.paths(S.Document({ title: S.String() })).title)).toThrow(
    "another schema",
  );
  const pending = h.store.increment(fields.count);
  expect(h.store.isPending(fields.count)).toBe(true);
  expect(h.store.isPending(fields.title)).toBe(false);
  await pending;
  expect(h.store.isPending(fields.count)).toBe(false);
});

test("mutation undo availability is reactive and stale undo does not block teardown", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  const result = await h.store.increment(fields.count);
  if (!result.ok || !result.undo) throw new Error("Missing undo");
  const seen: boolean[] = [];
  const stop = effect_root(() =>
    render_effect(() => {
      seen.push(result.canUndo);
    }),
  );
  flush();
  expect(seen.at(-1)).toBe(true);
  await h.store.set(fields.title, "Another change");
  flush();
  expect(seen.at(-1)).toBe(false);
  expect(await result.undo()).toMatchObject({ ok: false, error: { code: "stale_revision" } });
  await h.store.destroy();
  stop();
});

test("document mutation and undo wrappers preserve synchronous transaction guards", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  const result = await h.store.increment(fields.count);
  if (!result.ok || !result.undo) throw new Error("Missing undo");
  expect(
    await h.store.transaction((tx) => {
      void h.store.set(fields.count, 100);
      tx.increment(fields.count);
    }),
  ).toMatchObject({ ok: false, error: { code: "batch_usage" } });
  expect(
    await h.store.transaction((tx) => {
      void result.undo!();
      tx.increment(fields.count);
    }),
  ).toMatchObject({ ok: false, error: { code: "batch_usage" } });
  expect(h.store.data.count).toBe(1);
  expect((await result.undo()).ok).toBe(true);
  expect(h.store.data.count).toBe(0);
});

test("undo drains pending document writes before checking its revision", async () => {
  const h = setup();
  while (h.store.isLoading) await new Promise((resolve) => setTimeout(resolve, 0));
  const result = await h.store.increment(fields.count);
  if (!result.ok || !result.undo) throw new Error("Missing undo");
  let drained = false;
  const unregister = registerDocumentWriter(h.store, async () => {
    drained = true;
    await h.store.set(fields.title, "Pending edit");
  });
  try {
    expect(await result.undo()).toMatchObject({ ok: false, error: { code: "stale_revision" } });
    expect(drained).toBe(true);
    expect(h.store.data).toEqual({ count: 1, title: "Pending edit" });
  } finally {
    unregister();
  }
});
