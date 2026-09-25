// Guards descriptor interpretation, supported value kinds, identity-preserving edits and persisted reopen.
import { describe, expect, test } from "bun:test";
import { LoroDoc } from "loro-crdt";
import { Document } from "../src/document";
import { defineDocument, s, OperationRejectedError } from "../src/schema";
import { bindText } from "../src/bind-text";
import { bindValue } from "../src/bind-value";
import { MemoryStore } from "../src/memory";
import { copyStore } from "./helpers";

const schema = defineDocument({
  title: s.text(),
  notes: s.richtext({ bold: "after", link: "none" }),
  bpm: s.integer({ min: 40, max: 240 }),
  volume: s.number({ min: 0, max: 1 }),
  code: s.string({ maxLength: 4 }),
  cups: s.counter(),
  checkins: s.list(s.string()),
  pixels: s.list(s.enum(["off", "red", "blue"])),
  cells: s.record(
    s.object({ raw: s.string(), style: s.optional(s.object({ bold: s.boolean() })) }),
  ),
  done: s.record(s.boolean()),
  cover: s.optional(s.object({ caption: s.text(), tags: s.list(s.string()) })),
  tasks: s.list(
    s.object({
      text: s.text(),
      lane: s.enum(["todo", "doing", "done"]),
      meta: s.object({ points: s.integer() }),
    }),
  ),
  outline: s.tree(s.object({ label: s.text(), open: s.boolean() })),
});
type Root = typeof schema.fields.node;
const initial = {
  title: "Plan",
  notes: "Hello world",
  bpm: 120,
  volume: 0.5,
  code: "AB",
  cups: 2,
  checkins: ["2026-09-01"],
  pixels: ["off", "off", "off", "off"] as ("off" | "red" | "blue")[],
  cells: { A1: { raw: "1" }, B2: { raw: "=A1", style: { bold: true } } },
  done: { a: true },
  tasks: [
    { text: "One", lane: "todo" as const, meta: { points: 1 } },
    { text: "Two", lane: "doing" as const, meta: { points: 2 } },
  ],
  outline: [{ label: "Root", open: true, children: [{ label: "Child", open: false }] }],
};
const open = (store = new MemoryStore()) => Document.open(schema, store, initial);
/** Public exported bytes must reopen to the same visible state. */
async function consistent(doc: Document<Root>) {
  const store = new MemoryStore();
  await store.checkpoint("0", doc.exportSnapshot(), doc.key);
  const reopened = await open(store);
  expect(reopened.current).toEqual(doc.current);
  await reopened.close();
}

