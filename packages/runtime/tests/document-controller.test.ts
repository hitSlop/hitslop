import { expect, test } from "bun:test";
import * as S from "@hitslop/schema/document";
import { MemoryAuthority } from "@hitslop/schema/document-authority";
import type { Open, Request, Result, Snapshot } from "@hitslop/schema/document-protocol";
import { createDocumentController, type CommandHost } from "../src/document-controller.js";

const schema = S.Document({
  count: S.Integer(),
  tasks: S.List(S.Object({ id: S.String(), text: S.String() }), "id"),
});
const fields = S.paths(schema);
const initial = {
  count: 0,
  tasks: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
};
class Host implements CommandHost {
  connected = true;
  writable = true;
  opens = 0;
  dropNext = false;
  listeners = new Set<(snapshot: Snapshot) => void>();
  connections = new Set<() => void>();
  requests: Request[] = [];
  constructor(public authority = new MemoryAuthority(schema, initial)) {
    this.authority.subscribe((snapshot) => this.publish(snapshot));
  }
  publish(snapshot: Snapshot) {
    for (const listener of this.listeners) listener(structuredClone(snapshot));
  }
  async open(): Promise<Open> {
    this.opens++;
    return structuredClone(this.authority.open());
  }
  async send(request: Request): Promise<Result> {
    this.requests.push(structuredClone(request));
    const result = await this.authority.execute(request);
    if (this.dropNext) {
      this.dropNext = false;
      throw new Error("lost reply");
    }
    return result;
  }
  subscribe(listener: (snapshot: Snapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  onConnection(listener: () => void) {
    this.connections.add(listener);
    return () => {
      this.connections.delete(listener);
    };
  }
  async flush() {}
}

test("commands advance repeatedly with one snapshot per commit and no post-command opens", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  for (let n = 1; n <= 3; n++) {
    expect((await controller.increment(fields.count)).ok).toBe(true);
    expect(controller.data.count).toBe(n);
  }
  expect(host.opens).toBe(1);
  await controller.destroy();
  expect(host.listeners.size).toBe(0);
});

test("unknown outcome retries the immutable request and never repeats its mutation", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  host.dropNext = true;
  expect((await controller.increment(fields.count)).ok).toBe(false);
  expect(controller.hasUnknownOutcome).toBe(true);
  expect(controller.data.count).toBe(1);
  expect((await controller.increment(fields.count)).ok).toBe(false);
  expect((await controller.retryUnknown()).ok).toBe(true);
  expect(host.requests[0]!.requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(host.requests[0]).toEqual(host.requests[1]);
  expect(controller.data.count).toBe(1);
  controller.dispose();
});

test("insert fills the identity once, preserves input, and retries without duplicating the row", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const input = Object.freeze({ text: "New task" });
  const inserted = await controller.insert(fields.tasks, input);
  expect(inserted.ok).toBe(true);
  if (!inserted.ok) throw new Error(inserted.error.message);
  expect(controller.data.tasks.at(-1)).toEqual({ ...input, id: inserted.id });
  expect(input).toEqual({ text: "New task" });
  host.dropNext = true;
  expect((await controller.insert(fields.tasks, { text: "Lost reply" })).ok).toBe(false);
  const sent = host.requests.at(-1)!;
  expect((await controller.retryUnknown()).ok).toBe(true);
  expect(host.requests.at(-1)).toEqual(sent);
  expect(controller.data.tasks.filter((row) => row.text === "Lost reply")).toHaveLength(1);
  const explicit = await controller.insert(fields.tasks, { id: "imported", text: "Imported" });
  expect(explicit).toMatchObject({ ok: true, id: "imported" });
  const count = controller.data.tasks.length;
  expect((await controller.insert(fields.tasks, { id: "imported", text: "Duplicate" })).ok).toBe(
    false,
  );
  expect(controller.data.tasks).toHaveLength(count);
  expect((await controller.insert(fields.tasks, { id: "", text: "Invalid" })).ok).toBe(false);
  // Explicit undefined is invalid JSON, not an omitted identity.
  expect(
    (await controller.insert(fields.tasks, { id: undefined, text: "Invalid" } as never)).ok,
  ).toBe(false);
  expect(controller.data.tasks).toHaveLength(count);
  controller.dispose();
});

