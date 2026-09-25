// Guards whole-document import identity, atomic rejection, references and rich-text preservation.
import { expect, test } from "bun:test";
import { Document } from "../src/document";
import { defineDocument, s } from "../src/schema";
import { MemoryStore } from "../src/memory";

const definition = defineDocument({
  title: s.text(), rows: s.list(s.object({ name: s.string(), link: s.string() })),
  notes: s.richtext({ bold: "after" }), count: s.counter(),
  tags: s.list(s.string()), extra: s.optional(s.object({ rows: s.list(s.object({ value: s.integer() })) })),
  tree: s.tree(s.object({ name: s.string() })), values: s.record(s.number()),
});
const initial = { title: "Old", rows: [{ name: "A", link: "" }, { name: "B", link: "" }],
  notes: "", count: 1, tags: ["old"], tree: [{ name: "parent", children: [{ name: "child" }] }], values: { old: 1 } };

test("import preserves rows, reparents surviving descendants, resolves cycles and reopens", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, initial);
  const a = doc.current.rows[0]!.$id, child = doc.current.tree[0]!.children[0]!.$id;
  doc.importJSON({ title: "Today", rows: [
    { name: "New", link: { $ref: "/rows/1" } },
    { $id: a, name: "Updated A", link: { $ref: "/rows/0" } },
  ], notes: { text: "Hi 🌻", delta: [{ insert: "Hi " }, { insert: "🌻", attributes: { bold: true } }] },
  count: 7, tags: ["new"], extra: { rows: [{ value: 42 }] },
  tree: [{ $id: child, name: "surviving child" }], values: { next: 2 } });
  const saved = doc.current;
  expect(saved.rows.map(r => r.name)).toEqual(["New", "Updated A"]);
  expect(saved.rows[1]!.$id).toBe(a);
  expect(saved.rows[0]!.link).toBe(a);
  expect(saved.rows[1]!.link).toBe(saved.rows[0]!.$id);
  expect(saved.tree).toEqual([{ $id: child, name: "surviving child", children: [] }]);
  expect(saved.extra!.rows[0]!.value).toBe(42);
  expect(saved.notes.delta).toEqual([{ insert: "Hi " }, { insert: "🌻", attributes: { bold: true } }]);
  expect(saved.count).toBe(7);
  expect(saved.values).toEqual({ next: 2 });
  await doc.close();
  const reopened = await Document.open(definition, store, initial);
  expect(reopened.current).toEqual(saved);
  const version = reopened.version().encode();
  reopened.importJSON(JSON.parse(JSON.stringify(saved)));
  expect(reopened.version().encode()).toEqual(version);
  await reopened.close();
});

test("bad imports reject without changing state, version or persisted updates", async () => {
  const store = new MemoryStore(), doc = await Document.open(definition, store, initial);
  const state = doc.current, version = doc.version().encode();
  const data = JSON.parse(JSON.stringify(state));
  for (const bad of [
    { ...data, count: "wrong" },
    { ...data, rows: [{ name: "New", link: { $ref: "/missing" } }] },
    { ...data, rows: [data.rows[0], data.rows[0]] },
    { ...data, notes: { text: "wrong", delta: [{ insert: "different" }] } },
    { ...data, tree: [{ $id: data.rows[0].$id, name: "wrong container" }] },
    { ...data, surprise: true },
  ]) {
    expect(() => doc.importJSON(bad)).toThrow();
    expect(doc.current).toEqual(state);
    expect(doc.version().encode()).toEqual(version);
  }
  await doc.flush();
  expect((await store.load()).updates).toHaveLength(0);
  await doc.close();
});
