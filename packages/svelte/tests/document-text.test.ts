import { afterEach, expect, test } from "bun:test";
import * as S from "@hitslop/schema/document";
import { paths, read } from "@hitslop/schema/document";
import { MemoryAuthority } from "@hitslop/schema/document-authority";
import type { Request, Snapshot, Result } from "@hitslop/schema/document-protocol";
import {
  createDocumentController as createController,
  type Mutations,
  type CommandHost,
} from "../../runtime/src/document-controller.ts";
import { TextDrafts } from "../src/document-text.ts";
export const fixtureSchema = S.Document({
  title: S.String(),
  count: S.Integer({ minimum: 0 }),
  active: S.Boolean(),
  note: S.Optional(S.String()),
  tags: S.Array(S.String()),
  attributes: S.Record(S.String()),
  tasks: S.List(
    S.Object({
      id: S.String(),
      text: S.String(),
      done: S.Boolean(),
      archived: S.Boolean(),
      children: S.List(S.Object({ key: S.String(), value: S.Number() }), "key"),
    }),
    "id",
  ),
});
export const initial = {
  title: "Original",
  count: 0,
  active: false,
  tags: ["one"],
  attributes: { "a.b": "kept" },
  unknown: { extension: "preserved" },
  tasks: [
    {
      id: "a",
      text: "Alpha",
      done: false,
      archived: false,
      children: [{ key: "child", value: 1 }],
    },
    { id: "b", text: "Beta", done: false, archived: false, children: [] },
  ],
};

