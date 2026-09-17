import { afterEach, expect, test } from "bun:test";
import { Authority, MockHost } from "../src/host.ts";
import { createController } from "../src/controller.ts";
import { TextDrafts } from "../src/text.ts";
import { paths, read } from "../src/paths.ts";
import { fixtureSchema, initial } from "./fixtures.ts";
import { type Mutations } from "../src/controller.ts";

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
async function setup() {
  const authority = new Authority(fixtureSchema, initial);
  const a = new MockHost(authority, "A"), b = new MockHost(authority, "B");
  const left = createController({ schema: fixtureSchema, initial, host: a });
  const right = createController({ schema: fixtureSchema, initial, host: b });
  const drafts = new TextDrafts(left, 10);
  cleanups.push(() => { drafts.dispose(); left.dispose(); right.dispose(); a.dispose(); b.dispose(); });
  await Promise.all([left.ready, right.ready]);
  return { authority, a, b, left, right, drafts, $: paths(fixtureSchema) };
}

test("resolving a lost text ack does not replay over a newer remote edit", async () => {
  const { a, left, right, $, drafts, authority } = await setup();
  const draft = drafts.create($.title); draft.attach(); draft.focused = true;
  a.dropAckNext = true; draft.edit("Accepted before remote");
  expect((await draft.commit(true)).ok).toBe(false);
  await right.set($.title, "Newer remote");
  expect((await left.retryUnknown()).ok).toBe(true);
  expect(draft.dirty).toBe(false);
  expect((await left.flush()).ok).toBe(true);
  expect(authority.snapshot.data).toMatchObject({ title: "Newer remote" });
  expect(authority.snapshot.revision).toBe(2);
});

