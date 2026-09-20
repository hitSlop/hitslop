import { test, expect } from "bun:test";
import { UndoManager } from "loro-crdt";
import { defineDocument, s, schemaKey } from "../src/schema";
import { Document } from "../src/document";
import { Session } from "../src/session";
import { MemoryStore } from "./helpers";
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
  expect(io.stored.updates).toHaveLength(0);
  expect(io.stored.generation).toBe("1");
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
  expect(io.stored.updates).toHaveLength(1);
  stop();
  await d.close();
  const r = await Document.open(schema, io, initial);
  expect(r.current.amount).toBe(777);
  expect(r.current.title).toBe("Batch");
  expect(r.current.note).toBe("Together");
  await r.close();
});
test("async callbacks and reentrant live writes never accept a transaction", async () => {
  const d = await Document.open(schema, new MemoryStore(), initial);
  expect(() =>
    d.transaction(async (tx) => {
      tx.set(schema.fields.amount, 999);
      await Promise.resolve();
      tx.set(schema.fields.amount, 1000);
    }),
  ).toThrow("synchronous");
  await Promise.resolve();
  expect(d.current.amount).toBe(123);
  expect(() =>
    d.transaction((tx) => {
      tx.set(schema.fields.amount, 999);
      d.set(schema.fields.label, "reentrant");
    }),
  ).toThrow();
  expect(d.current.label).toBe("Label");
  expect(d.current.amount).toBe(123);
  await d.close();
});
test("transaction retry after commit/reply loss is applied once", async () => {
  const io = new MemoryStore(),
    d = await Document.open(schema, io, initial),
    session = new Session(d, "epoch");
  const append = io.append.bind(io);
  let fail = true;
  io.append = async (...args) => {
    const g = await append(...args);
    if (fail) {
      fail = false;
      throw new Error("lost reply");
    }
    return g;
  };
  const request = {
    id: "batch",
    documentPath: "test",
    schemaHash: schemaKey(schema.descriptor),
    epoch: "epoch",
    method: "batch" as const,
    ops: [
      { type: "insert" as const, path: ["rows"], value: { name: "one", done: false } },
      { type: "set" as const, path: ["amount"], value: 200 },
    ],
  };
  expect((await session.handle(request)).ok).toBe(false);
  expect((await session.handle(request)).ok).toBe(true);
  expect(d.current.rows).toHaveLength(1);
  await session.close();
  const r = await Document.open(schema, io, initial);
  expect(r.current.rows).toHaveLength(1);
  expect(r.current.amount).toBe(200);
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
