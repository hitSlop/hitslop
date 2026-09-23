import { expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import { Document } from "../src/document";
import { defineDocument, s } from "../src/schema";
import { MemoryStore } from "../src/memory";
import { bindValue } from "../src/bind-value";
import { bindText, diff } from "../src/bind-text";

class Control extends EventTarget {
  value = "";
  checked = false;
  disabled = false;
  type = "range";
  tagName = "INPUT";
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  setSelectionRange(start: number, end: number) { this.selectionStart = start; this.selectionEnd = end; }
}
const setting = defineDocument({ volume: s.number({ min: 0, max: 1 }) });

test("range change commits before flush and autosaves; unchanged controls do not write", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(setting, store, { volume: 0 });
  const control = new Control();
  const action = bindValue(control as any, doc.fields.volume);
  const version = doc.version().encode();
  control.dispatchEvent(new Event("input"));
  control.dispatchEvent(new Event("change"));
  expect(doc.version().encode()).toEqual(version);
  for (const value of ["0.2", "0.4", "0.8"]) {
    control.value = value;
    control.dispatchEvent(new Event("input"));
  }
  expect(doc.version().encode()).toEqual(version);
  control.dispatchEvent(new Event("change"));
  expect(doc.version().encode()).not.toEqual(version);
  expect(doc.status).toBe("saving");
  // Deliberately do not flush: the change event must schedule autosave itself.
  for (let i = 0; i < 100 && doc.status !== "saved"; i++) await Bun.sleep(10);
  expect(doc.status).toBe("saved");
  expect((await store.load()).updates).toHaveLength(1);
  const committed = doc.version().encode();
  control.dispatchEvent(new Event("change"));
  expect(doc.version().encode()).toEqual(committed);
  action.destroy();
  await doc.close();
  const reopened = await Document.open(setting, store, { volume: 0 });
  expect(reopened.current.volume).toBe(0.8);
  await reopened.close();
});

test("unfinished gestures commit on close and failed storage retains edits for retry", async () => {
  class FailingStore extends MemoryStore {
    fail = true;
    override async append(generation: string, updates: Uint8Array[]) {
      if (this.fail) throw new Error("disk unavailable");
      return super.append(generation, updates);
    }
  }
  const store = new FailingStore();
  const doc = await Document.open(setting, store, { volume: 0 });
  const control = new Control();
  const action = bindValue(control as any, doc.fields.volume);
  control.value = "0.7";
  control.dispatchEvent(new Event("input"));
  await expect(doc.close()).rejects.toThrow("disk unavailable");
  expect(doc.status).toBe("save-failed");
  expect(doc.current.volume).toBe(0.7);
  store.fail = false;
  await doc.close();
  action.destroy();
  const reopened = await Document.open(setting, store, { volume: 0 });
  expect(reopened.current.volume).toBe(0.7);
  await reopened.close();
});

test.each([
  ["😀", "😁"], ["😀", "\uD83E\uDE00"], ["a😀z", "a😁z"],
  ["😀😀", "😁😀"], ["a🦊b", "ab"], ["ab", "a🦊b"],
])("text binding respects code points: %s → %s", async (before, after) => {
  const schema = defineDocument({ title: s.text() });
  const doc = await Document.open(schema, new MemoryStore(), { title: before });
  const control = new Control();
  control.type = "text";
  const action = bindText(control as any, doc.fields.title);
  control.value = after;
  control.dispatchEvent(new Event("input"));
  expect(doc.current.title).toBe(after);
  expect(control.value).toBe(after);
  action.destroy();
  await doc.close();
});

test("Unicode composition rebases past an external prefix and preserves a focused caret", async () => {
  const schema = defineDocument({ title: s.text() });
  const doc = await Document.open(schema, new MemoryStore(), { title: "😀" });
  const control = new Control();
  control.type = "text";
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: control } });
  const action = bindText(control as any, doc.fields.title);
  try {
    control.dispatchEvent(new Event("compositionstart"));
    control.value = "😁";
    control.selectionStart = control.selectionEnd = 2;
    doc.fields.title.splice(0, 0, "Hi ");
    control.dispatchEvent(new Event("compositionend"));
    expect(doc.current.title).toBe("Hi 😁");
    expect(control.selectionStart).toBe(5);
    expect(control.selectionEnd).toBe(5);
    expect(diff("same", "same")).toEqual({ index: 4, delete: 0, insert: "" });
  } finally {
    action.destroy();
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
    await doc.close();
  }
});

test("optional row lists and trees initialize, clear and recreate, including record entries", async () => {
  const item = s.object({ label: s.text() });
  const schema = defineDocument({
    rows: s.optional(s.list(item)), tree: s.optional(s.tree(item)),
    lists: s.record(s.list(item)), trees: s.record(s.tree(item)),
  });
  const store = new MemoryStore();
  const initial = { lists: {}, trees: {} };
  const doc = await Document.open(schema, store, initial);
  doc.change(tx => {
    tx.fields.rows.set([{ label: "first" }]);
    tx.fields.tree.set([{ label: "root", children: [{ label: "child" }] }]);
    tx.fields.lists.put("a", [{ label: "row" }]);
    tx.fields.trees.put("a", [{ label: "node" }]);
  });
  const first = doc.current.rows![0]!.$id;
  doc.fields.rows.item(first).label.replace("edited");
  expect(doc.current.rows![0]!.$id).toBe(first);
  expect(() => doc.fields.rows.set([])).toThrow("identity");
  expect(() => doc.fields.tree.set([])).toThrow("identity");
  expect(() => doc.fields.lists.put("a", [])).toThrow("identity");
  expect(() => doc.fields.trees.put("a", [])).toThrow("identity");
  doc.fields.rows.clear();
  doc.fields.rows.set([{ label: "new" }]);
  expect(doc.current.rows![0]!.$id).not.toBe(first);
  doc.fields.trees.delete("a");
  doc.fields.trees.put("a", [{ label: "new node" }]);
  const current = doc.current;
  await doc.close();
  const reopened = await Document.open(schema, store, initial);
  expect(reopened.current).toEqual(current);
  await reopened.close();
});

test("nested collection replacement rejects before any writes, including inside a caught transaction", async () => {
  const item = s.object({ label: s.text() });
  const block = s.object({ caption: s.text(), rows: s.list(item) });
  const schema = defineDocument({ block: s.optional(block), blocks: s.record(block) });
  const doc = await Document.open(schema, new MemoryStore(), { blocks: {} });
  doc.fields.block.set({ caption: "original", rows: [{ label: "keep" }] });
  doc.fields.blocks.put("a", { caption: "original", rows: [{ label: "keep" }] });
  const before = doc.current;
  const version = doc.version().encode();
  expect(() => doc.fields.block.set({ caption: "bad", rows: [] })).toThrow("identity");
  expect(() => doc.fields.blocks.put("a", { caption: "bad", rows: [] })).toThrow("identity");
  expect(() => doc.change(tx => {
    tx.fields.block.caption.replace("also discarded");
    try { tx.fields.block.set({ caption: "bad", rows: [] }); } catch {}
  })).toThrow("identity");
  expect(doc.current).toBe(before);
  expect(doc.version().encode()).toEqual(version);
  await doc.close();
});

test("valid shallow checkpoints remain readable without enabling automatic pruning", async () => {
  const source = await Document.open(setting, new MemoryStore(), { volume: 0 });
  source.fields.volume.set(0.9);
  const engine = new LoroDoc();
  engine.import(source.exportSnapshot());
  const checkpoint = engine.export({ mode: "shallow-snapshot", frontiers: engine.oplogFrontiers() });
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