describe("vocabulary", () => {
  test("every node kind round-trips through fill, project and reopen", async () => {
    const store = new MemoryStore();
    const doc = await open(store);
    const { outline, ...rest } = doc.current;
    expect(rest).toMatchObject({
      title: "Plan",
      notes: { text: "Hello world", delta: [{ insert: "Hello world" }] },
      bpm: 120,
      cups: 2,
      checkins: ["2026-09-01"],
      cells: { A1: { raw: "1" }, B2: { raw: "=A1", style: { bold: true } } },
      done: { a: true },
    });
    expect(doc.current.cover).toBeUndefined();
    expect(outline[0]).toMatchObject({
      label: "Root",
      open: true,
      children: [{ label: "Child", open: false, children: [] }],
    });
    expect(typeof outline[0]!.$id).toBe("string");
    await doc.close();
    const reopened = await open(store);
    expect(reopened.current).toEqual(doc.current);
    await reopened.close();
  });

  test("handles cover every container and reject invalid edits", async () => {
    const doc = await open();
    const f = doc.fields;
    f.bpm.set(90);
    expect(() => f.bpm.set(90.5)).toThrow(OperationRejectedError);
    expect(() => f.bpm.set(300)).toThrow(OperationRejectedError);
    expect(() => f.volume.set(-1)).toThrow(OperationRejectedError);
    expect(() => f.code.set("TOO LONG")).toThrow(OperationRejectedError);
    f.cups.increment();
    f.cups.decrement(2);
    f.checkins.insert("2026-09-02");
    f.checkins.insert("2026-08-31", 0);
    f.checkins.move(0, 2);
    f.checkins.remove(1);
    f.pixels.set(2, "red");
    f.pixels.replace(["blue", "off", "red", "off", "red"]);
    expect(() => f.pixels.set(9, "red")).toThrow("out of range");
    expect(() => f.pixels.set(0, "green" as any)).toThrow(OperationRejectedError);
    f.cells.put("C3", { raw: "x", style: { bold: false } });
    f.cells.entry("A1").raw.set("2");
    f.cells.entry("A1").style.set({ bold: true });
    f.cells.entry("B2").style.clear();
    f.cells.delete("C3");
    expect(() => f.cells.entry("Z9").raw.set("absent")).toThrow("Absent value");
    expect(() => f.cells.put("__proto__", { raw: "" })).toThrow(OperationRejectedError);
    f.done.put("b", false);
    f.done.entry("a").set(false);
    f.cover.set({ caption: "Cover", tags: ["x"] });
    f.cover.caption.splice(0, 0, "My ");
    f.cover.tags.insert("y");
    f.title.splice(4, 0, "!");
    f.notes.mark({ start: 0, end: 5 }, "bold", true);
    expect(() => f.notes.mark({ start: 0, end: 5 }, "italic" as any, true)).toThrow(
      "Unknown rich text mark",
    );
    expect(() => f.title.splice(99, 0, "x")).toThrow("outside");
    const c = doc.current;
    expect(c.bpm).toBe(90);
    expect(c.cups).toBe(1);
    expect(c.checkins).toEqual(["2026-09-01", "2026-08-31"]);
    expect(c.pixels).toEqual(["blue", "off", "red", "off", "red"]);
    expect<unknown>(c.cells).toEqual({
      A1: { raw: "2", style: { bold: true } },
      B2: { raw: "=A1" },
    });
    expect<unknown>(c.done).toEqual({ a: false, b: false });
    expect<unknown>(c.cover).toEqual({ caption: "My Cover", tags: ["x", "y"] });
    expect(c.title).toBe("Plan!");
    expect(c.notes.delta).toEqual([
      { insert: "Hello", attributes: { bold: true } },
      { insert: " world" },
    ]);
    f.cover.clear();
    expect(doc.current.cover).toBeUndefined();
    expect(() => f.cover.caption.replace("gone")).toThrow("Absent value");
    await consistent(doc);
    await doc.close();
  });

  test("tree nodes insert, move by sibling or parent, reject cycles and remove", async () => {
    const doc = await open();
    const root = doc.current.outline[0]!;
    const child = root.children[0]!;
    const { id: second } = doc.fields.outline.insert({
      label: "Second",
      open: false,
      children: [{ label: "Nested", open: true }],
    });
    doc.fields.outline.item(second).label.replace("Second!");
    doc.fields.outline.move(second, { before: root.$id });
    expect(doc.current.outline.map((n) => n.label)).toEqual(["Second!", "Root"]);
    doc.fields.outline.move(child.$id, { parent: second });
    expect(doc.current.outline[0]!.children.map((n) => n.label)).toEqual(["Nested", "Child"]);
    expect(() => doc.fields.outline.move(second, { parent: child.$id })).toThrow(
      OperationRejectedError,
    );
    doc.fields.outline.move(child.$id, { parent: null });
    expect(doc.current.outline.map((n) => n.label)).toEqual(["Second!", "Root", "Child"]);
    doc.fields.outline.remove(second);
    expect(doc.current.outline.map((n) => n.label)).toEqual(["Root", "Child"]);
    expect(() => doc.fields.outline.item(second).open.set(true)).toThrow("Unknown tree node");
    await consistent(doc);
    await doc.close();
  });

  test("object rows insert relative to a sibling", async () => {
    const doc = await open();
    const [one, two] = doc.current.tasks;
    const { id } = doc.fields.tasks.insert(
      { text: "Between", lane: "todo", meta: { points: 3 } },
      { after: one!.$id },
    );
    expect(doc.current.tasks.map((t) => t.$id)).toEqual([one!.$id, id, two!.$id]);
    await doc.close();
  });
});

