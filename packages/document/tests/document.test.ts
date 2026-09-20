import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineDocument, s, fromDescriptor, schemaKey } from "../src/schema";
import { Document } from "../src/document";
import { SQLiteStore } from "../src/sqlite";
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
test("invalid operations are atomic and snapshots cannot be mutated", () =>
  fixture(async (root) => {
    const d = await Document.open(schema, await SQLiteStore.open(root), initial);
    const before = d.current;
    for (const op of [
      { type: "insert", path: ["tasks"], value: { text: "x", done: "bad" } },
      { type: "set", path: ["title"], value: 42 },
      { type: "remove", path: ["tasks"], id: "missing" },
      { type: "set", path: ["constructor"], value: "bad" },
    ])
      expect(() => d.apply(op as any)).toThrow();
    expect(d.current).toEqual(before);
    expect(() => {
      (d.current as any).title = "bad";
    }).toThrow();
    await d.close();
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
      method: "apply" as const,
      op: { type: "insert" as const, path: ["tasks"], value: { text: "Once", done: false } },
    };
    expect((await session.handle(request)).ok).toBe(false);
    expect((await session.handle({ ...request, method: "get" })).ok).toBe(true);
    expect((await session.handle({ ...request, epoch: "old" })).ok).toBe(false);
    await session.close();
    const r = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(r.current.tasks).toHaveLength(1);
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
