import { test, expect } from "bun:test";
import { Document } from "../src/document";
import { defineDocument, s, OperationRejectedError } from "../src/schema";
import { MemoryStore } from "./helpers";
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
