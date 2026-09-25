// Guards gesture commit, autosave, retry, Unicode composition and caret rebasing.
import { expect, test } from "bun:test";
import { Document } from "../src/document";
import { defineDocument, s } from "../src/schema";
import { MemoryStore } from "../src/memory";
import { bindValue } from "../src/bind-value";
import { bindText } from "../src/bind-text";

class Control extends EventTarget {
  value = "";
  checked = false;
  disabled = false;
  type = "range";
  tagName = "INPUT";
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  setSelectionRange(start: number, end: number) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
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
  ["😀", "😁"],
  ["😀", "\uD83E\uDE00"],
  ["a😀z", "a😁z"],
  ["😀😀", "😁😀"],
  ["a🦊b", "ab"],
  ["ab", "a🦊b"],
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
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { activeElement: control },
  });
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
  } finally {
    action.destroy();
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
    await doc.close();
  }
});
