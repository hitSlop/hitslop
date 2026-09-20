import { expect, test } from "bun:test";
import { LoroDoc, type LoroMap, type ContainerID } from "loro-crdt";
import { Document } from "../src/document";
import { defineDocument, s } from "../src/schema";
import { MemoryStore } from "./helpers";
const schema = defineDocument({
  title: s.text(),
  tasks: s.list(s.object({ text: s.text(), done: s.boolean() })),
});
const initial = {
  title: "abc",
  tasks: [
    { text: "first", done: false },
    { text: "second", done: false },
    { text: "third", done: false },
  ],
};
async function pair() {
  const ia = new MemoryStore(),
    a = await Document.open(schema, ia, initial),
    ib = new MemoryStore();
  ib.stored = structuredClone(ia.stored);
  const b = await Document.open(schema, ib, initial);
  return { a, b, ia, ib };
}
function exchange(a: Document<any>, b: Document<any>) {
  const aa = a.exportUpdates(b.version()),
    bb = b.exportUpdates(a.version());
  a.importUpdates(bb);
  b.importUpdates(aa);
  a.importUpdates(bb);
  b.importUpdates(aa);
  expect(a.current).toEqual(b.current);
}
test("offline text ancestry, duplicate delivery and reopen converge", async () => {
  const { a, b, ia, ib } = await pair();
  for (const title of ["abcX", "abcXY", "abcXYZ"]) a.text(schema.fields.title).replace(title);
  b.text(schema.fields.title).replace("Qabc");
  b.set(schema.fields.tasks.item(b.current.tasks[0]!.$id).done, true);
  exchange(a, b);
  expect(a.current.title).toBe("QabcXYZ");
  expect(a.current.tasks[0]!.done).toBe(true);
  await a.close();
  await b.close();
  const ar = await Document.open(schema, ia, initial),
    br = await Document.open(schema, ib, initial);
  exchange(ar, br);
  expect(ar.current.title).toBe("QabcXYZ");
  await ar.close();
  await br.close();
});
test("concurrent move/edit preserves identity and both edits", async () => {
  const { a, b } = await pair(),
    id = a.current.tasks[0]!.$id;
  a.move(schema.fields.tasks, id, { after: a.current.tasks[2]!.$id });
  b.text(schema.fields.tasks.item(id).text).replace("Edited");
  exchange(a, b);
  expect(a.current.tasks[2]!.$id).toBe(id);
  expect(a.current.tasks[2]!.text).toBe("Edited");
  await a.close();
  await b.close();
});
test("delete/edit convergence does not resurrect a row", async () => {
  const { a, b } = await pair(),
    id = a.current.tasks[0]!.$id;
  a.remove(schema.fields.tasks, id);
  b.text(schema.fields.tasks.item(id).text).replace("Edited");
  exchange(a, b);
  expect(a.current.tasks.some((row) => row.$id === id)).toBe(false);
  await a.close();
  await b.close();
});
test("out-of-order imports are rejected until dependencies arrive", async () => {
  const { a, b } = await pair(),
    before = a.version();
  a.text(schema.fields.title).replace("abc1");
  const first = a.exportUpdates(before),
    mid = a.version();
  a.text(schema.fields.title).replace("abc12");
  const second = a.exportUpdates(mid);
  expect(() => b.importUpdates(second)).toThrow("dependencies");
  expect(b.current.title).toBe("abc");
  b.importUpdates(first);
  b.importUpdates(second);
  expect(b.current.title).toBe("abc12");
  await a.close();
  await b.close();
});
test("invalid remote scalar, unknown field and wrong container never enter live state", async () => {
  const { a, b } = await pair();
  for (const mutate of [
    (fork: LoroDoc) =>
      (fork.getContainerById(b.current.tasks[0]!.$id as ContainerID) as LoroMap).set(
        "done",
        "invalid",
      ),
    (fork: LoroDoc) => fork.getMap("data").set("unknown", true),
    (fork: LoroDoc) => fork.getMap("data").set("title", "wrong container"),
  ]) {
    const fork = new LoroDoc();
    fork.import(b.exportSnapshot());
    mutate(fork);
    fork.commit();
    const before = a.version().encode();
    expect(() => a.importUpdates(fork.export({ mode: "update" }))).toThrow();
    expect(a.version().encode()).toEqual(before);
    fork.free();
  }
  await a.close();
  await b.close();
});
test("staged batch merges alongside another peer's text edit", async () => {
  const { a, b } = await pair();
  a.transaction((tx) => {
    tx.text(schema.fields.title).replace("abcXYZ");
    tx.set(schema.fields.tasks.item(a.current.tasks[0]!.$id).done, true);
  });
  b.text(schema.fields.title).replace("Qabc");
  exchange(a, b);
  expect(a.current.title).toBe("QabcXYZ");
  expect(a.current.tasks[0]!.done).toBe(true);
  await a.close();
  await b.close();
});
