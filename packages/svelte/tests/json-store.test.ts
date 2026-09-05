import { expect, test } from "bun:test";
import { installHost, type SlopChange, type SlopHost } from "@hitslop/runtime";
import * as Type from "typebox";

const effects: Array<() => void> = [];
const runeState = Object.assign(<T>(value?: T) => value, { snapshot: structuredClone });
const runeEffect = Object.assign((effect: () => void) => { effects.push(effect); effect(); }, {
  root: (setup: () => void) => { setup(); return () => undefined; },
});
Object.assign(globalThis, { $state: runeState, $effect: runeEffect });

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
  effects.at(-1)?.();
  await tick();
  expect(writes).toBe(0);
  expect(store.error).toContain("count");

  store.current.count = 6;
  effects.at(-1)?.();
  await tick();
  await tick();
  expect(stored).toEqual({ count: 6 });
  expect(store.error).toBeNull();

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
  validated.destroy();

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
