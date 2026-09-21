import { UndoManager } from "loro-crdt";
import { describe, expect, test } from "bun:test";
import { Document } from "../src/document";
import { defineDocument, s, OperationRejectedError } from "../src/schema";
import { bindText } from "../src/bind-text";
import { MemoryStore } from "../src/memory";
import { copyStore } from "./helpers";

const schema = defineDocument({
  title: s.text(),
  rows: s.list(s.object({ name: s.text(), done: s.boolean(), note: s.optional(s.string()) })),
});
const initial = { title: "List", rows: [] };

test("handles retain identity across moves and reject a remote deletion and document close", async () => {
  const io = new MemoryStore();
  const doc = await Document.open(schema, io, initial);
  const { rows } = doc.fields;
  const { id } = rows.insert({ name: "A", done: false });
  const row = rows.item(id);
  const other = rows.insert({ name: "B", done: false });
  rows.move(id, { after: other.id });
  row.done.set(true);
  row.note.set("Keep");
  expect(doc.current.rows[1]).toEqual({ $id: id, name: "A", done: true, note: "Keep" });
  row.note.clear();
  await doc.flush();
  const peerIO = new MemoryStore();
  await copyStore(io, peerIO);
  const peer = await Document.open(schema, peerIO, initial);
  const version = doc.version();
  peer.fields.rows.remove(id);
  doc.importUpdates(peer.exportUpdates(version));
  const before = doc.current;
  expect(() => row.done.set(false)).toThrow(`Unknown row ID: ${id} at`);
  expect(doc.current).toBe(before);
  expect(doc.current.rows[0]!.done).toBe(false);
  await peer.close();
  await doc.close();
  expect(() => rows.insert({ name: "Closed", done: false })).toThrow("closed");
  const reopened = await Document.open(schema, io, initial);
  expect(reopened.current).toEqual(before);
  expect(() => row.name.replace("Wrong document")).toThrow("closed");
  await reopened.close();
});

test("insert IDs work immediately on the staging fork and results escape only after acceptance", async () => {
  const io = new MemoryStore();
  const doc = await Document.open(schema, io, initial);
  let publications = 0;
  const stop = doc.subscribe(() => publications++);
  let escaped!: ReturnType<typeof doc.fields.rows.item>;
  const id = doc.transaction((tx) => {
    const { id } = tx.fields.rows.insert({ name: "New", done: false });
    escaped = tx.fields.rows.item(id);
    escaped.name.replace("Edited before commit");
    escaped.done.set(true);
    expect(doc.current.rows).toHaveLength(0);
    return id;
  });
  expect(publications).toBe(1);
  expect(doc.current.rows[0]).toEqual({ $id: id, name: "Edited before commit", done: true });
  expect(() => escaped.done.set(false)).toThrow("callback has ended");
  stop();
  await doc.flush();
  expect((await io.load()).updates).toHaveLength(1);
  await doc.close();
  const reopened = await Document.open(schema, io, initial);
  expect(reopened.current.rows[0]!.$id).toBe(id);
  expect(reopened.current.rows[0]!.done).toBe(true);
  await reopened.close();
});

test("caught rejection, callback throw, async callback and outer writes all discard staging", async () => {
  const io = new MemoryStore();
  const doc = await Document.open(schema, io, initial);
  doc.fields.title.replace("Already pending");
  const snapshot = doc.current;
  const version = doc.version().encode();
  const pending = (doc as any).pending.map((bytes: Uint8Array) => bytes.slice());
  const failed = [
    () =>
      doc.transaction((tx) => {
        tx.fields.title.replace("Discard");
        throw new Error("callback failed");
      }),
    () =>
      doc.transaction((tx) => {
        tx.fields.rows.insert({ name: "Discard", done: false });
        try {
          tx.fields.rows.item("missing").done.set(true);
        } catch {}
      }),
    () =>
      doc.transaction((tx) => {
        tx.fields.title.replace("Discard");
        try {
          doc.fields.title.replace("Outer write");
        } catch {}
      }),
    () =>
      doc.transaction((tx) => {
        tx.fields.title.replace("Discard");
        try {
          doc.transaction(() => {});
        } catch {}
      }),
    () =>
      doc.transaction(async (tx) => {
        tx.fields.title.replace("Discard");
        await Promise.resolve();
        tx.fields.title.replace("Too late");
      }),
  ];
  for (const run of failed) {
    expect(run).toThrow();
    expect(doc.current).toBe(snapshot);
    expect(doc.version().encode()).toEqual(version);
    expect((doc as any).pending).toEqual(pending);
  }
  await Promise.resolve();
  expect(doc.transaction(() => "empty result")).toBe("empty result");
  await doc.flush();
  expect((await io.load()).updates).toHaveLength(1);
  await doc.close();
});

