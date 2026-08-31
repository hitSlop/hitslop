import { expect, test } from "bun:test";
import { JsonWriteQueue } from "../src/json-write-queue.ts";

test("rebases a queued edit after a revision conflict", async () => {
  let stored = { count: 4 }; let revision = "remote"; let writes = 0; let visible = { count: 0 };
  const queue = new JsonWriteQueue({
    fallback: { count: 0 }, clone: (value) => structuredClone(value),
    open: async () => ({ value: stored, revision }),
    read: async () => ({ value: stored, revision }),
    write: async (value, expected) => { writes += 1; if (writes === 1) throw new Error("revision_conflict"); expect(expected).toBe("remote"); stored = value; revision = "saved"; return { revision }; },
    onValue: (value) => { visible = value; }, onRevision: () => {}, onSource: () => {}, onError: () => {},
  });
  queue.enqueue((value) => { value.count += 1; });
  await queue.drain();
  expect(visible.count).toBe(5); expect(stored.count).toBe(5); expect(revision).toBe("saved");
});

test("reports an initial open failure and keeps the edit available for retry", async () => {
  let attempts = 0; let stored = { count: 0 }; let visible = { count: 0 }; const messages: Array<string | null> = [];
  const queue = new JsonWriteQueue({
    fallback: { count: 0 }, clone: (value) => structuredClone(value),
    open: async () => { attempts += 1; if (attempts === 1) throw new Error("bridge unavailable"); return { value: stored, revision: "ready" }; },
    read: async () => ({ value: stored, revision: "ready" }),
    write: async (value) => { stored = value; return { revision: "saved" }; },
    onValue: (value) => { visible = value; }, onRevision: () => {}, onSource: () => {}, onError: (value) => { messages.push(value); },
  });
  queue.enqueue((value) => { value.count += 1; });
  await new Promise<void>((resolve) => { setTimeout(() => resolve(), 10); });
  expect(messages.at(-1)).toBe("bridge unavailable");
  expect(visible.count).toBe(1);
  await queue.drain();
  expect(stored.count).toBe(1);
  expect(messages.at(-1)).toBeNull();
});
