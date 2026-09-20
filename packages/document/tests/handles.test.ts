import { expect, test } from "bun:test";
import { Document } from "../src/document";
import { defineDocument, s } from "../src/schema";
import { bindText } from "../src/bind-text";
import { MemoryStore } from "./helpers";

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
  peerIO.stored = structuredClone(io.stored);
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
  expect(io.stored.updates).toHaveLength(1);
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
  expect(io.stored.updates).toHaveLength(1);
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