// The native suite separately exercises the actual WebKit DOM/action mounting.
class Input extends EventTarget {
  value = "";
  disabled = false;
}
test("text adapter handles composition, equivalent handles, retargeting, deletion and teardown", async () => {
  const doc = await Document.open(schema, new MemoryStore(), initial);
  const input = new Input();
  const action = bindText(input as unknown as HTMLInputElement, doc.fields.title);
  expect(input.value).toBe("List");
  input.value = "Local 🦊";
  input.dispatchEvent(new Event("input"));
  expect(doc.current.title).toBe("Local 🦊");
  input.dispatchEvent(new Event("compositionstart"));
  input.value = "日本語";
  input.dispatchEvent(new Event("input"));
  doc.fields.title.replace("Incoming");
  action.update(doc.fields.title);
  expect(input.value).toBe("日本語");
  expect(doc.current.title).toBe("Incoming");
  input.dispatchEvent(new Event("compositionend"));
  expect(doc.current.title).toBe("日本語");
  const version = doc.version().encode();
  input.dispatchEvent(new Event("input"));
  expect(doc.version().encode()).toEqual(version);
  const { id } = doc.fields.rows.insert({ name: "Row", done: false });
  action.update(doc.fields.rows.item(id).name);
  input.dispatchEvent(new Event("compositionstart"));
  input.value = "Draft";
  action.update(doc.fields.rows.item(id).name);
  expect(input.value).toBe("Draft");
  input.dispatchEvent(new Event("compositionend"));
  expect(doc.current.rows[0]!.name).toBe("Draft");
  doc.fields.rows.remove(id);
  expect(input.disabled).toBe(true);
  action.update(doc.fields.title);
  expect(input.disabled).toBe(false);
  expect(input.value).toBe("日本語");
  action.destroy();
  doc.fields.title.replace("After teardown");
  expect(input.value).toBe("日本語");
  input.value = "Detached";
  input.dispatchEvent(new Event("input"));
  expect(doc.current.title).toBe("After teardown");
  await doc.close();
});