test("transaction inserts reserve an identity for later commands and still commit atomically", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  let id = "";
  const result = await controller.transaction((tx) => {
    id = tx.insert(fields.tasks, { text: "Before" });
    tx.set(fields.tasks.item(id).text, "After");
  });
  expect(result).toMatchObject({ ok: true, revision: 1 });
  expect(controller.data.tasks.at(-1)).toEqual({ id, text: "After" });
  const failed = await controller.transaction((tx) => {
    tx.insert(fields.tasks, { text: "Rolled back" });
    tx.insert(fields.tasks, { id, text: "Duplicate" });
  });
  expect(failed.ok).toBe(false);
  expect(controller.revision).toBe(1);
  expect(controller.data.tasks).toHaveLength(3);
  controller.dispose();
});

test("automatic identities respect custom keys and authoritative identity constraints", async () => {
  const schema = S.Document({
    rows: S.List(S.Object({ key: S.String(), text: S.String() }), "key"),
    restricted: S.List(
      S.Object({ key: S.String({ pattern: "^custom-" }), text: S.String() }),
      "key",
    ),
  });
  const initial = { rows: [], restricted: [] },
    fields = S.paths(schema);
  const host = new Host(new MemoryAuthority(schema, initial));
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const generated = await controller.insert(fields.rows, { text: "Generated" });
  if (!generated.ok) throw new Error(generated.error.message);
  expect(controller.data.rows).toEqual([{ key: generated.id, text: "Generated" }]);
  expect((await controller.insert(fields.restricted, { text: "UUID does not match" })).ok).toBe(
    false,
  );
  const result = await controller.insert(fields.restricted, {
    key: "custom-import",
    text: "Valid",
  });
  expect(result).toMatchObject({ ok: true, id: "custom-import" });
  expect(controller.data.restricted).toEqual([{ key: "custom-import", text: "Valid" }]);
  controller.dispose();
});

test("only explicit handoff adopts a new epoch with lower revision", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  await controller.increment(fields.count);
  const old = host.authority.open(),
    replacement = new MemoryAuthority(schema, initial, {
      documentId: old.snapshot.documentId,
      schemaHash: old.snapshot.schemaHash,
      authority: "room",
    }).open();
  host.publish(replacement.snapshot);
  expect(controller.revision).toBe(1);
  expect((await controller.handoff(replacement, old.snapshot.authority)).ok).toBe(true);
  expect(controller.revision).toBe(0);
  expect(controller.data.count).toBe(0);
  host.publish({ ...old.snapshot, revision: 100 });
  expect(controller.revision).toBe(0);
  controller.dispose();
});

test("moves and insertions preserve existing row references", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const [a, b] = controller.data.tasks;
  await controller.move(fields.tasks, "a", { after: "b" });
  expect(controller.data.tasks[0]).toBe(b);
  expect(controller.data.tasks[1]).toBe(a);
  await controller.insert(fields.tasks, { id: "c", text: "C" }, { before: "b" });
  expect(controller.data.tasks[1]).toBe(b);
  expect(controller.data.tasks[2]).toBe(a);
  controller.dispose();
});

test("flush reports retained drafts and storage failures; status updates do not need a revision", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  let notified = 0;
  controller.subscribe(() => notified++);
  host.connected = false;
  for (const listener of host.connections) listener();
  expect(controller.canWrite).toBe(false);
  expect(notified).toBe(1);
  host.connected = true;
  const unregister = controller.registerDraft(async () => ({
    ok: false,
    error: { code: "validation", message: "Retained draft" },
  }));
  expect((await controller.flush()).ok).toBe(false);
  unregister();
  host.flush = async () => {
    throw new Error("disk full");
  };
  expect(await controller.flush()).toMatchObject({
    ok: false,
    error: { code: "storage_unavailable" },
  });
  controller.dispose();
});

test("an expired lease renews before a new command; uncertain requests retain their original lease", async () => {
  const host = new Host(),
    originalOpen = host.open.bind(host);
  let first = true;
  host.open = async () => {
    const open = await originalOpen();
    if (first) {
      first = false;
      open.lease.expiresAt = 0;
    }
    return open;
  };
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  expect((await controller.increment(fields.count)).ok).toBe(true);
  expect(host.opens).toBe(2);
  expect(controller.data.count).toBe(1);
  host.dropNext = true;
  await controller.increment(fields.count);
  host.writable = false; // The gateway permits only resolution while its pending request is durable.
  expect((await controller.retryUnknown()).ok).toBe(true);
  expect(host.requests[1]).toEqual(host.requests[2]);
  controller.dispose();
});

