// Guards acknowledged-write durability, failed-close ownership, reply-loss recovery and queued writes.
import { MemoryStore } from "../src/memory";
import { describe, test, expect } from "bun:test";
import { mkdtemp, rm, mkdir, symlink, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineDocument, s, fromDescriptor, schemaKey } from "../src/schema";
import { Document } from "../src/document";
import { SQLiteStore } from "../test-support/sqlite";
import { Session } from "../src/session";
const schema = defineDocument({
  title: s.text(),
  tasks: s.list(s.object({ text: s.text(), done: s.boolean() })),
});
const initial = { title: "List", tasks: [] };
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "hsl-sdk-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("generic operations preserve row IDs through moves, flush, compact and reopen", () =>
  fixture(async (root) => {
    const d = await Document.open(schema, await SQLiteStore.open(root), initial);
    d.insert(schema.fields.tasks, { text: "A", done: false });
    d.insert(schema.fields.tasks, { text: "B", done: true });
    const id = d.current.tasks[0]!.$id;
    d.move(schema.fields.tasks, id, { after: d.current.tasks[1]!.$id });
    d.text(schema.fields.tasks.item(id).text).replace("A edited 🦊");
    await d.flush();
    await d.compact();
    const expected = d.current;
    await d.close();
    const reopened = await Document.open(
      fromDescriptor(JSON.parse(JSON.stringify(schema.descriptor))),
      await SQLiteStore.open(root),
      initial,
    );
    expect(reopened.current).toEqual(expected);
    expect((reopened.current as any).tasks[1].$id).toBe(id);
    await reopened.close();
  }));
test("same runtime supports a second nested schema", () =>
  fixture(async (root) => {
    const notes = defineDocument({
      heading: s.text(),
      settings: s.object({ archived: s.boolean() }),
      notes: s.list(s.object({ body: s.text() })),
    });
    const d = await Document.open(notes, await SQLiteStore.open(root), {
      heading: "Notes",
      settings: { archived: false },
      notes: [],
    });
    d.set(notes.fields.settings.archived, true);
    d.insert(notes.fields.notes, { body: "No checklist reducer" });
    await d.close();
    const r = await Document.open(notes, await SQLiteStore.open(root), {
      heading: "",
      settings: { archived: false },
      notes: [],
    });
    expect(r.current.settings.archived).toBe(true);
    expect(r.current.notes[0]!.body).toBe("No checklist reducer");
    await r.close();
  }));
test("writer lock and schema compatibility are enforced", () =>
  fixture(async (root) => {
    const d = await Document.open(schema, await SQLiteStore.open(root), initial);
    await expect(SQLiteStore.open(root)).rejects.toThrow("live writer");
    await d.close();
    await expect(
      Document.open(defineDocument({ other: s.text() }), await SQLiteStore.open(root), {
        other: "",
      }),
    ).rejects.toThrow("Incompatible");
    const recovered = await SQLiteStore.open(root);
    await recovered.close();
  }));
test("lost storage reply followed by get flushes identical bytes without replaying intent", () =>
  fixture(async (root) => {
    const io = await SQLiteStore.open(root);
    let lost = true;
    const append = io.append.bind(io);
    io.append = async (...args) => {
      const generation = await append(...args);
      if (lost) {
        lost = false;
        throw new Error("reply lost after commit");
      }
      return generation;
    };
    const d = await Document.open(schema, io, initial),
      session = new Session(d, "epoch");
    const request = {
      id: "insert-1",
      documentPath: root,
      schemaHash: schemaKey(schema.descriptor),
      epoch: "epoch",
      method: "batch" as const,
      ops: [
        { type: "insert" as const, path: ["tasks"], value: { text: "Once", done: false } },
        { type: "text.replace" as const, path: ["title"], value: "Batch title" },
      ],
    };
    expect((await session.handle(request)).ok).toBe(false);
    expect((await session.handle({ ...request, method: "get" })).ok).toBe(true);
    expect((await session.handle({ ...request, epoch: "old" })).ok).toBe(false);
    await session.close();
    const r = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(r.current.tasks).toHaveLength(1);
    expect(r.current.title).toBe("Batch title");
    await r.close();
  }));
test("failed close retains ownership and can be retried", () =>
  fixture(async (root) => {
    const io = await SQLiteStore.open(root),
      append = io.append.bind(io);
    const d = await Document.open(schema, io, initial);
    d.text(schema.fields.title).replace("Unsaved");
    io.append = async () => {
      throw new Error("disk failure");
    };
    await expect(d.close()).rejects.toThrow();
    expect(d.status).toBe("save-failed");
    await expect(SQLiteStore.open(root)).rejects.toThrow("live writer");
    io.append = append;
    await d.close();
    const r = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(r.current.title).toBe("Unsaved");
    await r.close();
  }));

