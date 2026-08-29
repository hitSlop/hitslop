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

test("waits for the initial snapshot before writing queued mutations", async () => {
  let stored = { count: 40 };
  let revision = "r40";
  let releaseRead;
  const readGate = new Promise((resolve) => { releaseRead = resolve; });
  const writes = [];
  let recipeRuns = 0;
  const queue = new JsonWriteQueue({
    fallback: { count: 0 },
    clone,
    read: async () => {
      await readGate;
      return { value: clone(stored), revision };
    },
    write: async (value, expectedRevision) => {
      writes.push({ value: clone(value), expectedRevision });
      stored = clone(value);
      revision = "r41";
      return { revision };
    },
    ...callbacks(),
  });

  const loading = queue.reload();
  queue.enqueue((value) => {
    recipeRuns += 1;
    value.count += 1;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(writes, []);

  releaseRead();
  await loading;
  await queue.flush();
  assert.deepEqual(stored, { count: 41 });
  assert.deepEqual(writes, [{ value: { count: 41 }, expectedRevision: "r40" }]);
  assert.ok(recipeRuns > 1, "mutation recipes are replayable transactions");
});

test("retains pending mutations when the initial read fails", async () => {
  let stored = { count: 5 };
  let revision = "r5";
  let readFails = true;
  let writes = 0;
  const errors = [];
  const queue = new JsonWriteQueue({
    fallback: { count: 0 },
    clone,
    read: async () => {
      if (readFails) throw new Error("read_failed");
      return { value: clone(stored), revision };
    },
    write: async (value, expectedRevision) => {
      writes += 1;
      assert.equal(expectedRevision, revision);
      stored = clone(value);
      revision = "r6";
      return { revision };
    },
    ...callbacks(),
    onError(message) { if (message) errors.push(message); },
  });

  await assert.rejects(queue.reload(), /read_failed/);
  queue.enqueue((value) => { value.count += 1; });
  await queue.flush();
  assert.equal(writes, 0);
  assert.ok(errors.includes("read_failed"));

  readFails = false;
  await queue.reload();
  await queue.flush();
  assert.equal(writes, 1);
  assert.deepEqual(stored, { count: 6 });
});

test("serializes reloads behind an active write", async () => {
  let stored = { count: 0 };
  let revision = "r0";
  let releaseWrite;
  const writeGate = new Promise((resolve) => { releaseWrite = resolve; });
  const operations = [];
  const queue = new JsonWriteQueue({
    fallback: stored,
    clone,
    read: async () => {
      operations.push(`read:${revision}`);
      return { value: clone(stored), revision };
    },
    write: async (value, expectedRevision) => {
      operations.push(`write-start:${expectedRevision}`);
      await writeGate;
      stored = clone(value);
      revision = "r1";
      operations.push("write-end:r1");
      return { revision };
    },
    ...callbacks(),
  });

  await queue.reload();
  queue.enqueue((value) => { value.count += 1; });
  await new Promise((resolve) => setImmediate(resolve));
  const reloading = queue.reload();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(operations, ["read:r0", "write-start:r0"]);

  releaseWrite();
  await queue.flush();
  await reloading;
  assert.deepEqual(operations, ["read:r0", "write-start:r0", "write-end:r1", "read:r1"]);
  assert.deepEqual(stored, { count: 1 });
});