describe("schema and transactions", () => {
  const schema = defineDocument({
    title: s.text(),
    label: s.string(),
    amount: s.number(),
    currency: s.enum(["CAD", "USD"]),
    note: s.optional(s.string()),
    settings: s.object({ enabled: s.boolean() }),
    rows: s.list(s.object({ name: s.text(), done: s.boolean() })),
  });
  const initial = {
    title: "abc",
    label: "Label",
    amount: 123,
    currency: "CAD" as const,
    settings: { enabled: false },
    rows: [],
  };
  test("v1 scalar/optional/container values round-trip without defaults or coercion", async () => {
    const io = new MemoryStore(),
      d = await Document.open(schema, io, initial);
    expect(Object.hasOwn(d.current, "note")).toBe(false);
    d.set(schema.fields.note, "optional");
    d.set(schema.fields.amount, 456);
    d.set(schema.fields.currency, "USD");
    d.text(schema.fields.title).replace("Hello 🦊");
    d.set(schema.fields.settings.enabled, true);
    await d.close();
    const r = await Document.open(schema, io, initial);
    expect(r.current).toEqual({
      ...initial,
      note: "optional",
      amount: 456,
      currency: "USD",
      title: "Hello 🦊",
      settings: { enabled: true },
    });
    r.clear(schema.fields.note);
    await r.close();
    const again = await Document.open(schema, io, initial);
    expect(Object.hasOwn(again.current, "note")).toBe(false);
    await again.close();
  });
  test("invalid values, unknown fields, container optionality and scalar list schemas reject", async () => {
    const d = await Document.open(schema, new MemoryStore(), initial),
      before = d.current;
    for (const value of [NaN, Infinity, -Infinity, "12", null])
      expect(() => d.apply({ type: "set", path: ["amount"], value } as any)).toThrow();
    expect(() => d.set(schema.fields.currency, "GBP" as any)).toThrow();
    expect(() => d.apply({ type: "clear", path: ["label"] })).toThrow();
    expect(() => d.apply({ type: "set", path: ["constructor"], value: "bad" })).toThrow();
    expect(() =>
      d.insert(schema.fields.rows, { name: "n", done: false, extra: true } as any),
    ).toThrow();
    expect(() => defineDocument({ bad: s.optional(s.text() as any) })).toThrow();
    expect(() => defineDocument({ bad: s.list(s.string() as any) })).toThrow();
    expect(d.current).toEqual(before);
    await d.close();
  });
  test("failed batch leaves state, version, generation and pending records untouched", async () => {
    const io = new MemoryStore(),
      d = await Document.open(schema, io, initial),
      before = d.current,
      version = d.version().encode();
    expect(() =>
      d.applyAll([
        { type: "set", path: ["amount"], value: 900 },
        { type: "text.replace", path: ["title"], value: "changed" },
        { type: "set", path: ["currency"], value: "invalid" },
      ]),
    ).toThrow();
    expect(d.current).toEqual(before);
    expect(d.version().encode()).toEqual(version);
    await d.flush();
    expect((await io.load()).updates).toHaveLength(0);
    expect((await io.load()).generation).toBe("1");
    await d.close();
  });
  test("one accepted transaction publishes once and persists one delta", async () => {
    const io = new MemoryStore(),
      d = await Document.open(schema, io, initial);
    let changes = 0;
    const stop = d.subscribe(() => changes++);
    d.transaction((tx) => {
      tx.set(schema.fields.amount, 777);
      tx.text(schema.fields.title).replace("Batch");
      tx.set(schema.fields.note, "Together");
    });
    expect(changes).toBe(1);
    await d.flush();
    expect((await io.load()).updates).toHaveLength(1);
    stop();
    await d.close();
    const r = await Document.open(schema, io, initial);
    expect(r.current.amount).toBe(777);
    expect(r.current.title).toBe("Batch");
    expect(r.current.note).toBe("Together");
    await r.close();
  });
  test("same-peer staged batch is one engine undo unit (no public undo API)", async () => {
    const d = await Document.open(schema, new MemoryStore(), initial);
    const engine = (d as any).engine;
    const undo = new UndoManager(engine, { mergeInterval: 0 });
    d.transaction((tx) => {
      tx.set(schema.fields.amount, 999);
      tx.text(schema.fields.title).replace("Undo both");
    });
    expect(undo.undo()).toBe(true);
    expect(engine.getMap("data").toJSON()).toEqual(initial);
    expect(undo.undo()).toBe(false);
    expect(undo.redo()).toBe(true);
    expect(engine.getMap("data").toJSON().amount).toBe(999);
    undo.free();
    await d.close();
  });
});

describe("author error semantics", () => {
  const schema = defineDocument({ title: s.text(), rows: s.list(s.object({ done: s.boolean() })) });
  const initial = { title: "Initial", rows: [{ done: false }] };
  test("operation rejection stops cleanup; failed batch preserves state and selection", async () => {
    const doc = await Document.open(schema, new MemoryStore(), initial);
    let input = "Keep this",
      selected = doc.current.rows.map((r) => r.$id);
    const before = doc.current;
    expect(() => {
      doc.apply({ type: "set", path: ["title"], value: 42 });
      input = "";
    }).toThrow(OperationRejectedError);
    expect(input).toBe("Keep this");
    expect(() => {
      doc.transaction((tx) => {
        tx.set(schema.fields.rows.item(selected[0]!).done, true);
        tx.remove(schema.fields.rows, "missing");
      });
      selected = [];
    }).toThrow(OperationRejectedError);
    expect(selected).toHaveLength(1);
    expect(doc.current).toEqual(before);
    const bug = new TypeError("Author bug");
    try {
      doc.transaction(() => {
        throw bug;
      });
    } catch (error) {
      expect(error).toBe(bug);
      expect(error).not.toBeInstanceOf(OperationRejectedError);
    }
    await doc.close();
    expect(() => doc.text(schema.fields.title).replace("Closed")).toThrow(OperationRejectedError);
  });
});

describe("snapshot identity", () => {
  const schema = defineDocument({
    title: s.text(),
    rows: s.list(s.object({ name: s.string() })),
  });
  const initial = { title: "Title", rows: [] };
  test("unaffected immutable rows retain identity across edits and moves", async () => {
    const doc = await Document.open(schema, new MemoryStore(), {
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
    expect(() => {
      (doc.current as any).title = "bad";
    }).toThrow();
    doc.fields.rows.move(b.$id, { before: a.$id });
    expect(doc.current.rows[0]).toBe(b);
    await doc.close();
  });
});