test("checkpoint reply loss refreshes generation and permits further edits", () =>
  fixture(async (root) => {
    const io = await SQLiteStore.open(root);
    const d = await Document.open(schema, io, initial);
    d.text(schema.fields.title).replace("Before checkpoint");
    await d.flush();
    const checkpoint = io.checkpoint.bind(io);
    let lose = true;
    io.checkpoint = async (...args) => {
      const generation = await checkpoint(...args);
      if (lose) {
        lose = false;
        throw new Error("checkpoint reply lost");
      }
      return generation;
    };
    await expect(d.compact()).rejects.toThrow("checkpoint reply lost");
    d.insert(schema.fields.tasks, { text: "After lost reply", done: false });
    await d.flush();
    await d.compact();
    await d.close();
    const r = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(r.current.title).toBe("Before checkpoint");
    expect(r.current.tasks).toHaveLength(1);
    await r.close();
  }));

describe("storage boundaries", () => {
  const definition = defineDocument({
    title: s.text(),
    rows: s.list(s.object({ name: s.string() })),
  });
  const initial = { title: "Title", rows: [] };
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
});

describe("save status", () => {
  const schema = defineDocument({ title: s.text(), rows: s.list(s.object({ done: s.boolean() })) });
  const initial = { title: "Initial", rows: [{ done: false }] };
  test("save failure stays visible through further edits and repeated failure until successful flush", async () => {
    const io = new MemoryStore(),
      append = io.append.bind(io),
      doc = await Document.open(schema, io, initial);
    io.append = async () => {
      throw new Error("Disk unavailable");
    };
    doc.text(schema.fields.title).replace("First");
    await expect(doc.flush()).rejects.toThrow("Disk unavailable");
    doc.text(schema.fields.title).replace("Second");
    expect(doc.status).toBe("save-failed");
    expect(doc.error).toContain("Disk unavailable");
    await expect(doc.flush()).rejects.toThrow();
    expect(doc.status).toBe("save-failed");
    io.append = append;
    await doc.flush();
    expect(doc.status).toBe("saved");
    expect(doc.error).toBeNull();
    await doc.close();
    const reopened = await Document.open(schema, io, initial);
    expect(reopened.current.title).toBe("Second");
    await reopened.close();
  });
});

test("edits arriving during append and checkpoint remain queued and survive reopen", async () => {
  const schema = defineDocument({ title: s.text(), flag: s.boolean() });
  const io = new MemoryStore();
  const doc = await Document.open(schema, io, { title: "Initial", flag: false });
  for (const phase of ["append", "checkpoint"] as const) {
    const original = io[phase].bind(io) as (...args: any[]) => Promise<string>;
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((r) => (entered = r)),
      gate = new Promise<void>((r) => (release = r));
    (io as any)[phase] = async (...args: any[]) => {
      entered();
      await gate;
      return original(...args);
    };
    doc.text(schema.fields.title).replace(`Before ${phase}`);
    const pending = phase === "append" ? doc.flush() : doc.compact();
    await started;
    doc.transaction((tx) => {
      tx.text(schema.fields.title).replace(`During ${phase}`);
      tx.set(schema.fields.flag, true);
    });
    release();
    await pending;
    (io as any)[phase] = original;
    await doc.flush();
  }
  const expected = doc.current;
  await doc.close();
  const reopened = await Document.open(schema, io, { title: "Unused", flag: false });
  expect(reopened.current).toEqual(expected);
  await reopened.close();
});

test("valid shallow checkpoints remain readable without enabling automatic pruning", async () => {
  const { LoroDoc } = await import("loro-crdt");
  const setting = defineDocument({ volume: s.number({ min: 0, max: 1 }) });
  const source = await Document.open(setting, new MemoryStore(), { volume: 0 });
  source.fields.volume.set(0.9);
  const engine = new LoroDoc();
  engine.import(source.exportSnapshot());
  const checkpoint = engine.export({
    mode: "shallow-snapshot",
    frontiers: engine.oplogFrontiers(),
  });
  const store = new MemoryStore();
  await store.checkpoint("0", checkpoint, source.key);
  await source.close();
  engine.free();
  const doc = await Document.open(setting, store, { volume: 0 });
  expect(doc.current.volume).toBe(0.9);
  doc.fields.volume.set(0.6);
  await doc.compact();
  await doc.close();
  const reopened = await Document.open(setting, store, { volume: 0 });
  expect(reopened.current.volume).toBe(0.6);
  await reopened.close();
});
