import { documentRuntime } from "@hitslop/sync/provider";
import { test, expect } from "bun:test";
import { compileModule } from "svelte/compiler";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as S from "@hitslop/schema/document";
import { FileDocumentIO } from "@hitslop/sync";
import type { SyncCommit } from "@hitslop/schema/sync";
Bun.plugin({ name: "svelte-document-store-tests", setup(build) {
  build.onResolve({ filter: /^svelte$/ }, () => ({ path: resolve(dirname(fileURLToPath(import.meta.resolve("svelte/package.json"))), "src/index-client.js") }));
  build.onLoad({ filter: /document-store\.svelte\.ts$/ }, async ({ path }) => ({ contents: compileModule(new Bun.Transpiler({ loader: "ts" }).transformSync(await Bun.file(path).text()), { filename: path, generate: "client" }).js.code, loader: "js" }));
} });

test("document store has immutable views, explicit validated changes and acknowledged flush", async () => {
  const root = await mkdtemp(join(tmpdir(), "svelte-document-"));
  const io = await FileDocumentIO.at(root);
  let pause: (() => void) | undefined;
  let blocked = false;
  const delayed = { open: () => io.open(), commit: async (value: SyncCommit) => {
    if (blocked) await new Promise<void>(resolve => { pause = resolve; });
    return io.commit(value);
  } };
  const { documentStore } = await import("../src/document-store.svelte.ts");
  const schema = S.Document({ count: S.Integer() });
  const store = documentStore({ runtime: documentRuntime, schema, initial: { count: 1 }, io: delayed });
  try {
    await store.flush();
    expect(store.isReady).toBe(true);
    // @ts-expect-error Persistence errors belong to the engine and host.
    void store.error;
    // @ts-expect-error Review errors belong to the engine and host.
    void store.projectionError;
    // @ts-expect-error The author-facing store exposes readiness only.
    void store.isDirty;
    // @ts-expect-error The author-facing store exposes readiness only.
    void store.isSaving;
    expect(() => { (store.current as { count: number }).count = 99; }).toThrow();
    expect(() => store.change(draft => { draft.count = 1.5; })).toThrow();
    expect(store.current.count).toBe(1);
    blocked = true;
    store.change(draft => { draft.count = 2; });
    expect(store.current.count).toBe(2);
    while (!pause) await new Promise(resolve => setTimeout(resolve, 0));
    let flushed = false;
    const flush = store.flush().then(() => { flushed = true; });
    expect(flushed).toBe(false);
    store.change(draft => { draft.count = 3; });
    blocked = false; pause();
    await flush;
    expect(store.current.count).toBe(3);
    const view = store.current;
    await store.flush();
    expect(store.current).toBe(view);
    for (const key of ["error", "projectionError", "isDirty", "isSaving"]) expect(key in store).toBe(false);
    store.destroy(); await store.flush();
    const snapshot = await io.open();
    const envelope = JSON.parse(Buffer.from(snapshot.external!, "base64").toString());
    expect(envelope.data.count).toBe(3);
  } finally { blocked = false; pause?.(); store.destroy(); await store.flush().catch(() => {}); await rm(root, { recursive: true, force: true }); }
});

// This uses the real runtime registry: a duplicate owner registration would
// make the same barrier read the document twice.
test("custom-I/O destruction retains failed saves until the runtime barrier retries", async () => {
  const { flush } = await import("@hitslop/runtime");
  const { documentStore } = await import("../src/document-store.svelte.ts");
  const root = await mkdtemp(join(tmpdir(), "svelte-destroy-"));
  const disk = await FileDocumentIO.at(root);
  let fail = false;
  let reads = 0;
  const io = {
    open: () => { reads++; return disk.open(); },
    commit: (value: SyncCommit) => { if (fail) throw new Error("Save failed"); return disk.commit(value); },
  };
  const store = documentStore({ runtime: documentRuntime, schema: S.Document({ count: S.Integer() }), initial: { count: 0 }, io });
  try {
    await store.flush();
    fail = true;
    store.change(draft => { draft.count = 4; });
    store.destroy();
    await expect(flush()).rejects.toThrow("Save failed");
    fail = false;
    await flush();
    expect(JSON.parse(Buffer.from((await disk.open()).external!, "base64").toString()).data.count).toBe(4);
    const before = reads;
    await flush();
    expect(reads).toBe(before);
  } finally { fail = false; store.destroy(); await store.flush(); await rm(root, { recursive: true, force: true }); }
});

