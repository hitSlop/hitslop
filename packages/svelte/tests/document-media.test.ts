import { afterEach, expect, test } from "bun:test";
import { compileModule } from "svelte/compiler";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "@hitslop/schema/document";
import { MemoryAuthority } from "@hitslop/schema/document-authority";
import type { Request } from "@hitslop/schema/document-protocol";

const client = resolve(
  dirname(fileURLToPath(import.meta.resolve("svelte/package.json"))),
  "src/index-client.js",
);
Bun.plugin({
  name: "document-media-client-tests",
  setup(build) {
    build.onResolve({ filter: /^svelte$/ }, () => ({ path: client }));
    build.onLoad({ filter: /(?:media-store|create-document)\.svelte\.ts$/ }, async ({ path }) => ({
      contents: compileModule(
        new Bun.Transpiler({ loader: "ts" }).transformSync(
          (await Bun.file(path).text()).replace(
            /from ["']svelte["']/g,
            `from ${JSON.stringify(client)}`,
          ),
        ),
        { filename: path, generate: "client" },
      ).js.code,
      loader: "js",
    }));
  },
});
const { createDocument } = await import("../src/create-document.svelte.ts");
const { imageStore } = await import("../src/image-store.svelte.ts");
// @ts-expect-error internal Svelte component test harness
const { effect_root, push, pop, flush } = await import("svelte/internal/client");
const schema = S.Document({ title: S.String(), photo: S.Optional(S.Media()) });
const fields = S.paths(schema);
const a = { sha256: "a".repeat(64), mime: "image/png", bytes: 1 };
const b = { ...a, sha256: "b".repeat(64) };
const originalWindow = globalThis.window;
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  globalThis.window = originalWindow;
});
function setup() {
  const authority = new MemoryAuthority(schema, { title: "Recipe" });
  let importMedia: () => Promise<typeof a> = async () => a;
  let available = true;
  const listeners = new Set<(event: any) => void>();
  const opened: string[] = [];
  globalThis.window = {
    slop: {
      ready() {},
      document: {
        connected: true,
        writable: true,
        open: async () => authority.open(),
        send: async (request: Request) => authority.execute(request),
        subscribe: authority.subscribe.bind(authority),
        onConnection: () => () => {},
        flush: async () => {},
      },
      media: {
        add: () => importMedia(),
        open: async (hash: string) => {
          opened.push(hash);
          return { src: available ? `/media/${hash}` : null };
        },
        onChange: (cb: any) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      },
    },
  } as unknown as Window & typeof globalThis;
  let document!: ReturnType<typeof createDocument<typeof schema>>;
  let photo!: ReturnType<typeof imageStore>;
  const dispose = effect_root(() => {
    push({}, true);
    document = createDocument({ schema, initial: { title: "Recipe" } });
    photo = imageStore(document, fields.photo, { fallback: "fallback.png" });
    pop();
  });
  cleanups.push(async () => {
    await photo.destroy();
    await document.destroy();
    dispose();
  });
  return {
    document,
    photo,
    opened,
    listeners,
    setImport(fn: typeof importMedia) {
      importMedia = fn;
    },
    setAvailable(value: boolean) {
      available = value;
    },
  };
}
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
  }
}
const file = () => new File([new Uint8Array([1])], "dinner.png", { type: "image/png" });

test("attachments follow document snapshots and clear only the reference", async () => {
  const h = setup();
  await settle();
  expect(h.photo.src).toBe("fallback.png");
  expect((await h.photo.replace(file())).ok).toBe(true);
  await settle();
  expect(h.document.data.photo).toEqual({ ...a, filename: "dinner.png" });
  expect(h.photo.src).toBe(`/media/${a.sha256}`);
  await h.document.set(fields.photo, b);
  await settle();
  expect(h.photo.src).toBe(`/media/${b.sha256}`);
  expect((await h.photo.clear()).ok).toBe(true);
  await settle();
  expect(h.document.data.photo).toBeUndefined();
  expect(h.photo.src).toBe("fallback.png");
});

test("failed imports preserve the reference and do not block close", async () => {
  const h = setup();
  await settle();
  await h.document.set(fields.photo, a);
  await settle();
  h.setImport(async () => {
    throw new Error("disk full");
  });
  expect((await h.photo.replace(file())).ok).toBe(false);
  expect(h.photo.error).toBe("disk full");
  expect(h.document.data.photo).toEqual(a);
  await h.document.destroy();
  expect(h.photo.pending).toBe(0);
});

test("document teardown waits for an in-flight attachment before closing its controller", async () => {
  const h = setup();
  await settle();
  let release!: (value: typeof a) => void;
  h.setImport(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const replacing = h.photo.replace(file());
  await settle();
  let closed = false;
  const closing = h.document.destroy().then(() => {
    closed = true;
  });
  await settle();
  expect(closed).toBe(false);
  release(a);
  expect((await replacing).ok).toBe(true);
  await closing;
  expect(h.document.data.photo?.sha256).toBe(a.sha256);
});

test("missing downloads can be retried and unrelated media events preserve the current image", async () => {
  const h = setup();
  await settle();
  h.setAvailable(false);
  await h.document.set(fields.photo, a);
  await settle();
  expect(h.photo.error).toContain("not available");
  expect(h.photo.src).toBe("fallback.png");
  h.setAvailable(true);
  await h.photo.reload();
  expect(h.photo.src).toBe(`/media/${a.sha256}`);
  await h.document.set(fields.photo, b);
  await settle();
  for (const listener of h.listeners) listener({ sha256: a.sha256 });
  expect(h.photo.src).toBe(`/media/${b.sha256}`);
});

test("recipe authoring fixture compiles with document-backed image controls", async () => {
  const { compile } = await import("svelte/compiler");
  const result = compile(
    await Bun.file(new URL("./fixtures/Recipe.svelte", import.meta.url)).text(),
    { filename: "Recipe.svelte", generate: "client" },
  );
  expect(result.warnings).toEqual([]);
  expect(result.js.code).toContain("imageStore");
});
