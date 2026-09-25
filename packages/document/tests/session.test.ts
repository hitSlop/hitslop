// Guards command serialization, stale epochs, known rejection versus unknown outcome, and close ordering.
import { test, expect } from "bun:test";
import { Document } from "../src/document";
import { defineDocument, s } from "../src/schema";
import { MemoryStore } from "../src/memory";
import { Session } from "../src/session";
import { observe } from "../src/handles";
const definition = defineDocument({
  title: s.text(),
  rows: s.list(s.object({ name: s.string() })),
});
const initial = { title: "Title", rows: [] };

test("snapshot versions survive reopen and checkpointing, but reject edits and different destinations", async () => {
  const store = new MemoryStore();
  let doc = await Document.open(definition, store, initial);
  let session = new Session(doc, "first");
  const base = { id: "snapshot", documentPath: "/Document.slop" };
  const snapshot = (await session.handle({ ...base, method: "snapshot" })).state as any;
  expect(snapshot.data.title).toBe("Title");
  expect(snapshot.schema).toEqual(definition.descriptor);
  await doc.compact();
  await session.close();
  doc = await Document.open(definition, store, initial);
  session = new Session(doc, "reopened");
  const request = {
    ...base,
    method: "import" as const,
    epoch: "reopened",
    expectedVersion: snapshot.version,
    data: { title: "Imported", rows: [] },
  };
  expect(await session.handle({ ...request, documentPath: "/Other.slop" })).toMatchObject({
    ok: false,
    code: "rejected",
  });
  const applied = await session.handle(request);
  expect(applied.ok).toBe(true);
  expect((applied.state as any).data.title).toBe("Imported");
  doc.fields.title.replace("User edit");
  expect(
    await session.handle({ ...request, expectedVersion: (applied.state as any).version }),
  ).toMatchObject({ ok: false, code: "rejected" });
  expect(doc.current.title).toBe("User edit");
  await session.close();
});

test("a draft arriving while import awaits storage rejects the replacement", async () => {
  const store = new MemoryStore(),
    doc = await Document.open(definition, store, initial);
  const session = new Session(doc, "live");
  let draft: string | undefined;
  const stop = observe(doc.fields.title).source.beforeFlush!(() => {
    if (draft !== undefined) {
      const value = draft;
      draft = undefined;
      doc.fields.title.replace(value);
    }
  });
  let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>((resolve) => (entered = resolve)),
    gate = new Promise<void>((resolve) => (release = resolve));
  const append = store.append.bind(store);
  store.append = async (...args) => {
    entered();
    await gate;
    return append(...args);
  };
  doc.fields.title.replace("Pending save");
  const version = doc.snapshotFor("/Document.slop").version;
  const importing = session.handle({
    id: "import",
    documentPath: "/Document.slop",
    epoch: "live",
    method: "import",
    expectedVersion: version,
    data: { title: "Overwrite", rows: [] },
  });
  await waiting;
  draft = "Typed while saving";
  release();
  expect(await importing).toMatchObject({ ok: false, code: "rejected" });
  expect(doc.current.title).toBe("Typed while saving");
  stop();
  await session.close();
});

test("an import save failure retains accepted data and returns an uncertain outcome", async () => {
  const store = new MemoryStore(),
    doc = await Document.open(definition, store, initial);
  const session = new Session(doc, "live"),
    path = "/Document.slop";
  const version = doc.snapshotFor(path).version,
    checkpoint = store.checkpoint.bind(store);
  store.checkpoint = async () => {
    throw new Error("disk unavailable");
  };
  expect(
    await session.handle({
      id: "import",
      documentPath: path,
      epoch: "live",
      method: "import",
      expectedVersion: version,
      data: { title: "Accepted", rows: [] },
    }),
  ).toMatchObject({ ok: false, code: "failed" });
  expect(doc.current.title).toBe("Accepted");
  expect(doc.status).toBe("save-failed");
  store.checkpoint = checkpoint;
  await session.close();
  const reopened = await Document.open(definition, store, initial);
  expect(reopened.current.title).toBe("Accepted");
  await reopened.close();
});
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
  expect(rejected.code).toBe("session_changed");
  const invalid = await session.handle({
    ...base,
    method: "apply",
    epoch: "current",
    op: { type: "set", path: ["missing"], value: 1 } as any,
  });
  expect(invalid).toMatchObject({ ok: false, code: "rejected" });
  await session.close();
});
test("session identity remains stable across repeated edits", async () => {
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