test("hosted views share one barrier through opening, recovery and destruction", async () => {
  const { flush } = await import("@hitslop/runtime");
  const { performHostAction } = await import("../../runtime/src/host-errors.ts");
  const { createHash } = await import("node:crypto");
  const { documentStore } = await import("../src/document-store.svelte.ts");
  type Snapshot = import("@hitslop/schema/sync").SyncSnapshot;
  type Report = import("@hitslop/schema/bridge").BridgeParams<"errors.report">;
  let snapshot: Snapshot = { identity: null, checkpoint: null, metadata: null, external: null, externalHash: null, generation: "0" };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let failOpen = true;
  let failSave = false;
  let reads = 0;
  let watches = 0;
  const reports = new Map<string, Report>();
  const priorWindow = globalThis.window;
  const bridge = {
    open: async () => { reads++; await gate; if (failOpen) throw new Error("Open failed"); return structuredClone(snapshot); },
    commit: async (value: SyncCommit) => {
      if (failSave) throw new Error("Save failed");
      snapshot = { ...snapshot, identity: value.identity, checkpoint: value.checkpoint, metadata: value.metadata, generation: String(Number(snapshot.generation) + 1),
        ...(value.projection === undefined ? {} : { external: value.projection, externalHash: createHash("sha256").update(Buffer.from(value.projection, "base64")).digest("hex") }),
      };
      return structuredClone(snapshot);
    },
    onChange: () => { watches++; return () => {}; },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { slop: { runtime: documentRuntime, sync: bridge, errors: {
    report: async (value: Report) => { reports.set(value.id, value); },
    clear: async ({ id }: { id: string }) => { reports.delete(id); },
  } } } });
  const waitFor = async (predicate: () => boolean) => {
    for (let n = 0; n < 1000 && !predicate(); n++) await new Promise(resolve => setTimeout(resolve, 1));
    expect(predicate()).toBe(true);
  };
  const options = { schema: S.Document({ count: S.Integer() }), initial: { count: 0 } };
  const editor = documentStore(options);
  const icon = documentStore(options);
  try {
    let completed = false;
    const barrier = flush().finally(() => { completed = true; });
    void barrier.catch(() => {});
    await waitFor(() => reads > 0);
    expect(completed).toBe(false);
    expect(editor.isLoading).toBe(true);
    release();
    await expect(barrier).rejects.toThrow("Open failed");
    await expect(flush()).rejects.toThrow("Open failed");
    expect(editor.isLoading).toBe(false);
    expect(editor.isReady).toBe(false);
    await waitFor(() => reports.has("document-open"));
    failOpen = false;
    const opening = reports.get("document-open")!;
    expect(await performHostAction(opening.id, opening.revision, opening.instance)).toBe(true);
    expect(editor.isReady).toBe(true);
    expect(icon.isReady).toBe(true);
    expect(watches).toBe(1);
    expect(editor.current).toBe(icon.current);
    const before = reads;
    await flush();
    expect(reads).toBe(before + 1);
    editor.destroy();
    await editor.flush();
    failSave = true;
    icon.change(draft => { draft.count = 9; });
    expect(icon.current.count).toBe(9);
    expect(editor.current.count).toBe(0);
    icon.destroy();
    await expect(flush()).rejects.toThrow("Save failed");
    await waitFor(() => reports.get("document")?.action === "Retry saving");
    const saving = reports.get("document")!;
    failSave = false;
    expect(await performHostAction(saving.id, saving.revision, saving.instance)).toBe(true);
    await flush();
    expect(JSON.parse(Buffer.from(snapshot.external!, "base64").toString()).data.count).toBe(9);
    for (const key of ["error", "projectionError", "isDirty", "isSaving"]) expect(key in icon).toBe(false);
  } finally {
    release(); failOpen = false; failSave = false;
    editor.destroy(); icon.destroy();
    await flush().catch(() => {});
    if (priorWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else globalThis.window = priorWindow;
  }
});
