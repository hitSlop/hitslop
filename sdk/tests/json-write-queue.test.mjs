import assert from "node:assert/strict";
import test from "node:test";
import { JsonWriteQueue } from "../packages/svelte/src/json-write-queue.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const callbacks = () => ({
  onValue() {},
  onRevision() {},
  onSource() {},
  onError(message) { if (message) throw new Error(message); },
});

test("serializes rapid mutations against the latest revision", async () => {
  let stored = { count: 0 };
  let revision = "r0";
  const expectedRevisions = [];
  const queue = new JsonWriteQueue({
    fallback: stored,
    clone,
    read: async () => ({ value: clone(stored), revision }),
    write: async (value, expectedRevision) => {
      expectedRevisions.push(expectedRevision);
      assert.equal(expectedRevision, revision);
      stored = clone(value);
      revision = `r${stored.count}`;
      return { revision };
    },
    ...callbacks(),
  });
  await queue.reload();
  queue.enqueue((value) => { value.count += 1; });
  queue.enqueue((value) => { value.count += 1; });
  queue.enqueue((value) => { value.count += 1; });
  await queue.flush();
  assert.deepEqual(stored, { count: 3 });
  assert.deepEqual(expectedRevisions, ["r0", "r1", "r2"]);
});

test("reloads and retries one external revision conflict", async () => {
  let stored = { count: 0 };
  let revision = "r0";
  let conflict = true;
  const errors = [];
  const queue = new JsonWriteQueue({
    fallback: stored,
    clone,
    read: async () => ({ value: clone(stored), revision }),
    write: async (value, expectedRevision) => {
      if (conflict) {
        conflict = false;
        stored = { count: 10 };
        revision = "external";
        throw new Error("revision_conflict");
      }
      assert.equal(expectedRevision, "external");
      stored = clone(value);
      revision = "r11";
      return { revision };
    },
    ...callbacks(),
    onError(message) { if (message) errors.push(message); },
  });
  await queue.reload();
  queue.enqueue((value) => { value.count += 1; });
  await queue.flush();
  assert.deepEqual(stored, { count: 11 });
  assert.deepEqual(errors, []);
});
