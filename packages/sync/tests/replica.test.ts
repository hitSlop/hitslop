import { expect, test } from "bun:test";
import { Replica, exchange, type DocumentValue } from "../src/replica.ts";
import * as S from "../../schema/src/document.ts";
import { checklist, trip } from "./fixtures.ts";

const replica = (peerId: string, initial: DocumentValue<typeof checklist> = trip) =>
  new Replica({ schema: checklist, initial, peerId });

test("seeds application JSON from S.Document", () => {
  expect(replica("1").current()).toEqual(trip);
});

test("checkbox and extra fields round-trip", () => {
  const doc = replica("1", { ...trip, mood: "ok" });
  doc.update(draft => {
    const task = draft.tasks[0];
    if (task) task.done = true;
  });
  expect(doc.current()).toEqual({
    title: "Trip",
    mood: "ok",
    tasks: [
      { id: "task-a", text: "Book hotel", done: true, archived: false },
      { id: "task-b", text: "Pack charger", done: false, archived: false },
    ],
  });
});

test("two peers converge on concurrent checkbox and text", () => {
  const sam = replica("1");
  const alex = new Replica({ schema: checklist, snapshot: sam.exportSnapshot(), peerId: "2" });
  exchange(sam, alex);
  sam.update(draft => {
    const task = draft.tasks[0];
    if (task) task.done = true;
  });
  alex.update(draft => {
    const task = draft.tasks[0];
    if (task) task.text = "Book a hotel";
  });
  exchange(sam, alex);
  expect(sam.current()).toEqual(alex.current());
  expect(sam.current().tasks[0]).toEqual({ id: "task-a", text: "Book a hotel", done: true, archived: false });
});

test("distinct concurrent moves preserve every item and converge", () => {
  const initial = { ...trip, tasks: ["a", "b", "c", "d"].map(id => ({ ...trip.tasks[0]!, id })) };
  const sam = replica("1", initial);
  const alex = new Replica({ schema: checklist, snapshot: sam.exportSnapshot(), peerId: "2" });
  sam.update(draft => { draft.tasks.push(draft.tasks.shift()!); });
  alex.update(draft => { draft.tasks.unshift(draft.tasks.pop()!); });
  exchange(sam, alex);
  expect(sam.current()).toEqual(alex.current());
  expect(sam.current().tasks.map(item => item.id).sort()).toEqual(["a", "b", "c", "d"]);
});

test("agent reorder and title keep a concurrent checkbox", () => {
  const sam = replica("1");
  const agent = new Replica({ schema: checklist, snapshot: sam.exportSnapshot(), peerId: "2" });
  exchange(sam, agent);
  const frontiers = agent.doc.oplogFrontiers();
  sam.update(draft => {
    const task = draft.tasks[0];
    if (task) task.done = true;
  });
  exchange(sam, agent);
  agent.applyAt(frontiers, {
    title: "Road trip",
    tasks: [
      { id: "task-b", text: "Pack charger", done: false, archived: false },
      { id: "task-a", text: "Book hotel", done: false, archived: false },
    ],
  });
  exchange(sam, agent);
  expect(sam.current()).toEqual(agent.current());
  expect(sam.current()).toEqual({
    title: "Road trip",
    tasks: [
      { id: "task-b", text: "Pack charger", done: false, archived: false },
      { id: "task-a", text: "Book hotel", done: true, archived: false },
    ],
  });
});

test("rejects duplicate ids on update", () => {
  const doc = replica("1");
  expect(() => doc.update(draft => {
    draft.tasks.push({ id: "task-a", text: "Clone", done: false, archived: false });
  })).toThrow("duplicate id");
});

test("agent baseline preserves concurrent text, order, insertion and unknown fields", () => {
  const doc = replica("1");
  const other = new Replica({ schema: checklist, snapshot: doc.exportSnapshot(), peerId: "2" });
  const frontiers = doc.doc.oplogFrontiers();
  const baseline = doc.current();
  other.update(draft => {
    draft.tasks[0]!.text = "Book hotel tonight";
    draft.tasks.reverse();
    draft.tasks.push({ ...trip.tasks[0]!, id: "remote" });
    draft.mood = "happy";
  });
  exchange(doc, other);
  const edited = structuredClone(baseline);
  edited.tasks[0]!.text = "Book a hotel";
  edited.tasks[0]!.done = true;
  doc.applyAt(frontiers, edited);
  expect(doc.current().tasks.map(item => item.id)).toEqual(["task-b", "task-a", "remote"]);
  expect(doc.current().tasks[1]).toMatchObject({ text: "Book a hotel tonight", done: true });
  expect(doc.current().mood).toBe("happy");
  exchange(doc, other);
  expect(doc.current()).toEqual(other.current());
});

test("failed edits leave the live replica unchanged", () => {
  const doc = replica("1");
  const before = doc.exportUpdates();
  expect(() => doc.update(draft => { draft.title = "Changed"; draft.extra = undefined; })).toThrow();
  expect(doc.current()).toEqual(trip);
  expect(doc.exportUpdates()).toEqual(before);
});

test("nested record fields merge independently", () => {
  const schema = S.Document({ notes: S.Record(S.Object({ text: S.Text(), done: S.Boolean() })) });
  const a = new Replica({ schema, initial: { notes: { first: { text: "hello", done: false } } }, peerId: "1" });
  const b = new Replica({ schema, snapshot: a.exportSnapshot(), peerId: "2" });
  a.update(draft => { draft.notes.first!.text = "hello there"; });
  b.update(draft => { draft.notes.first!.done = true; });
  exchange(a, b);
  expect(a.current()).toEqual({ notes: { first: { text: "hello there", done: true } } });
  expect(a.current()).toEqual(b.current());
});

test("concurrent delete and text edit converge without resurrecting the list item", () => {
  const left = replica("10");
  const right = new Replica({ schema: checklist, peerId: "20", snapshot: left.exportSnapshot() });
  left.update(draft => { draft.tasks.splice(0, 1); });
  right.update(draft => { draft.tasks[0]!.text = "Edited concurrently"; });
  exchange(left, right);
  expect(left.current()).toEqual(right.current());
  expect(left.current().tasks.some(task => task.id === "task-a")).toBe(false);
});

test("same-scalar edits converge while duplicate domain IDs fail without changing live state", () => {
  const left = replica("10");
  const right = new Replica({ schema: checklist, peerId: "20", snapshot: left.exportSnapshot() });
  left.update(draft => { draft.title = "Left"; }); right.update(draft => { draft.title = "Right"; });
  exchange(left, right);
  expect(left.current()).toEqual(right.current());
  const task = { id: "same-new-id", text: "New", done: false, archived: false };
  left.update(draft => { draft.tasks.push(task); });
  right.update(draft => { draft.tasks.push({ ...task, text: "Other" }); });
  const before = left.current();
  expect(() => left.importUpdates(right.exportUpdates())).toThrow("duplicate");
  expect(left.current()).toEqual(before);
});
