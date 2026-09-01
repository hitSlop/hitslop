import { afterEach, expect, test } from "bun:test";
import { installHost, type SlopChange, type SlopHost } from "@hitslop/runtime";
import { JsonStoreCore } from "../src/json-store.ts";
import { SqliteQueryCore } from "../src/sqlite-query.ts";
import { ImageStoreCore } from "../src/image-store.ts";
import { FileStoreCore } from "../src/file-store.ts";

type ChangeCallback = (change: SlopChange) => void;

/** In-memory host double; tests drive external changes through `emit`. */
function makeFakeHost() {
  let json: unknown = undefined;
  let revision = 0;
  let rows: unknown[] = [];
  const media = new Map<string, { data: string; mimeType: string; revision: string }>();
  const executed: { sql: string; params: unknown[] }[] = [];
  const watchers = new Map<string, Set<ChangeCallback>>();

  const host: SlopHost = {
    query: async <T>() => rows as T[],
    execute: async (sql, params = []) => { executed.push({ sql, params }); return 0; },
    transaction: async () => 0,
    jsonOpen: async <T>(initial: T) => {
      if (json === undefined) { json = initial; revision += 1; }
      return { value: json as T, revision: String(revision) };
    },
    jsonRead: async <T>() => ({ value: json as T, revision: String(revision) }),
    jsonWrite: async <T>(value: T) => { json = value; revision += 1; return { revision: String(revision) }; },
    mediaOpen: async (name) => {
      const entry = media.get(name);
      return { exists: entry !== undefined, revision: entry?.revision ?? null };
    },
    mediaWrite: async (name, data, mimeType) => {
      const next = `media-${media.size + 1}`;
      media.set(name, { data, mimeType, revision: next });
      return { revision: next };
    },
    mediaRemove: async (name) => { media.delete(name); return { revision: null }; },
    resizeWindow: async (size) => size,
    dragWindow: async () => {},
    watch: (kind, callback) => {
      const set = watchers.get(kind) ?? new Set();
      set.add(callback);
      watchers.set(kind, set);
      return () => { set.delete(callback); };
    },
  };

  return {
    host,
    executed,
    media,
    setRows: (next: unknown[]) => { rows = next; },
    setJson: (value: unknown) => { json = value; revision += 1; },
    currentRevision: () => String(revision),
    emit: (kind: SlopChange["kind"], change: Partial<SlopChange> = {}) => {
      watchers.get(kind)?.forEach((callback) =>
        callback({ kind, source: "external", ...change }));
    },
  };
}

const settle = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

let uninstall: (() => void) | undefined;
afterEach(() => { uninstall?.(); uninstall = undefined; });

test("json store loads the host value, persists edits, and follows external changes", async () => {
  const fake = makeFakeHost();
  fake.setJson({ count: 5 });
  uninstall = installHost(fake.host);

  const store = new JsonStoreCore({ count: 0 });
  const detach = store.attach();
  await settle();
  expect(store.getSnapshot().value).toEqual({ count: 5 });
  expect(store.getSnapshot().isLoading).toBe(false);
  expect(store.getSnapshot().revision).toBe(fake.currentRevision());

  store.update((draft) => { draft.count += 1; });
  await settle();
  expect(store.getSnapshot().value).toEqual({ count: 6 });
  expect((await fake.host.jsonRead<{ count: number }>()).value).toEqual({ count: 6 });

  fake.setJson({ count: 41 });
  fake.emit("json", { revision: fake.currentRevision() });
  await settle();
  expect(store.getSnapshot().value).toEqual({ count: 41 });
  expect(store.getSnapshot().lastChangeSource).toBe("external");
  detach();
});

test("json store rejects values that are not JSON-serializable", async () => {
  const fake = makeFakeHost();
  uninstall = installHost(fake.host);
  const store = new JsonStoreCore<unknown>({ ok: true });
  const detach = store.attach();
  await settle();
  store.set(undefined);
  expect(store.getSnapshot().error).toContain("JSON-serializable");
  detach();
});