test("rejected commands are resolved, not a close barrier", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  expect((await controller.remove(fields.tasks, "missing")).ok).toBe(false);
  expect(controller.error).not.toBeNull();
  expect((await controller.flush()).ok).toBe(true);
  expect((await controller.destroy()).ok).toBe(true);
});

test("concurrent writes renew one expired lease inside the queue", async () => {
  const host = new Host(),
    open = host.open.bind(host);
  host.open = async () => {
    const value = await open();
    if (host.opens === 1) value.lease.expiresAt = 0;
    return value;
  };
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const results = await Promise.all(
    Array.from({ length: 5 }, () => controller.increment(fields.count)),
  );
  expect(results.every((result) => result.ok)).toBe(true);
  expect(host.opens).toBe(2);
  expect(controller.data.count).toBe(5);
  await controller.destroy();
});

test("unexpected identities are reported and retired authorities remain harmless", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const old = host.authority.open();
  host.publish({ ...old.snapshot, documentId: "foreign", revision: 90 });
  expect(controller.error?.code).toBe("authority_changed");
  expect(controller.revision).toBe(0);
  const next = { ...old, snapshot: { ...old.snapshot, authority: "new" } };
  await controller.handoff(next, old.snapshot.authority);
  controller.clearError();
  host.publish({ ...old.snapshot, revision: 100 });
  expect(controller.error).toBeNull();
  await controller.destroy();
});

test("reconciliation preserves unchanged rows across edits, insertion and move", async () => {
  const host = new Host(),
    controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const a = controller.data.tasks[0],
    b = controller.data.tasks[1];
  await controller.set(fields.tasks.item("a").text, "changed");
  expect(controller.data.tasks[0]).not.toBe(a);
  expect(controller.data.tasks[1]).toBe(b);
  const changed = controller.data.tasks[0];
  await controller.insert(fields.tasks, { id: "c", text: "C" }, { before: "a" });
  await controller.move(fields.tasks, "b", { before: "c" });
  expect(controller.data.tasks[0]).toBe(b);
  expect(controller.data.tasks[2]).toBe(changed);
  await controller.destroy();
});

test("pending paths isolate siblings and track list membership and transactions", async () => {
  const host = new Host();
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  let release!: () => void;
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const send = host.send.bind(host);
  host.send = async (request) => {
    await gate;
    return send(request);
  };
  const edit = controller.set(fields.tasks.item("a").text, "Edited");
  expect(controller.isPending(fields.tasks.item("a").text)).toBe(true);
  expect(controller.isPending(fields.tasks.item("a"))).toBe(true);
  expect(controller.isPending(fields.tasks)).toBe(true);
  expect(controller.isPending(fields.tasks.item("b"))).toBe(false);
  expect(controller.isPending(fields.count)).toBe(false);
  release();
  await edit;
  expect(controller.isPending(fields.tasks)).toBe(false);
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const transaction = controller.transaction((tx) => {
    tx.remove(fields.tasks, "a");
    tx.insert(fields.tasks, { id: "c", text: "C" });
    tx.increment(fields.count);
  });
  expect(controller.isPending(fields.tasks.item("a"))).toBe(true);
  expect(controller.isPending(fields.tasks.item("c"))).toBe(true);
  expect(controller.isPending(fields.tasks.item("b"))).toBe(false);
  expect(controller.isPending(fields.count)).toBe(true);
  release();
  expect(await transaction).toMatchObject({ ok: true, revision: 2 });
  expect(host.requests.at(-1)).toHaveProperty("ops.length", 3);
  controller.dispose();
});

test("failure events survive a subsequent successful command", async () => {
  const controller = createDocumentController({ schema, initial, host: new Host() });
  await controller.ready;
  const errors: string[] = [];
  const stop = controller.onError((error) => errors.push(error.code));
  expect((await controller.remove(fields.tasks, "missing")).ok).toBe(false);
  await controller.increment(fields.count);
  expect(controller.error).toBeNull();
  expect(errors).toEqual(["missing_target"]);
  stop();
  expect((await controller.flush()).ok).toBe(true);
  controller.dispose();
});

test("record paths track nested list inserts under newline keys", async () => {
  const schema = S.Document({
    groups: S.Record(S.List(S.Object({ id: S.String(), text: S.String() }), "id")),
  });
  const initial = { groups: { "a\nb": [] } };
  const host = new Host(new MemoryAuthority(schema, initial));
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const rows = S.paths(schema).groups.at("a\nb");
  const result = await controller.insert(rows, { id: "one", text: "kept" });
  expect(result.ok).toBe(true);
  expect(S.read(controller.data, rows.item("one").text)).toBe("kept");
  await controller.destroy();
});

