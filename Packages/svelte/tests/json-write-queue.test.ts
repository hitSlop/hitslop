import { expect, test } from "bun:test";
import { JsonWriteQueue } from "../src/json-write-queue.ts";

test("rebases a queued edit after a revision conflict", async () => {
  let stored = { count: 4 }; let revision = "remote"; let writes = 0; let visible = { count: 0 };
  const queue = new JsonWriteQueue({
    fallback: { count: 0 }, clone: (value) => structuredClone(value),
    read: async () => ({ value: stored, revision }),
    write: async (value, expected) => { writes += 1; if (writes === 1) throw new Error("revision_conflict"); expect(expected).toBe("remote"); stored = value; revision = "saved"; return { revision }; },
    onValue: (value) => { visible = value; }, onRevision: () => {}, onSource: () => {}, onError: () => {},
  });
  queue.enqueue((value) => { value.count += 1; });
  await queue.drain();
  expect(visible.count).toBe(5); expect(stored.count).toBe(5); expect(revision).toBe("saved");
});
