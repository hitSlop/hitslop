import { afterEach, expect, test } from "bun:test";
import { compileModule } from "svelte/compiler";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "@hitslop/schema/document";
import type { DocumentFrame } from "@hitslop/runtime";

Bun.plugin({
  name: "document-store-client-tests",
  setup(build) {
    build.onResolve({ filter: /^svelte$/ }, () => ({
      path: resolve(
        dirname(fileURLToPath(import.meta.resolve("svelte/package.json"))),
        "src/index-client.js",
      ),
    }));
    build.onLoad({ filter: /document-store\.svelte\.ts$/ }, async ({ path }) => ({
      contents: compileModule(
        new Bun.Transpiler({ loader: "ts" }).transformSync(await Bun.file(path).text()),
        { filename: path, generate: "client" },
      ).js.code,
      loader: "js",
    }));
  },
});
const { documentStore, documentText } = await import("../src/document-store.svelte.ts");
const schema = S.Document({ count: S.Number() });
const frame = (count = 0, publication = 0): DocumentFrame => ({
  publication,
  revision: `r${publication}`,
  data: { count },
  dirty: false,
  error: null,
  projectionError: null,
});
const originalWindow = globalThis.window;
afterEach(() => {
  globalThis.window = originalWindow;
});
function host(overrides: Record<string, unknown> = {}) {
  globalThis.window = {
    slop: {
      document: {
        open: async () => frame(),
        apply: async () => frame(1, 1),
        flush: async () => frame(),
        releaseDraft: async () => frame(),
        onChange: () => () => {},
        ...overrides,
      },
    },
  } as unknown as Window & typeof globalThis;
}

test("confirmed values are immutable and change uses the native edit API", async () => {
  let applied: unknown;
  host({
    apply: async (request: { after: unknown }) => {
      applied = request.after;
      return frame(2, 1);
    },
  });
  const store = documentStore({ schema, initial: { count: 0 } });
  await store.flush();
  expect(() => {
    (store.current as { count: number }).count = 2;
  }).toThrow();
  await store.change((data) => {
    data.count = 2;
  });
  expect(applied).toEqual({ count: 2 });
  expect(store.current.count).toBe(2);
  await store.destroy();
});

test("rejected edits remain failures across flush, reload, and remote publication", async () => {
  host({
    apply: async () => {
      throw new Error("Rejected edit");
    },
  });
  const store = documentStore({ schema, initial: { count: 0 } });
  await store.flush();
  await expect(
    store.change((data) => {
      data.count = 4;
    }),
  ).rejects.toThrow("Rejected edit");

  await expect(store.flush()).rejects.toThrow("Rejected edit");
  await store.reload();
  expect(store.error).toBe("Rejected edit");
  expect(store.hasFailedChanges).toBe(true);
  expect(store.isDirty).toBe(true);
  await expect(
    store.change((data) => {
      data.count = 9;
    }),
  ).rejects.toThrow("Rejected edit");
  await store.discardFailedChanges();
  expect(store.hasFailedChanges).toBe(false);
  expect(store.error).toBeNull();
  await store.flush();
  await store.destroy();
});

test("open and flush errors reject the close/export barrier", async () => {
  host({
    open: async () => {
      throw new Error("Open failed");
    },
  });
  const store = documentStore({ schema, initial: { count: 0 } });
  await expect(store.flush()).rejects.toThrow("Open failed");
  expect(store.isReady).toBe(false);
});

test("missing native capability is an error, never a disposable fallback", async () => {
  globalThis.window = {} as Window & typeof globalThis;
  const store = documentStore({ schema, initial: { count: 0 } });
  await expect(store.flush()).rejects.toThrow("bridge is unavailable");
  expect(store.isReady).toBe(false);
});

test("retrying a failed open restores the flush barrier", async () => {
  let available = false;
  host({
    open: async () => {
      if (!available) throw new Error("Temporarily unavailable");
      return frame();
    },
  });
  const store = documentStore({ schema, initial: { count: 0 } });
  await expect(store.flush()).rejects.toThrow("Temporarily unavailable");
  available = true;
  await store.reload();
  await store.flush();
  expect(store.isReady).toBe(true);
  expect(store.error).toBeNull();
  await store.destroy();
});

test("close captures active IME composition with its displayed revision", async () => {
  // @ts-expect-error Svelte exposes this effect test harness without declarations.
  const { effect_root } = await import("svelte/internal/client");
  const schema = S.Document({ text: S.Text() });
  let state: DocumentFrame = {
    publication: 0,
    revision: "text0",
    data: { text: "" },
    dirty: false,
    error: null,
    projectionError: null,
  };
  let request: any;
  host({
    open: async () => state,
    flush: async () => state,
    releaseDraft: async () => state,
    apply: async (edit: any) => {
      request = edit;
      return (state = { ...state, publication: 1, revision: "text1", data: edit.after });
    },
  });
  const store = documentStore({ schema, initial: { text: "" } });
  await store.flush();
  class Input extends EventTarget {
    value = "";
    selectionStart = 0;
    selectionEnd = 0;
    selectionDirection = "none";
    setSelectionRange() {}
  }
  const node = new Input();
  let action!: ReturnType<typeof documentText>;
  const originalDocument = globalThis.document;
  globalThis.document = { activeElement: node } as unknown as Document;
  const dispose = effect_root(() => {
    action = documentText(node as unknown as HTMLInputElement, {
      store,
      read: (data) => data.text,
      write: (data, value) => {
        data.text = value;
      },
    });
  });
  try {
    node.dispatchEvent(new Event("compositionstart"));
    node.value = "日本語";
    node.dispatchEvent(new Event("input"));
    expect(request).toBeUndefined();
    await store.destroy();
    expect(request.base).toBe("text0");
    expect(request.draft).toBeString();
    expect(request.after).toEqual({ text: "日本語" });
  } finally {
    action.destroy();
    dispose();
    globalThis.document = originalDocument;
  }
});
