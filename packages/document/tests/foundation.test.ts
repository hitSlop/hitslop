import { test, expect } from "bun:test";
import { Document } from "../src/document";
import { defineDocument, s, schemaKey } from "../src/schema";
import { MemoryStore } from "../src/memory";
import { Session } from "../src/session";
import { SQLiteStore } from "../src/sqlite";
import { mkdtemp, mkdir, symlink, rm, readFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const definition = defineDocument({
  title: s.text(),
  rows: s.list(s.object({ name: s.string() })),
});
const initial = { title: "Title", rows: [] };
test("hello returns only lifetime identity and stale sessions fail", async () => {
  const doc = await Document.open(definition, new MemoryStore(), initial);
  const session = new Session(doc, "current");
  const base = { id: "hello", documentPath: "test", schemaHash: doc.key };
  expect(await session.handle({ ...base, method: "hello" })).toEqual({
    ok: true,
    epoch: "current",
  });
  const rejected = await session.handle({ ...base, method: "compact", epoch: "old" });
  expect(rejected.ok).toBe(false);
  expect(rejected.error).toContain("Session changed");
  await session.close();
});
test("session identity remains stable beyond the former receipt limit", async () => {
  const doc = await Document.open(definition, new MemoryStore(), initial);
  const session = new Session(doc, "first");
  for (let i = 0; i < 300; i++) {
    expect(
      (
        await session.handle({
          id: String(i),
          epoch: "first",
          documentPath: "test",
          method: "apply",
          op: { type: "insert", path: ["rows"], value: { name: "A" } },
        })
      ).ok,
    ).toBe(true);
  }
  expect(session.epoch).toBe("first");
  expect(doc.current.rows.length).toBe(300);
  await session.close();
});
test("get flushes drafts and reports save failures; prepare close is cancellable", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, initial);
  const session = new Session(doc, "first");
  const request = { id: "read", documentPath: "test", method: "get" as const };
  doc.fields.title.replace("pending");
  const append = store.append.bind(store);
  store.append = async () => {
    throw new Error("disk full");
  };
  expect((await session.handle(request)).ok).toBe(false);
  store.append = append;
  expect((await session.handle(request)).ok).toBe(true);
  await session.prepareClose();
  expect(() => doc.fields.title.replace("blocked")).toThrow();
  session.cancelClose();
  doc.fields.title.replace("resumed");
  await session.close();
  const reopened = await Document.open(definition, store, initial);
  expect(reopened.current.title).toBe("resumed");
  await reopened.close();
});
test("automatic checkpoint bounds update rows and preserves reopen", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, initial);
  for (let i = 0; i < 260; i++) {
    doc.fields.title.replace(String(i));
    await doc.flush();
  }
  expect((await store.load()).updates.length).toBeLessThan(256);
  await doc.close();
  const restored = await Document.open(definition, store, initial);
  expect(restored.current.title).toBe("259");
  await restored.close();
});
test("storage rejects symlinked state and detects package relocation", async () => {
  const parent = await mkdtemp(join(tmpdir(), "hsl-safe-"));
  try {
    const root = join(parent, "Doc.slop"),
      outside = join(parent, "outside");
    await mkdir(root);
    await mkdir(outside);
    await symlink(outside, join(root, "state"));
    await expect(SQLiteStore.open(root)).rejects.toThrow("Unsafe");
    await rm(join(root, "state"));
    const store = await SQLiteStore.open(root);
    await rename(root, join(parent, "Moved.slop"));
    await expect(store.load()).rejects.toThrow();
    await store.close();
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
test("unaffected immutable rows retain identity across edits and moves", async () => {
  const doc = await Document.open(definition, new MemoryStore(), {
    title: "Title",
    rows: [{ name: "A" }, { name: "B" }],
  });
  const before = doc.current,
    a = before.rows[0]!,
    b = before.rows[1]!;
  doc.fields.title.replace("Changed");
  expect(doc.current.rows).toBe(before.rows);
  doc.fields.rows.item(a.$id).name.set("New A");
  expect(doc.current.rows[1]).toBe(b);
  expect(before.rows[0]!.name).toBe("A");
  doc.fields.rows.move(b.$id, { before: a.$id });
  expect(doc.current.rows[0]).toBe(b);
  await doc.close();
});

test("concurrent close preparations await the same write before freeing the engine", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, initial);
  const append = store.append.bind(store);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  store.append = async (...args) => {
    entered();
    await gate;
    return append(...args);
  };
  doc.fields.title.replace("last edit");
  const preparing = doc.prepareClose();
  await started;
  let finished = false;
  const closing = doc.close().then(() => {
    finished = true;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  release();
  await Promise.all([preparing, closing, doc.close()]);
  const reopened = await Document.open(definition, store, initial);
  expect(reopened.current.title).toBe("last edit");
  await reopened.close();
});
