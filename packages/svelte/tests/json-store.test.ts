import { expect, test } from "bun:test";
import { installHost, type SlopChange, type SlopHost } from "@hitslop/runtime";
import * as z from "zod";

const effects: Array<() => void> = [];
const runeState = Object.assign(<T>(value?: T) => value, { snapshot: structuredClone });
const runeEffect = Object.assign((effect: () => void) => { effects.push(effect); effect(); }, {
  root: (setup: () => void) => { setup(); return () => undefined; },
});
Object.assign(globalThis, { $state: runeState, $effect: runeEffect });

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test("jsonStore validates initial, loaded, external, and outgoing values", async () => {
  const schema = z.object({ count: z.number().int() });
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

  expect(() => jsonStore({ schema, initial: { count: 1.5 } })).toThrow("JSON schema validation failed");

  const store = jsonStore({ schema, initial: { count: 0 } });
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
  uninstall();
});