class MockHost implements CommandHost {
  connected = true;
  writable = true;
  latency = 0;
  dropAckNext = false;
  rejectNext = false;
  listeners = new Set<(snapshot: Snapshot) => void>();
  connections = new Set<() => void>();
  stop: () => void;
  constructor(readonly authority: MemoryAuthority) {
    this.stop = authority.subscribe((snapshot) => {
      if (this.connected) for (const cb of this.listeners) cb(snapshot);
    });
  }
  async open() {
    return this.authority.open();
  }
  async send(request: Request): Promise<Result> {
    if (this.latency) await Bun.sleep(this.latency);
    if (this.rejectNext) {
      this.rejectNext = false;
      return { ok: false, error: { code: "rejected", message: "Test rejection" } };
    }
    const result = await this.authority.execute(request);
    if (this.dropAckNext) {
      this.dropAckNext = false;
      throw new Error("Reply lost");
    }
    return result;
  }
  subscribe(cb: (snapshot: Snapshot) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  onConnection(cb: () => void) {
    this.connections.add(cb);
    return () => {
      this.connections.delete(cb);
    };
  }
  setConnected(value: boolean) {
    this.connected = this.writable = value;
    if (value) for (const cb of this.listeners) cb(this.authority.open().snapshot);
    for (const cb of this.connections) cb();
  }
  async flush() {}
  dispose() {
    this.stop();
  }
}
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
async function setup() {
  const engine = new MemoryAuthority(fixtureSchema, initial);
  const authority = {
    get snapshot() {
      return engine.open().snapshot;
    },
  };
  const a = new MockHost(engine),
    b = new MockHost(engine);
  const left = createController({ schema: fixtureSchema, initial, host: a });
  const right = createController({ schema: fixtureSchema, initial, host: b });
  const drafts = new TextDrafts(left, 10);
  cleanups.push(() => {
    drafts.dispose();
    left.dispose();
    right.dispose();
    a.dispose();
    b.dispose();
  });
  await Promise.all([left.ready, right.ready]);
  return { authority, a, b, left, right, drafts, $: paths(fixtureSchema) };
}
test("resolving a lost text ack does not replay over a newer remote edit", async () => {
  const { a, left, right, $, drafts, authority } = await setup();
  const draft = drafts.create($.title);
  const binding = draft.attach();
  binding.focused = true;
  a.dropAckNext = true;
  draft.edit("Accepted before remote");
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
  await Promise.all(
    Array.from({ length: 20 }, (_, n) => (n % 2 ? left : right).increment($.count)),
  );
  expect(left.data.count).toBe(20);
  expect(right.data.count).toBe(20);
  expect(authority.snapshot.revision).toBe(20);
});
test("there is no optimistic document update before acknowledgement", async () => {
  const { a, left, $ } = await setup();
  a.latency = 50;
  const command = left.increment($.count);
  expect(left.data.count).toBe(0);
  expect(left.pending).toBe(1);
  expect((await command).ok).toBe(true);
  expect(left.data.count).toBe(1);
});
test("offline writes are not queued and reconnect replaces cached state", async () => {
  const { a, left, right, $, authority } = await setup();
  a.setConnected(false);
  expect((await left.increment($.count)).ok).toBe(false);
  await right.increment($.count, 5);
  expect(left.data.count).toBe(0);
  a.setConnected(true);
  expect(left.data.count).toBe(5);
  expect(authority.snapshot.revision).toBe(1);
});
test("lost acknowledgement is resolved with the original request exactly once", async () => {
  const { a, left, $, authority } = await setup();
  a.dropAckNext = true;
  const result = await left.increment($.count);
  expect(result.ok ? "" : result.error.code).toBe("unknown_outcome");
  expect(left.hasUnknownOutcome).toBe(true);
  left.clearError();
  expect((await left.flush()).ok).toBe(false);
  expect((await left.increment($.count)).ok).toBe(false);
  expect((await left.retryUnknown()).ok).toBe(true);
  expect(left.hasUnknownOutcome).toBe(false);
  expect(left.data.count).toBe(1);
  expect(authority.snapshot.revision).toBe(1);
});
test("mutations keep captured input values rather than caller references", async () => {
  const { a, left, $ } = await setup();
  a.latency = 20;
  const row = { id: "c", text: "Captured", done: false, archived: false, children: [] };
  const command = left.insert($.tasks, row);
  row.text = "Mutated outside";
  await command;
  expect(left.data.tasks[2]?.text).toBe("Captured");
});
test("thrown callback, nested batch, outer writer, and async callback all abort", async () => {
  const { left, $, authority } = await setup();
  for (const callback of [
    (tx: Mutations<void>) => {
      tx.increment($.count);
      throw new Error("stop");
    },
    (tx: Mutations<void>) => {
      tx.increment($.count);
      left.transaction((inner) => inner.increment($.count));
    },
    (tx: Mutations<void>) => {
      tx.increment($.count);
      void left.increment($.count);
    },
    async (tx: Mutations<void>) => {
      tx.increment($.count);
    },
  ]) {
    expect((await left.transaction(callback)).ok).toBe(false);
    expect(authority.snapshot.revision).toBe(0);
  }
});
test("batch validates only its final candidate and publishes one revision", async () => {
  const { left, $, authority } = await setup();
  expect(
    (
      await left.transaction((tx) => {
        tx.increment($.count, -1);
        tx.increment($.count, 3);
      })
    ).ok,
  ).toBe(true);
  expect(left.data.count).toBe(2);
  expect(authority.snapshot.revision).toBe(1);
});
test("patch is atomic, unknown fields survive, and paths capture row IDs", async () => {
  const { left, $, authority } = await setup();
  const row = { id: "a" },
    path = $.tasks.item(row);
  row.id = "b";
  await left.patch(path, { done: true, archived: true });
  expect(left.data.tasks[0]?.done).toBe(true);
  expect(left.data.tasks[1]?.done).toBe(false);
  expect(authority.snapshot.data).toHaveProperty("unknown.extension", "preserved");
  expect(read(left.data, path.text)).toBe("Alpha");
});
test("focused drafts survive remote snapshots and last accepted text wins", async () => {
  const { drafts, right, $, left } = await setup();
  const draft = drafts.create($.title);
  const binding = draft.attach();
  binding.focused = true;
  binding.composing = true;
  draft.edit("Local unfinished");
  await right.set($.title, "Remote complete");
  expect(draft.value).toBe("Local unfinished");
  expect(left.data.title).toBe("Remote complete");
  expect((await draft.commit(true)).ok).toBe(true);
  expect(right.data.title).toBe("Local unfinished");
});
test("unchanged focused field does not overwrite a remote edit on blur", async () => {
  const { drafts, right, $ } = await setup();
  const draft = drafts.create($.title);
  const binding = draft.attach();
  binding.focused = true;
  await right.set($.title, "Remote");
  draft.blur(binding);
  expect(draft.value).toBe("Remote");
  expect(right.data.title).toBe("Remote");
});
test("rejected text stays editable and flush retries it", async () => {
  const { drafts, a, left, $ } = await setup();
  const draft = drafts.create($.title);
  const binding = draft.attach();
  draft.edit("Keep this");
  a.rejectNext = true;
  expect((await draft.commit(true)).ok).toBe(false);
  expect(draft.value).toBe("Keep this");
  expect(draft.dirty).toBe(true);
  expect(left.data.title).toBe("Original");
  left.clearError();
  expect((await left.flush()).ok).toBe(true);
  expect(left.data.title).toBe("Keep this");
});
test("remote deletion retains detached dirty text until explicit discard", async () => {
  const { drafts, right, left, $ } = await setup();
  const draft = drafts.create($.tasks.item("a").text);
  const binding = draft.attach();
  binding.composing = true;
  draft.edit("Do not lose me");
  await right.remove($.tasks, "a");
  draft.detach(binding);
  expect((await left.flush()).ok).toBe(false);
  expect(drafts.retained[0]?.value).toBe("Do not lose me");
  drafts.discard(draft.id);
  left.clearError();
  expect((await left.flush()).ok).toBe(true);
});
test("IME waits for composition, explicit flush drains latest draft during pending commit", async () => {
  const { drafts, a, left, $ } = await setup();
  const draft = drafts.create($.title);
  const binding = draft.attach();
  binding.composing = true;
  draft.edit("日本");
  await Bun.sleep(20);
  expect(left.data.title).toBe("Original");
  a.latency = 30;
  const pending = draft.commit(true);
  draft.edit("日本語");
  await pending;
  left.clearError();
  await left.flush();
  expect(left.data.title).toBe("日本語");
});

test("duplicate bindings retain their draft and independent focus/composition state", async () => {
  const { drafts, $, right } = await setup();
  const draft = drafts.create($.title),
    first = draft.attach(),
    second = draft.attach();
  first.focused = true;
  second.composing = true;
  draft.blur(first);
  expect(second.composing).toBe(true);
  draft.detach(first);
  expect(draft.attached).toBe(true);
  expect(draft.composing).toBe(true);
  expect(drafts.create($.title)).toBe(draft);
  second.composing = false;
  let paints = 0;
  draft.subscribe(() => paints++);
  await right.set($.title, "remote");
  expect(draft.value).toBe("remote");
  expect(paints).toBeGreaterThan(0);
  draft.detach(second);
  expect(drafts.create($.title)).not.toBe(draft);
});

test("discard reports pending and uncertain attempts without losing text", async () => {
  const { drafts, $, a, left } = await setup();
  const draft = drafts.create($.title);
  draft.attach();
  a.latency = 30;
  draft.edit("keep this");
  const pending = draft.commit(true);
  expect(drafts.discard(draft.id)).toMatchObject({
    ok: false,
    error: { code: "invalid_operation" },
  });
  expect(draft.value).toBe("keep this");
  await pending;
  a.dropAckNext = true;
  draft.edit("uncertain");
  await draft.commit(true);
  expect(drafts.discard(draft.id)).toMatchObject({ ok: false, error: { code: "unknown_outcome" } });
  await left.retryUnknown();
  expect(drafts.discard(draft.id).ok).toBe(true);
});

test("text attachments keep identity and selection across snapshots and duplicate mounts", async () => {
  const { textAttachment } = await import("../src/document-text.ts");
  const { drafts, $, right } = await setup();
  class Input extends EventTarget {
    current = "";
    paints = 0;
    selectionStart = 2;
    get value() {
      return this.current;
    }
    set value(value: string) {
      this.current = value;
      this.paints++;
    }
    setAttribute() {}
  }
  const text = textAttachment(drafts);
  const attach = text($.title);
  expect(text($.title)).toBe(attach);
  const first = new Input(),
    second = new Input();
  const detachFirst = attach(first as unknown as HTMLInputElement)!;
  const detachSecond = attach(second as unknown as HTMLInputElement)!;
  first.dispatchEvent(new Event("focus"));
  first.dispatchEvent(new Event("compositionstart"));
  first.value = "Typing";
  first.dispatchEvent(new Event("input"));
  const paints = first.paints;
  await right.set($.title, "Remote");
  expect(first.value).toBe("Typing");
  expect(first.paints).toBe(paints);
  expect(first.selectionStart).toBe(2);
  expect(text($.title)).toBe(attach);
  detachSecond();
  expect(drafts.create($.title).attached).toBe(true);
  first.dispatchEvent(new Event("compositionend"));
  await drafts.create($.title).commit(true);
  expect(first.paints).toBe(paints);
  detachFirst();
  expect(text($.title)).not.toBe(attach);
});