test("undo uses the authority before-image and expires after any later commit", async () => {
  const host = new Host();
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  // Another window commits without this guest seeing its snapshot.
  const listeners = [...host.listeners];
  host.listeners.clear();
  const open = await host.open();
  const { data: _data, revision: _revision, ...identity } = open.snapshot;
  await host.authority.execute({
    ...identity,
    leaseId: open.lease.id,
    requestId: "other-window",
    ops: [{ op: "set", path: [{ key: "count" }], value: 10 }],
  });
  for (const listener of listeners) host.listeners.add(listener);
  expect(controller.data.count).toBe(0);
  const result = await controller.set(fields.count, 20);
  if (!result.ok || !result.undo) throw new Error("Missing undo");
  expect(result.canUndo).toBe(true);
  expect(await result.undo()).toEqual({ ok: true, revision: 3 });
  expect(controller.data.count).toBe(10);
  expect(result.canUndo).toBe(false);
  const count = host.requests.length;
  expect(await result.undo()).toEqual({ ok: true, revision: 3 });
  expect(host.requests).toHaveLength(count);
  const removed = await controller.remove(fields.tasks, "a");
  if (!removed.ok || !removed.undo) throw new Error("Missing undo");
  await controller.increment(fields.count);
  expect(removed.canUndo).toBe(false);
  expect(await removed.undo()).toMatchObject({ ok: false, error: { code: "stale_revision" } });
  expect(controller.data.tasks.map((row) => row.id)).toEqual(["b"]);
  expect((await controller.flush()).ok).toBe(true);
  controller.dispose();
});

test("undo coalesces calls, retries lost replies exactly, and restores an atomic batch", async () => {
  const host = new Host();
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const result = await controller.transaction((tx) => {
    tx.set(fields.count, 4);
    tx.remove(fields.tasks, "a");
    tx.insert(fields.tasks, { text: "New" });
  });
  if (!result.ok || !result.undo) throw new Error("Missing undo");
  host.dropNext = true;
  const one = result.undo(),
    two = result.undo();
  expect(one).toBe(two);
  expect(await one).toMatchObject({ ok: false, error: { code: "unknown_outcome" } });
  expect(controller.data).toEqual(initial);
  const request = host.requests.at(-1);
  expect((await controller.retryUnknown()).ok).toBe(true);
  expect(host.requests.at(-1)).toEqual(request);
  const count = host.requests.length;
  expect((await result.undo()).ok).toBe(true);
  expect(host.requests).toHaveLength(count);
  expect(controller.revision).toBe(2);
  controller.dispose();
});

test("undo flushes drafts before checking its revision; empty batches have no undo", async () => {
  const controller = createDocumentController({ schema, initial, host: new Host() });
  await controller.ready;
  const empty = await controller.transaction(() => {});
  expect(empty.ok && empty.undo).toBeUndefined();
  expect(empty.ok && empty.canUndo).toBe(false);
  const result = await controller.remove(fields.tasks, "a");
  if (!result.ok || !result.undo) throw new Error("Missing undo");
  const stop = controller.registerDraft(async () => {
    stop();
    return controller.set(fields.tasks.item("b").text, "Saved draft");
  });
  expect(await result.undo()).toMatchObject({ ok: false, error: { code: "stale_revision" } });
  expect(controller.data.tasks).toEqual([{ id: "b", text: "Saved draft" }]);
  controller.dispose();
});

test("undo cannot follow a document into a new authority", async () => {
  const host = new Host();
  const controller = createDocumentController({ schema, initial, host });
  await controller.ready;
  const result = await controller.increment(fields.count);
  if (!result.ok || !result.undo) throw new Error("Missing undo");
  const old = await host.open();
  const next = new MemoryAuthority(schema, initial, {
    documentId: old.snapshot.documentId,
    schemaHash: old.snapshot.schemaHash,
    authority: "shared",
  }).open();
  expect((await controller.handoff(next, old.snapshot.authority)).ok).toBe(true);
  expect(result.canUndo).toBe(false);
  const count = host.requests.length;
  expect(await result.undo()).toMatchObject({ ok: false, error: { code: "authority_changed" } });
  expect(host.requests).toHaveLength(count);
  controller.dispose();
});
