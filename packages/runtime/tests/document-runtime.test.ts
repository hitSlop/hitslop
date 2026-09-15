import { expect, test } from "bun:test";
import { createDocumentRuntimeLoader } from "../src/document-runtime.ts";
import type { DocumentRuntime } from "@hitslop/schema/document-runtime";

test("host loader is lazy, shares initialization, and retries failed resource loads", async () => {
  const priorWindow = globalThis.window, priorDocument = globalThis.document;
  const scripts: { onload(): void; onerror(): void; src: string; remove(): void }[] = [];
  let opens = 0;
  const provider = { version: "1.0.0", open: async () => { opens++; return { current: { count: 1 } }; } } as unknown as DocumentRuntime;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: {
    createElement: () => ({ remove() {} }), head: { append: (script: typeof scripts[number]) => scripts.push(script) },
  } });
  try {
    const runtime = createDocumentRuntimeLoader({ version: "1.0.0", scriptURL: "/__hitslop_runtime__/document-runtime-1.0.0.js" });
    expect(scripts).toHaveLength(0);
    const options = { schema: {}, initial: {}, io: {} } as Parameters<DocumentRuntime["open"]>[0];
    const first = runtime.open(options).catch(error => error), second = runtime.open(options).catch(error => error);
    expect(scripts).toHaveLength(1);
    expect(opens).toBe(0);
    scripts[0]!.onerror();
    for (const failure of await Promise.all([first, second])) expect(failure.message).toContain("could not be loaded");
    const retry = runtime.open(options);
    expect(scripts).toHaveLength(2);
    window.__hitslopDocumentRuntime = provider;
    scripts[1]!.onload();
    await expect(retry).resolves.toMatchObject({ current: { count: 1 } });
    await runtime.open(options);
    expect(opens).toBe(2);
    expect(scripts).toHaveLength(2);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: priorWindow });
    Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: priorDocument });
  }
});

test("host loader validates versions without restricting the host to its own SDK major", () => {
  expect(() => createDocumentRuntimeLoader({ version: "bad", scriptURL: "/unused" })).toThrow("Invalid");
  expect(createDocumentRuntimeLoader({ version: "2.0.0", scriptURL: "/unused" }).version).toBe("2.0.0");
});