describe("snapshot handles", () => {
  test("at() resolves rows, nested objects, record entries and tree nodes, inside and outside change()", async () => {
    const doc = await open();
    const task = doc.current.tasks[1]!;
    doc.at(task).lane.set("done");
    doc.at(doc.current.tasks[1]!.meta).points.set(8);
    doc.at(doc.current.cells.A1!).raw.set("A");
    doc.at(doc.current.outline[0]!.children[0]!).open.set(true);
    doc.at(doc.current).bpm.set(100);
    doc.change(
      (tx) => {
        for (const t of doc.current.tasks) tx.at(t).lane.set("todo");
      },
      { message: "Reset lanes" },
    );
    const c = doc.current;
    expect(c.tasks.map((t) => [t.lane, t.meta.points])).toEqual([
      ["todo", 1],
      ["todo", 8],
    ]);
    expect(c.cells.A1!.raw).toBe("A");
    expect(c.outline[0]!.children[0]!.open).toBe(true);
    expect(c.bpm).toBe(100);
    // @ts-expect-error Foreign objects are rejected by types and by runtime ownership checks.
    expect(() => doc.at({})).toThrow("snapshot");
    const other = await open();
    expect(() => doc.at(other.current.tasks[0]!)).toThrow("snapshot");
    await other.close();
    const messages = (doc as any).engine.getAllChanges();
    const all = [...messages.values()].flat().map((change: any) => change.message);
    expect(all).toContain("Reset lanes");
    await doc.close();
  });

  test("unrelated edits keep row, record and tree identity", async () => {
    const doc = await open();
    const before = doc.current;
    doc.fields.title.replace("Changed");
    doc.fields.bpm.set(99);
    doc.fields.tasks.item(before.tasks[0]!.$id).text.replace("Edited");
    const after = doc.current;
    expect(after.tasks[1]).toBe(before.tasks[1]);
    expect(after.tasks[0]).not.toBe(before.tasks[0]);
    expect(after.cells).toBe(before.cells);
    expect(after.outline).toBe(before.outline);
    expect(after.checkins).toBe(before.checkins);
    doc.fields.cells.entry("A1").raw.set("changed");
    expect(doc.current.cells.B2).toBe(before.cells.B2);
    await consistent(doc);
    await doc.close();
  });

  test("seeded edits match independent text/counter/record outcomes and reopen", async () => {
    const doc = await open();
    const model = {
      title: initial.title,
      cups: initial.cups,
      cells: structuredClone(initial.cells) as Record<
        string,
        { raw: string; style?: { bold: boolean } }
      >,
    };
    let seed = 7;
    const random = (n: number) => (seed = (seed * 16807) % 2147483647) % n;
    const f = doc.fields;
    const actions = [
      () => {
        const at = random(model.title.length + 1);
        f.title.splice(at, 0, "x");
        model.title = model.title.slice(0, at) + "x" + model.title.slice(at);
      },
      () => f.tasks.insert({ text: `t${random(99)}`, lane: "todo", meta: { points: random(5) } }),
      () => {
        const rows = doc.current.tasks;
        if (rows.length > 1)
          f.tasks.move(rows[random(rows.length)]!.$id, { before: rows[random(rows.length)]!.$id });
      },
      () => {
        const rows = doc.current.tasks;
        if (rows.length) doc.at(rows[random(rows.length)]!.meta).points.set(random(50));
      },
      () => {
        const rows = doc.current.tasks;
        if (rows.length > 2) f.tasks.remove(rows[random(rows.length)]!.$id);
      },
      () => {
        const key = `K${random(6)}`,
          raw = String(random(9));
        f.cells.put(key, { raw });
        model.cells[key] = { raw };
      },
      () => {
        const keys = Object.keys(model.cells);
        if (keys.length) {
          const key = keys[random(keys.length)]!;
          f.cells.delete(key);
          delete model.cells[key];
        }
      },
      () => f.pixels.set(random(4), (["off", "red", "blue"] as const)[random(3)]!),
      () => {
        const by = random(3);
        f.cups.increment(by);
        model.cups += by;
      },
      () =>
        f.outline.insert(
          { label: "n", open: false },
          { parent: doc.current.outline[0]?.$id ?? null },
        ),
      () =>
        doc.change((tx) => {
          tx.fields.bpm.set(40 + random(100));
          tx.fields.checkins.insert(String(random(9)));
        }),
    ];
    for (let i = 0; i < 400; i++) {
      try {
        actions[random(actions.length)]!();
      } catch (error) {
        if (!(error instanceof OperationRejectedError)) throw error;
      }
      expect(doc.current.title).toBe(model.title);
      expect(doc.current.cups).toBe(model.cups);
      expect<unknown>(doc.current.cells).toEqual(model.cells);
      if (i % 25 === 0) await consistent(doc);
    }
    await consistent(doc);
    await doc.close();
  });
});