test("sqlite query loads rows, re-runs on change events, and executes statements", async () => {
  const fake = makeFakeHost();
  fake.setRows([{ id: 1 }]);
  uninstall = installHost(fake.host);

  const store = new SqliteQueryCore<{ id: number }>({ sql: "select id from items" });
  const detach = store.attach();
  await settle();
  expect(store.getSnapshot().current).toEqual([{ id: 1 }]);
  expect(store.getSnapshot().isLoading).toBe(false);

  fake.setRows([{ id: 1 }, { id: 2 }]);
  fake.emit("sqlite", { source: "app" });
  await settle();
  expect(store.getSnapshot().current).toEqual([{ id: 1 }, { id: 2 }]);
  expect(store.getSnapshot().lastChangeSource).toBe("app");

  await store.execute({ sql: "insert into items default values" });
  expect(fake.executed).toEqual([{ sql: "insert into items default values", params: [] }]);
  detach();
});

test("sqlite query ignores identical statements and reloads for new ones", async () => {
  const fake = makeFakeHost();
  fake.setRows([{ id: 1 }]);
  uninstall = installHost(fake.host);

  const store = new SqliteQueryCore<{ id: number }>({ sql: "select ?", parameters: [1] });
  const detach = store.attach();
  await settle();
  const before = store.getSnapshot();
  store.setStatement({ sql: "select ?", parameters: [1] });
  expect(store.getSnapshot()).toBe(before);

  fake.setRows([{ id: 2 }]);
  store.setStatement({ sql: "select ?", parameters: [2] });
  await settle();
  expect(store.getSnapshot().current).toEqual([{ id: 2 }]);
  detach();
});

test("image store falls back when media is missing and adopts written media", async () => {
  const fake = makeFakeHost();
  uninstall = installHost(fake.host);

  const store = new ImageStoreCore("hero", { fallback: "/assets/fallback.png" });
  const detach = store.attach();
  await settle();
  expect(store.getSnapshot().hasCustomImage).toBe(false);
  expect(store.getSnapshot().src).toBe("/assets/fallback.png");

  await store.replace(new File(["fake"], "hero.png", { type: "image/png" }));
  await settle();
  expect(store.getSnapshot().hasCustomImage).toBe(true);
  expect(store.getSnapshot().src).toContain("/media/hero");
  expect(fake.media.get("hero")?.mimeType).toBe("image/png");

  await store.remove();
  expect(store.getSnapshot().src).toBe("/assets/fallback.png");
  detach();
});

test("image store rejects non-image files without touching the host", async () => {
  const fake = makeFakeHost();
  uninstall = installHost(fake.host);
  const store = new ImageStoreCore("hero", { fallback: "/assets/fallback.png" });
  const detach = store.attach();
  await settle();
  await store.replace(new File(["nope"], "notes.txt", { type: "text/plain" }));
  expect(store.getSnapshot().error).toBe("Choose an image file.");
  expect(fake.media.size).toBe(0);
  detach();
});

test("file store round-trips arbitrary files", async () => {
  const fake = makeFakeHost();
  uninstall = installHost(fake.host);

  const store = new FileStoreCore("attachment", { accept: ".pdf" });
  const detach = store.attach();
  await settle();
  expect(store.getSnapshot().hasCustomFile).toBe(false);
  expect(store.getSnapshot().src).toBeNull();

  await store.replace(new File(["%PDF"], "doc.pdf", { type: "application/pdf" }));
  expect(store.getSnapshot().hasCustomFile).toBe(true);
  expect(store.getSnapshot().src).toContain("/media/attachment");

  await store.remove();
  expect(store.getSnapshot().hasCustomFile).toBe(false);
  expect(store.getSnapshot().src).toBeNull();
  detach();
});