test("two clients increment against current authority without lost updates", async () => {
  const { left, right, $, authority } = await setup();
  await Promise.all(Array.from({ length: 20 }, (_, n) => (n % 2 ? left : right).increment($.count)));
  expect(left.data.count).toBe(20); expect(right.data.count).toBe(20); expect(authority.snapshot.revision).toBe(20);
});
test("there is no optimistic document update before acknowledgement", async () => {
  const { a, left, $ } = await setup(); a.latency = 50;
  const command = left.increment($.count);
  expect(left.data.count).toBe(0); expect(left.pending).toBe(1);
  expect((await command).ok).toBe(true); expect(left.data.count).toBe(1);
});
test("offline writes are not queued and reconnect replaces cached state", async () => {
  const { a, left, right, $, authority } = await setup(); a.setConnected(false);
  expect((await left.increment($.count)).ok).toBe(false);
  await right.increment($.count, 5); expect(left.data.count).toBe(0);
  a.setConnected(true); expect(left.data.count).toBe(5); expect(authority.snapshot.revision).toBe(1);
});
test("lost acknowledgement is resolved with the original request exactly once", async () => {
  const { a, left, $, authority } = await setup(); a.dropAckNext = true;
  const result = await left.increment($.count);
  expect(result.ok ? "" : result.error.code).toBe("unknown_outcome");
  expect(left.hasUnknownOutcome).toBe(true);
  left.clearError(); expect((await left.flush()).ok).toBe(false);
  expect((await left.increment($.count)).ok).toBe(false);
  expect((await left.retryUnknown()).ok).toBe(true);
  expect(left.hasUnknownOutcome).toBe(false); expect(left.data.count).toBe(1); expect(authority.snapshot.revision).toBe(1);
});
test("mutations keep captured input values rather than caller references", async () => {
  const { a, left, $ } = await setup(); a.latency = 20;
  const row = { id: "c", text: "Captured", done: false, archived: false, children: [] };
  const command = left.insert($.tasks, row); row.text = "Mutated outside";
  await command; expect(left.data.tasks[2]?.text).toBe("Captured");
});
test("thrown callback, nested batch, outer writer, and async callback all abort", async () => {
  const { left, $, authority } = await setup();
  for (const callback of [
    (tx: Mutations<void>) => { tx.increment($.count); throw new Error("stop"); },
    (tx: Mutations<void>) => { tx.increment($.count); left.change(inner => inner.increment($.count)); },
    (tx: Mutations<void>) => { tx.increment($.count); void left.increment($.count); },
    async (tx: Mutations<void>) => { tx.increment($.count); },
  ]) {
    expect((await left.change(callback)).ok).toBe(false);
    expect(authority.snapshot.revision).toBe(0);
  }
});
test("batch validates only its final candidate and publishes one revision", async () => {
  const { left, $, authority } = await setup();
  expect((await left.change(tx => { tx.increment($.count, -1); tx.increment($.count, 3); })).ok).toBe(true);
  expect(left.data.count).toBe(2); expect(authority.snapshot.revision).toBe(1);
});
test("patch is atomic, unknown fields survive, and paths capture row IDs", async () => {
  const { left, $, authority } = await setup();
  const row = { id: "a" }, path = $.tasks.item(row); row.id = "b";
  await left.patch(path, { done: true, archived: true });
  expect(left.data.tasks[0]?.done).toBe(true); expect(left.data.tasks[1]?.done).toBe(false);
  expect(authority.snapshot.data).toHaveProperty("unknown.extension", "preserved");
  expect(read(left.data, path.text)).toBe("Alpha");
});
test("focused drafts survive remote snapshots and last accepted text wins", async () => {
  const { drafts, right, $, left } = await setup();
  const draft = drafts.create($.title); draft.attach(); draft.focused = true;
  draft.composing = true; draft.edit("Local unfinished");
  await right.set($.title, "Remote complete");
  expect(draft.value).toBe("Local unfinished"); expect(left.data.title).toBe("Remote complete");
  expect((await draft.commit(true)).ok).toBe(true); expect(right.data.title).toBe("Local unfinished");
});
test("unchanged focused field does not overwrite a remote edit on blur", async () => {
  const { drafts, right, $ } = await setup();
  const draft = drafts.create($.title); draft.attach(); draft.focused = true;
  await right.set($.title, "Remote"); draft.blur();
  expect(draft.value).toBe("Remote"); expect(right.data.title).toBe("Remote");
});
test("rejected text stays editable and flush retries it", async () => {
  const { drafts, a, left, $ } = await setup();
  const draft = drafts.create($.title); draft.attach(); draft.edit("Keep this");
  a.rejectNext = true; expect((await draft.commit(true)).ok).toBe(false);
  expect(draft.value).toBe("Keep this"); expect(draft.dirty).toBe(true); expect(left.data.title).toBe("Original");
  left.clearError(); expect((await left.flush()).ok).toBe(true); expect(left.data.title).toBe("Keep this");
});
test("remote deletion retains detached dirty text until explicit discard", async () => {
  const { drafts, right, left, $ } = await setup();
  const draft = drafts.create($.tasks.item("a").text); draft.attach(); draft.composing = true; draft.edit("Do not lose me");
  await right.remove($.tasks, "a"); draft.detach();
  expect((await left.flush()).ok).toBe(false);
  expect(drafts.retained[0]?.value).toBe("Do not lose me");
  drafts.discard(draft.id); left.clearError(); expect((await left.flush()).ok).toBe(true);
});
test("IME waits for composition, explicit flush drains latest draft during pending commit", async () => {
  const { drafts, a, left, $ } = await setup();
  const draft = drafts.create($.title); draft.attach(); draft.composing = true; draft.edit("日本");
  await Bun.sleep(20); expect(left.data.title).toBe("Original");
  a.latency = 30; const pending = draft.commit(true); draft.edit("日本語");
  await pending; left.clearError(); await left.flush(); expect(left.data.title).toBe("日本語");
});
test("out of order full snapshots cannot roll back confirmed state", async () => {
  const { a, left, $, authority } = await setup(); a.latency = 40;
  authority.execute({ requestId: "slow", ops: [{ op: "increment", path: [{ key: "count" }], amount: 1 }] });
  a.latency = 0; await left.increment($.count); await Bun.sleep(50);
  expect(left.data.count).toBe(2); expect(left.revision).toBe(2);
});