describe("collaboration", () => {
  async function pair() {
    const ia = new MemoryStore();
    const a = await open(ia);
    const ib = new MemoryStore();
    await copyStore(ia, ib);
    const b = await open(ib);
    const exchange = async () => {
      const aa = a.exportUpdates(b.version());
      const bb = b.exportUpdates(a.version());
      a.importUpdates(bb);
      b.importUpdates(aa);
      expect(a.current).toEqual(b.current);
      await consistent(a);
      await consistent(b);
    };
    return { a, b, exchange };
  }
  test("concurrent creation of the same optional object and record entry merges", async () => {
    const { a, b, exchange } = await pair();
    a.fields.cover.set({ caption: "From A", tags: ["a"] });
    b.fields.cover.set({ caption: "From B", tags: ["b"] });
    a.fields.cells.put("Z1", { raw: "a", style: { bold: true } });
    b.fields.cells.put("Z1", { raw: "b" });
    b.fields.cells.entry("Z1").style.set({ bold: false });
    await exchange();
    // One shared container per key: both sides' writes land in it rather than one subtree vanishing.
    expect(a.current.cover!.tags.slice().sort()).toEqual(["a", "b"]);
    expect(a.current.cells.Z1!.style).toBeDefined();
    await a.close();
    await b.close();
  });
  test("counters sum, scalar lists keep both inserts, concurrent tree moves never cycle", async () => {
    const { a, b, exchange } = await pair();
    a.fields.cups.increment(3);
    b.fields.cups.increment(4);
    a.fields.checkins.insert("from-a");
    b.fields.checkins.insert("from-b");
    const root = a.current.outline[0]!;
    const { id: other } = a.fields.outline.insert({ label: "Other", open: false });
    await exchange();
    a.fields.outline.move(other, { parent: root.$id });
    b.fields.outline.move(root.$id, { parent: other });
    await exchange();
    expect(a.current.cups).toBe(9);
    expect(a.current.checkins.slice().sort()).toEqual(["2026-09-01", "from-a", "from-b"]);
    const flat = (nodes: readonly any[]): string[] =>
      nodes.flatMap((n) => [n.$id, ...flat(n.children)]);
    expect(new Set(flat(a.current.outline)).size).toBe(flat(a.current.outline).length);
    expect(a.current.outline.length).toBeGreaterThan(0);
    await a.close();
    await b.close();
  });
});

