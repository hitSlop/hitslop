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
test("hello returns only session identity and rejected mutations are not retryable saves", async () => {
  const doc = await Document.open(definition, new MemoryStore(), initial);
  const session = new Session(doc, "current");
  const base = { id: "hello", documentPath: "test", schemaHash: doc.key };
  expect(await session.handle({ ...base, method: "hello" })).toEqual({ ok: true, epoch: "current" });
  const rejected = await session.handle({ ...base, method: "compact", epoch: "old" });
  expect(rejected.ok).toBe(false);
  expect(rejected.retryable).toBe(false);
  await session.close();
});
test("receipt windows reject old mutations, reads retain no snapshots", async () => {
  const doc = await Document.open(definition, new MemoryStore(), initial);
  const session = new Session(doc, "first");
  const request = {
    id: "insert-0",
    epoch: "first",
    documentPath: "test",
    schemaHash: schemaKey(definition.descriptor),
    method: "apply" as const,
    op: { type: "insert" as const, path: ["rows"], value: { name: "A" } },
  };
  expect((await session.handle(request)).ok).toBe(true);
  for (let i = 1; i < 256; i++)
    expect((await session.handle({ ...request, id: `insert-${i}` })).ok).toBe(true);
  for (let i = 0; i < 1000; i++)
    await session.handle({ ...request, id: `get-${i}`, method: "get" });
  expect((session as any).receipts.size).toBe(256);
  expect(
    [...(session as any).receipts.values()].every((r: any) => !("state" in r) && !("reply" in r)),
  ).toBe(true);
  expect((await session.handle({ ...request, id: "expired" })).ok).toBe(false);
  expect((await session.handle(request)).ok).toBe(false);
  expect(doc.current.rows.length).toBe(256);
  await session.close();
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
