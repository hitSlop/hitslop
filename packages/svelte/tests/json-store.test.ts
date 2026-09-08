import { expect, test } from "bun:test";
import { installHost, flush as flushAll, SlopError, type SlopChange, type SlopHost } from "@hitslop/runtime";
import * as Type from "typebox";
import { compileModule } from "svelte/compiler";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the actual client rune compiler/runtime without mounting a DOM.
// Resolve the client entry explicitly: Bun normally selects Svelte's SSR entry.
Bun.plugin({
  name: "svelte-json-store-tests",
  setup(build) {
    build.onResolve({ filter: /^svelte$/ }, () => ({ path: resolve(dirname(fileURLToPath(import.meta.resolve("svelte/package.json"))), "src/index-client.js") }));
    build.onLoad({ filter: /json-store\.svelte\.ts$/ }, async ({ path }) => ({
      contents: compileModule(new Bun.Transpiler({ loader: "ts" }).transformSync(await Bun.file(path).text()), { filename: path, generate: "client" }).js.code,
      loader: "js",
    }));
  },
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test("jsonStore validates initial, loaded, external, and outgoing values", async () => {
  const schema = Type.Object({ count: Type.Integer() });
  let stored: unknown = { count: 4 };
  let revision = "initial";
  let writes = 0;
  let listener: ((change: SlopChange) => void) | undefined;
  const host: SlopHost = {
    query: async () => [],
    execute: async () => 0,
    transaction: async () => 0,
    jsonOpen: async <T>() => ({ value: stored as T, revision }),
    jsonRead: async <T>() => ({ value: stored as T, revision }),
    jsonWrite: async (value) => { stored = value; writes += 1; revision = `write-${writes}`; return { revision }; },
    mediaOpen: async () => ({ exists: false, revision: null }),
    mediaWrite: async () => ({ revision: "media" }),
    mediaRemove: async () => ({ revision: null }),
    resizeWindow: async (size) => size,
    dragWindow: async () => undefined,
    watch: (_kind, callback) => { listener = callback; return () => { listener = undefined; }; },
  };
  const uninstall = installHost(host);
  const { jsonStore } = await import("../src/json-store.svelte.ts");

  expect(() => jsonStore({ schema: schema, initial: { count: 1.5 } })).toThrow("JSON schema validation failed");

  const store = jsonStore({ schema: schema, initial: { count: 0 } });
  while (store.isLoading) await tick();
  expect(store.current).toEqual({ count: 4 });

  (store.current as { count: unknown }).count = "invalid";
  await expect(store.flush()).rejects.toMatchObject({ code: "validation_failed" });
  expect(writes).toBe(0);
  expect(store.error).toContain("count");
  expect(store.errorCode).toBe("validation_failed");
  expect(store.isDirty).toBe(true);

  store.current.count = 6;
  await store.flush();
  expect(stored).toEqual({ count: 6 });
  expect(store.error).toBeNull();
  expect(store.errorCode).toBeNull();

  stored = { count: "bad" };
  revision = "external-invalid";
  listener?.({ kind: "json", source: "external", revision });
  await tick();
  expect(store.current).toEqual({ count: 6 });
  expect(store.error).toContain("count");

  stored = { count: 8 };
  revision = "external-valid";
  listener?.({ kind: "json", source: "external", revision });
  await tick();
  expect(store.current).toEqual({ count: 8 });
  expect(store.error).toBeNull();

  store.destroy();
  await store.flush();

  const portable = Type.Object({ count: Type.Integer(), future: Type.Optional(Type.Object({ keep: Type.Boolean() })) }, { additionalProperties: true });
  stored = { count: 9, future: { keep: true } };
  revision = "validated";
  const validated = jsonStore({ schema: portable, initial: { count: 0 } });
  while (validated.isLoading) await tick();
  expect(validated.current.future).toEqual({ keep: true });
  validated.current.count = 10;
  await validated.flush();
  expect(stored).toEqual({ count: 10, future: { keep: true } });
  (validated.current as { count: unknown }).count = "invalid";
  await expect(validated.flush()).rejects.toThrow("JSON schema validation failed");
  expect(stored).toEqual({ count: 10, future: { keep: true } });
  validated.current.count = 10;
  validated.destroy();
  await validated.flush();

  stored = { count: "invalid on open" };
  const invalidOpen = jsonStore({ schema, initial: { count: 0 } });
  while (invalidOpen.isLoading) await tick();
  expect(invalidOpen.isReady).toBe(false);
  expect(invalidOpen.current).toEqual({ count: 0 });
  expect(invalidOpen.error).toContain("count");
  stored = { count: 12 };
  await invalidOpen.reload();
  expect(invalidOpen.isReady).toBe(true);
  expect(invalidOpen.current).toEqual({ count: 12 });
  expect(invalidOpen.error).toBeNull();
  invalidOpen.destroy();
  await invalidOpen.flush();
  uninstall();
});

test("jsonStore rejects non-JSON values and infers the schema type", async () => {
  const { jsonStore } = await import("../src/json-store.svelte.ts");
  for (const initial of [{ date: new Date() }, { missing: undefined }, NaN, [, 1]]) {
    expect(() => jsonStore({ schema: Type.Unknown(), initial })).toThrow("plain JSON");
  }
  const schema = Type.Object({ count: Type.Number() });
  if (false) {
    // @ts-expect-error initial cannot widen the inferred schema type
    jsonStore({ schema: schema, initial: { count: "bad" } });
    const store = jsonStore({ schema: schema, initial: { count: 1 } });
    // @ts-expect-error current retains the schema type
    store.current.count = "bad";
    // @ts-expect-error a default annotation does not make a required field optional
    jsonStore({ schema: Type.Object({ count: Type.Number({ default: 0 }) }), initial: {} });
  }
});

function hostHarness() {
  const state = {
    stored: { tasks: [{ text: "one", future: true }] },
    writes: [] as Array<{ tasks: Array<{ text: string; future?: boolean }> }>,
    attempts: 0,
    failure: null as SlopError | null,
    writeGate: null as Promise<void> | null,
    openGate: null as Promise<void> | null,
    listener: undefined as ((change: SlopChange) => void) | undefined,
  };
  const host: SlopHost = {
    query: async () => [], execute: async () => 0, transaction: async () => 0,
    jsonOpen: async <T>() => { await state.openGate; return { value: structuredClone(state.stored) as T, revision: "initial" }; },
    jsonRead: async <T>() => ({ value: structuredClone(state.stored) as T, revision: "external" }),
    jsonWrite: async value => {
      state.attempts++;
      await state.writeGate;
      if (state.failure) throw state.failure;
      state.stored = structuredClone(value) as typeof state.stored;
      state.writes.push(state.stored);
      return { revision: `write-${state.writes.length}` };
    },
    mediaOpen: async () => ({ exists: false, revision: null }),
    mediaWrite: async () => ({ revision: "media" }), mediaRemove: async () => ({ revision: null }),
    resizeWindow: async size => size, dragWindow: async () => undefined,
    watch: (_kind, callback) => { state.listener = callback; return () => { state.listener = undefined; }; },
  };
  return { state, uninstall: installHost(host) };
}
const nestedSchema = Type.Object({ tasks: Type.Array(Type.Object({ text: Type.String() }, { additionalProperties: true })) }, { additionalProperties: true });
const untilReady = async (store: { isLoading: boolean }) => { while (store.isLoading) await tick(); };

test("compiled runes observe nested edits and batch automatic writes without effect stubs", async () => {
  const { state, uninstall } = hostHarness();
  const { jsonStore } = await import("../src/json-store.svelte.ts");
  const store = jsonStore({ schema: nestedSchema, initial: { tasks: [] } });
  await untilReady(store);
  store.current.tasks[0]!.text = "two";
  await tick();
  expect(store.isDirty).toBe(true);
  expect(store.isSaving).toBe(false);
  expect(state.writes).toHaveLength(0);
  store.current.tasks[0]!.text = "three";
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(state.writes).toHaveLength(1);
  expect(state.stored.tasks[0]).toEqual({ text: "three", future: true });
  expect(store.isDirty).toBe(false);
  store.destroy();
  await store.flush();
  uninstall();
});

test("flush captures edits before the rune effect runs and keeps snapshots detached during writes", async () => {
  const { state, uninstall } = hostHarness();
  const { jsonStore } = await import("../src/json-store.svelte.ts");
  const store = jsonStore({ schema: nestedSchema, initial: { tasks: [] } });
  await untilReady(store);
  let release!: () => void;
  state.writeGate = new Promise(resolve => { release = resolve; });
  store.current.tasks[0]!.text = "first";
  const saving = store.flush();
  await tick();
  expect(store.isSaving).toBe(true);
  expect(store.isDirty).toBe(true);
  store.current.tasks[0]!.text = "second";
  const alsoSaving = store.flush();
  release();
  await Promise.all([saving, alsoSaving]);
  expect(state.writes.map(value => value.tasks[0]!.text)).toEqual(["first", "second"]);
  expect(store.isSaving).toBe(false);
  expect(store.isDirty).toBe(false);
  store.destroy();
  await store.flush();
  uninstall();
});

test("destroy drains the final snapshot and failed teardown remains in the global flush barrier", async () => {
  const { state, uninstall } = hostHarness();
  const { jsonStore } = await import("../src/json-store.svelte.ts");
  const store = jsonStore({ schema: nestedSchema, initial: { tasks: [] } });
  await untilReady(store);
  state.failure = new SlopError("storage_error", "disk full");
  store.current.tasks[0]!.text = "final";
  store.destroy();
  store.destroy();
  await tick();
  expect(state.listener).toBeUndefined();
  expect(store.errorCode).toBe("storage_error");
  expect(store.isDirty).toBe(true);
  await expect(flushAll()).rejects.toBe(state.failure);
  store.current.tasks[0]!.text = "after destruction";
  state.failure = null;
  await flushAll();
  expect(state.stored.tasks[0]!.text).toBe("final");
  expect(store.errorCode).toBeNull();
  expect(store.isDirty).toBe(false);
  await flushAll();
  expect(state.writes).toHaveLength(1);
  uninstall();
});

test("destroy while opening waits for load and saves edits made before teardown", async () => {
  const { state, uninstall } = hostHarness();
  let release!: () => void;
  state.openGate = new Promise(resolve => { release = resolve; });
  const { jsonStore } = await import("../src/json-store.svelte.ts");
  const store = jsonStore({ schema: nestedSchema, initial: { tasks: [] } });
  store.current.tasks.push({ text: "before load" });
  store.destroy();
  release();
  await flushAll();
  expect(state.stored.tasks.map(task => task.text)).toEqual(["before load"]);
  expect(store.isDirty).toBe(false);
  uninstall();
});

test("non-JSON edits block stale queued data, remain dirty, and recover through reload", async () => {
  const { state, uninstall } = hostHarness();
  const { jsonStore } = await import("../src/json-store.svelte.ts");
  const store = jsonStore({ schema: nestedSchema, initial: { tasks: [] } });
  await untilReady(store);
  store.current.tasks[0]!.text = "queued";
  await tick();
  (store.current.tasks[0] as { text: unknown }).text = undefined;
  await tick();
  await expect(store.flush()).rejects.toMatchObject({ code: "validation_failed" });
  expect(store.isDirty).toBe(true);
  expect(state.writes).toHaveLength(0);
  await store.reload();
  await tick();
  expect(store.current.tasks[0]!.text).toBe("one");
  expect(store.isDirty).toBe(false);
  expect(store.errorCode).toBeNull();
  store.destroy();
  await store.flush();
  uninstall();
});

test("compiled store bounds conflict retries, retains dirty edits, and exposes the conflict code", async () => {
  const { state, uninstall } = hostHarness();
  const { jsonStore } = await import("../src/json-store.svelte.ts");
  const store = jsonStore({ schema: nestedSchema, initial: { tasks: [] } });
  await untilReady(store);
  state.failure = new SlopError("revision_conflict", "changed twice");
  store.current.tasks[0]!.text = "local";
  await expect(store.flush()).rejects.toBe(state.failure);
  expect(state.attempts).toBe(2);
  expect(store.errorCode).toBe("revision_conflict");
  expect(store.isDirty).toBe(true);
  expect(store.isSaving).toBe(false);
  state.stored.tasks[0]!.text = "external";
  state.listener?.({ kind: "json", source: "external", revision: "changed-again" });
  await tick();
  expect(store.current.tasks[0]!.text).toBe("local");
  state.failure = null;
  await store.flush();
  expect(state.stored.tasks[0]!.text).toBe("local");
  expect(store.errorCode).toBeNull();
  store.destroy();
  await store.flush();
  uninstall();
});