describe("previews", () => {
  test("previews are visible, not persisted, and commit once at set or flush", async () => {
    const store = new MemoryStore();
    const doc = await open(store);
    await doc.flush();
    const before = (await store.load()).updates.length;
    for (const v of [0.1, 0.2, 0.3]) doc.fields.volume.preview(v);
    doc.fields.pixels.preview(1, "red");
    expect(doc.current.volume).toBe(0.3);
    expect(doc.current.pixels[1]).toBe("red");
    expect(() => doc.fields.volume.preview(2)).toThrow(OperationRejectedError);
    expect((doc as any).snapshot.volume).toBe(0.5);
    await doc.flush();
    expect((await store.load()).updates.length).toBe(before + 1);
    expect((doc as any).snapshot.volume).toBe(0.3);
    doc.fields.volume.preview(0.9);
    doc.fields.volume.set(0.4);
    expect(doc.current.volume).toBe(0.4);
    await doc.close();
    const reopened = await open(store);
    expect(reopened.current.volume).toBe(0.4);
    expect(reopened.current.pixels[1]).toBe("red");
    await reopened.close();
  });
});

class Control extends EventTarget {
  value = "";
  checked = false;
  disabled = false;
  type = "text";
  tagName = "INPUT";
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  setSelectionRange(start: number, end: number) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}
describe("bindings", () => {
  test("bindText splices local edits past remote edits made during composition", async () => {
    const doc = await open();
    const input = new Control();
    const action = bindText(input as any, doc.fields.title);
    expect(input.value).toBe("Plan");
    input.dispatchEvent(new Event("compositionstart"));
    input.value = "Plan 日本";
    input.dispatchEvent(new Event("input"));
    doc.fields.title.splice(0, 0, "My "); // remote edit while composing
    expect(input.value).toBe("Plan 日本");
    input.dispatchEvent(new Event("compositionend"));
    expect(doc.current.title).toBe("My Plan 日本");
    expect(input.value).toBe("My Plan 日本");
    input.value = "My Plan 日本!";
    input.dispatchEvent(new Event("input"));
    expect(doc.current.title).toBe("My Plan 日本!");
    action.destroy();
    await doc.close();
  });
  test("bindValue previews range input and commits once on change", async () => {
    const store = new MemoryStore();
    const doc = await open(store);
    await doc.flush();
    const before = (await store.load()).updates.length;
    const range = new Control();
    range.type = "range";
    const action = bindValue(range as any, doc.fields.bpm);
    expect(range.value).toBe("120");
    for (const v of ["121", "130", "140"]) {
      range.value = v;
      range.dispatchEvent(new Event("input"));
    }
    expect(doc.current.bpm).toBe(140);
    range.dispatchEvent(new Event("change"));
    await doc.flush();
    expect((await store.load()).updates.length).toBe(before + 1);
    const box = new Control();
    box.type = "checkbox";
    const toggle = bindValue(box as any, doc.fields.done.entry("a"));
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event("change"));
    expect(doc.current.done.a).toBe(false);
    action.destroy();
    toggle.destroy();
    await doc.close();
  });
});

describe("storage", () => {
  test("checkpoints retain history and reopen identically", async () => {
    const store = new MemoryStore();
    const doc = await open(store);
    const base = doc.version();
    const baseSnapshot = doc.exportSnapshot();
    for (let i = 0; i < 3000; i++) doc.fields.cups.increment();
    await doc.compact();
    const stored = await store.load();
    expect(stored.updates).toHaveLength(0);
    await doc.close();
    const reopened = await open(store);
    // Updates from the original version remain available after checkpoint/reopen.
    const receiver = new LoroDoc();
    receiver.import(baseSnapshot);
    receiver.import(reopened.exportUpdates(base));
    expect((receiver.toJSON().data as any).cups).toBe(3002);
    receiver.free();
    expect(reopened.current.cups).toBe(3002);
    reopened.fields.cups.increment();
    await reopened.close();
    const again = await open(store);
    expect(again.current.cups).toBe(3003);
    await again.close();
  });
});
