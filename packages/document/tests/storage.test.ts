// Guards acknowledged-write durability, failed-close ownership, reply-loss recovery and queued writes.
import { MemoryStore } from "../src/memory";
import { describe, test, expect } from "bun:test";
import { mkdtemp, rm, mkdir, symlink, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineDocument, s, fromDescriptor, schemaKey } from "../src/schema";
import { Document } from "../src/document";
import { SQLiteStore } from "../test-support/sqlite";
import { Session } from "../src/session";
import { bindText } from "../src/bind-text";

// Observer failures must not turn accepted edits into apparent rejections or stop durability.
test("throwing observers and error reporters cannot interrupt autosave or close", async () => {
  const definition = defineDocument({ title: s.string() });
  const appended = Promise.withResolvers<void>();
  class Store extends MemoryStore {
    closes = 0;
    override async append(generation: string, updates: Uint8Array[]) {
      const next = await super.append(generation, updates);
      appended.resolve();
      return next;
    }
    override async close() { this.closes++; }
  }
  const store = new Store();
  const reported: unknown[] = [];
  const doc = await Document.open(definition, store, { title: "before" }, {
    onListenerError(error) { reported.push(error); throw new Error("reporter failed"); },
  });
  const failure = new Error("observer failed");
  let changes = 0, updates = 0;
  const stop = doc.subscribe(() => { throw failure; });
  const stopOutbound = doc.onLocalUpdate(() => { throw failure; });
  doc.subscribe(event => { if (event.kind === "change") changes++; });
  doc.onLocalUpdate(() => updates++);
  try {
    expect(() => doc.change(tx => tx.fields.title.set("accepted"))).not.toThrow();
    expect(doc.current.title).toBe("accepted");
    expect(changes).toBe(1);
    expect(updates).toBe(1);
    expect(() => doc.fields.title.set("accepted again")).not.toThrow();
    expect(changes).toBe(2);
    expect(updates).toBe(2);
    await appended.promise;
    await doc.flush();
    expect(doc.status).toBe("saved");
    expect(reported).toContain(failure);
    await doc.prepareClose();
    await doc.close();
    await doc.close();
    expect(store.closes).toBe(1);
    const reopened = await Document.open(definition, store, { title: "before" });
    expect(reopened.current.title).toBe("accepted again");
    await reopened.close();
  } finally {
    stop(); stopOutbound();
    await doc.close();
  }
});

test("close-time observer failure cannot skip storage cleanup", async () => {
  let closes = 0;
  const store = new MemoryStore();
  store.close = async () => { closes++; };
  const doc = await Document.open(defineDocument({}), store, {}, { onListenerError() {} });
  await doc.prepareClose();
  doc.subscribe(() => { throw new Error("closing observer"); });
  await doc.close();
  await doc.close();
  expect(closes).toBe(1);
});

// Counter deltas may be regrouped by Loro during replay. Saving must preserve the
// value the user saw, including cancellation of large historical increments.
test("ordinary counter edits retain their accepted value after saving and reopening", async () => {
  const definition = defineDocument({ count: s.counter() });
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, { count: 1e16 });
  doc.fields.count.increment(-1e16);
  doc.fields.count.increment(1);
  expect(doc.current.count).toBe(1);
  await doc.close();
  const reopened = await Document.open(definition, store, { count: 0 });
  expect(reopened.current.count).toBe(1);
  reopened.fields.count.increment(0.25);
  reopened.fields.count.increment(-0.5);
  await reopened.close();
  const fractional = await Document.open(definition, store, { count: 0 });
  expect(fractional.current.count).toBe(0.75);
  await fractional.close();
});

// Safe individual deltas and live values do not imply a safe accumulated delta.
// The existing fractional/large-value case does not catch that narrower shortcut.
test("safe-integer counter edits retain their accepted value after saving and reopening", async () => {
  const definition = defineDocument({ count: s.counter() });
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, { count: -9007199254740991 });
  doc.fields.count.increment(9007199254740991);
  expect(doc.current.count).toBe(0);
  doc.fields.count.increment(9007199254740990);
  expect(doc.current.count).toBe(9007199254740990);
  await doc.close();
  const reopened = await Document.open(definition, store, { count: 0 });
  expect(reopened.current.count).toBe(9007199254740990);
  await reopened.close();
});

// Stored-byte capacity deliberately permits a fitting incremental representation
// even when re-encoding that state as a full snapshot would exceed the limit.
const multibyte = Array.from({ length: 20_000 }, (_, i) =>
  String.fromCharCode(0x4e00 + ((i * 7919) % 18000)),
).join("");
test("fitting updates stay durable when optional compaction exceeds capacity", async () => {
  const definition = defineDocument({ body: s.text() });
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, { body: "" }, { capacityBytes: 96 * 1024 });
  doc.fields.body.replace(multibyte);
  expect(doc.exportSnapshot().length).toBeGreaterThan(96 * 1024);
  await doc.flush();
  const saved = await store.load();
  expect(
    saved.checkpoint!.length + saved.updates.reduce((n, bytes) => n + bytes.length, 0),
  ).toBeLessThan(96 * 1024);
  await expect(doc.compact()).rejects.toThrow("Document is full");
  expect(await store.load()).toEqual(saved);
  expect(doc.current.body).toBe(multibyte);
  expect(doc.status).toBe("saved");
  expect(doc.full).toBe(false);
  await doc.close();
  const reopened = await Document.open(
    definition,
    store,
    { body: "" },
    { capacityBytes: 96 * 1024 },
  );
  expect(reopened.current.body).toBe(multibyte);
  await reopened.close();
});

// Unlike optional compaction above, a counter checkpoint must fit before a save
// can be acknowledged, even when an incremental representation would fit.
test("a required counter checkpoint exceeding capacity retains edits and blocks close", async () => {
  const definition = defineDocument({ body: s.text(), count: s.counter() });
  const store = new MemoryStore();
  const doc = await Document.open(
    definition,
    store,
    { body: "", count: 0 },
    { capacityBytes: 96 * 1024 },
  );
  doc.fields.body.replace(multibyte);
  await doc.flush();
  const saved = await store.load();
  expect(
    saved.checkpoint!.length + saved.updates.reduce((n, bytes) => n + bytes.length, 0),
  ).toBeLessThan(96 * 1024);

  doc.fields.count.increment(1);
  expect(doc.exportSnapshot().length).toBeGreaterThan(96 * 1024);
  await expect(doc.flush()).rejects.toThrow("Document is full");
  expect(doc.status).toBe("save-failed");
  expect(doc.full).toBe(true);
  expect(doc.current.body).toBe(multibyte);
  expect(doc.current.count).toBe(1);
  expect(await store.load()).toEqual(saved);
  await expect(doc.close()).rejects.toThrow("Document is full");
  expect(doc.current.body).toBe(multibyte);
  expect(doc.current.count).toBe(1);
  expect(await store.load()).toEqual(saved);

  await doc.discardPending();
  expect(doc.current.body).toBe(multibyte);
  expect(doc.current.count).toBe(0);
  expect(doc.status).toBe("saved");
  expect(doc.full).toBe(false);
  expect(await store.load()).toEqual(saved);
  await doc.close();
  const reopened = await Document.open(
    definition,
    store,
    { body: "", count: 0 },
    { capacityBytes: 96 * 1024 },
  );
  expect(reopened.current.body).toBe(multibyte);
  expect(reopened.current.count).toBe(0);
  await reopened.close();
});

// Regression: committing a composition used to notify status before throwing,
// overwriting the input with its saved value and allowing the next close.
test("a text composition survives capacity failure and continues to block close", async () => {
  const definition = defineDocument({ title: s.text() });
  const doc = await Document.open(
    definition,
    new MemoryStore(),
    { title: "saved" },
    { capacityBytes: 96 * 1024 },
  );
  const input = Object.assign(new EventTarget(), {
    value: "",
    disabled: false,
  }) as unknown as HTMLInputElement;
  const binding = bindText(input, doc.fields.title);
  input.dispatchEvent(new Event("compositionstart"));
  input.value = multibyte.repeat(3);
  await expect(doc.flush()).rejects.toThrow("Document is full");
  expect(input.value).toBe(multibyte.repeat(3));
  await expect(doc.close()).rejects.toThrow("Document is full");
  binding.destroy();
  await doc.discardPending();
  await doc.close();
});

// Regression: discard previously cleared previews but left accepted unsaved data.
test("discard reloads durable state and preserves commits whose reply was lost", async () => {
  const definition = defineDocument({ title: s.text() });
  const store = new MemoryStore();
  const doc = await Document.open(definition, store, { title: "initial" });
  const append = store.append.bind(store);
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => (entered = resolve));
  const gate = new Promise<void>((resolve) => (release = resolve));
  store.append = async (...args) => {
    entered();
    await gate;
    await append(...args);
    throw new Error("reply lost");
  };
  doc.fields.title.replace("durable despite lost reply");
  const saving = doc.flush();
  await started;
  doc.fields.title.replace("unsaved");
  const discarding = doc.discardPending();
  release();
  await expect(saving).rejects.toThrow("reply lost");
  await discarding;
  expect(doc.current.title).toBe("durable despite lost reply");
  expect(doc.status).toBe("saved");
  store.append = append;
  await doc.close();
});
const schema = defineDocument({
  title: s.text(),
  tasks: s.list(s.object({ text: s.text(), done: s.boolean() })),
});
const initial = { title: "List", tasks: [] };
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "hsl-sdk-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("generic operations preserve row IDs through moves, flush, compact and reopen", () =>
  fixture(async (root) => {
    const d = await Document.open(schema, await SQLiteStore.open(root), initial);
    d.fields.tasks.insert({ text: "A", done: false });
    d.fields.tasks.insert({ text: "B", done: true });
    const id = d.current.tasks[0]!.$id;
    d.fields.tasks.move(id, { after: d.current.tasks[1]!.$id });
    d.fields.tasks.item(id).text.replace("A edited 🦊");
    await d.flush();
    await d.compact();
    const expected = d.current;
    await d.close();
    const reopened = await Document.open(
      fromDescriptor(JSON.parse(JSON.stringify(schema.descriptor))),
      await SQLiteStore.open(root),
      initial,
    );
    expect(reopened.current).toEqual(expected);
    expect((reopened.current as any).tasks[1].$id).toBe(id);
    await reopened.close();
  }));
test("same runtime supports a second nested schema", () =>
  fixture(async (root) => {
    const notes = defineDocument({
      heading: s.text(),
      settings: s.object({ archived: s.boolean() }),
      notes: s.list(s.object({ body: s.text() })),
    });
    const d = await Document.open(notes, await SQLiteStore.open(root), {
      heading: "Notes",
      settings: { archived: false },
      notes: [],
    });
    d.fields.settings.archived.set(true);
    d.fields.notes.insert({ body: "No checklist reducer" });
    await d.close();
    const r = await Document.open(notes, await SQLiteStore.open(root), {
      heading: "",
      settings: { archived: false },
      notes: [],
    });
    expect(r.current.settings.archived).toBe(true);
    expect(r.current.notes[0]!.body).toBe("No checklist reducer");
    await r.close();
  }));
test("writer lock and schema compatibility are enforced", () =>
  fixture(async (root) => {
    const d = await Document.open(schema, await SQLiteStore.open(root), initial);
    await expect(SQLiteStore.open(root)).rejects.toThrow("live writer");
    await d.close();
    await expect(
      Document.open(defineDocument({ other: s.text() }), await SQLiteStore.open(root), {
        other: "",
      }),
    ).rejects.toThrow("Incompatible");
    const recovered = await SQLiteStore.open(root);
    await recovered.close();
  }));
test("lost storage reply followed by get flushes identical bytes without replaying intent", () =>
  fixture(async (root) => {
    const io = await SQLiteStore.open(root);
    let lost = true;
    const append = io.append.bind(io);
    io.append = async (...args) => {
      const generation = await append(...args);
      if (lost) {
        lost = false;
        throw new Error("reply lost after commit");
      }
      return generation;
    };
    const d = await Document.open(schema, io, initial),
      session = new Session(d, "epoch");
    const request = {
      id: "insert-1",
      documentPath: root,
      schemaHash: schemaKey(schema.descriptor),
      epoch: "epoch",
      method: "batch" as const,
      ops: [
        { type: "insert" as const, path: ["tasks"], value: { text: "Once", done: false } },
        { type: "text.replace" as const, path: ["title"], value: "Batch title" },
      ],
    };
    expect((await session.handle(request)).ok).toBe(false);
    expect((await session.handle({ ...request, method: "get" })).ok).toBe(true);
    expect((await session.handle({ ...request, epoch: "old" })).ok).toBe(false);
    await session.close();
    const r = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(r.current.tasks).toHaveLength(1);
    expect(r.current.title).toBe("Batch title");
    await r.close();
  }));
test("failed close retains ownership and can be retried", () =>
  fixture(async (root) => {
    const io = await SQLiteStore.open(root),
      append = io.append.bind(io);
    const d = await Document.open(schema, io, initial);
    d.fields.title.replace("Unsaved");
    io.append = async () => {
      throw new Error("disk failure");
    };
    await expect(d.close()).rejects.toThrow();
    expect(d.status).toBe("save-failed");
    await expect(SQLiteStore.open(root)).rejects.toThrow("live writer");
    io.append = append;
    await d.close();
    const r = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(r.current.title).toBe("Unsaved");
    await r.close();
  }));

test("checkpoint reply loss refreshes generation and permits further edits", () =>
  fixture(async (root) => {
    const io = await SQLiteStore.open(root);
    const d = await Document.open(schema, io, initial);
    d.fields.title.replace("Before checkpoint");
    await d.flush();
    const checkpoint = io.checkpoint.bind(io);
    let lose = true;
    io.checkpoint = async (...args) => {
      const generation = await checkpoint(...args);
      if (lose) {
        lose = false;
        throw new Error("checkpoint reply lost");
      }
      return generation;
    };
    await expect(d.compact()).rejects.toThrow("checkpoint reply lost");
    d.fields.tasks.insert({ text: "After lost reply", done: false });
    await d.flush();
    await d.compact();
    await d.close();
    const r = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(r.current.title).toBe("Before checkpoint");
    expect(r.current.tasks).toHaveLength(1);
    await r.close();
  }));

describe("storage boundaries", () => {
  const definition = defineDocument({
    title: s.text(),
    rows: s.list(s.object({ name: s.string() })),
  });
  const initial = { title: "Title", rows: [] };
  test("automatic checkpoint bounds update rows and preserves reopen", async () => {
    const store = new MemoryStore();
    const doc = await Document.open(definition, store, initial);
    let checkpointed!: () => void;
    const completed = new Promise<void>((resolve) => (checkpointed = resolve));
    const checkpoint = store.checkpoint.bind(store);
    store.checkpoint = async (...args) => {
      const generation = await checkpoint(...args);
      checkpointed();
      return generation;
    };
    for (let i = 0; i < 260; i++) {
      doc.fields.title.replace(String(i));
      await doc.flush();
    }
    await completed;
    expect((await store.load()).updates.length).toBeLessThan(256);
    await doc.close();
    const restored = await Document.open(definition, store, initial);
    expect(restored.current.title).toBe("259");
    await restored.close();
  });
  test("storage rejects symlinked state and detects package relocation", async () => {
    const parent = await mkdtemp(join(tmpdir(), "hsl-safe-"));
    try {
      const root = join(parent, "Doc.slop"),
        outside = join(parent, "outside");
      await mkdir(root);
      await mkdir(outside);
      await symlink(outside, join(root, "state"));
      await expect(SQLiteStore.open(root)).rejects.toThrow("Unsafe");
      await rm(join(root, "state"));
      const store = await SQLiteStore.open(root);
      await rename(root, join(parent, "Moved.slop"));
      await expect(store.load()).rejects.toThrow();
      await store.close();
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});

describe("save status", () => {
  const schema = defineDocument({ title: s.text(), rows: s.list(s.object({ done: s.boolean() })) });
  const initial = { title: "Initial", rows: [{ done: false }] };
  test("save failure stays visible through further edits and repeated failure until successful flush", async () => {
    const io = new MemoryStore(),
      append = io.append.bind(io),
      doc = await Document.open(schema, io, initial, { onListenerError() {} });
    doc.subscribe(() => { throw new Error("observer failed during storage failure"); });
    io.append = async () => {
      throw new Error("Disk unavailable");
    };
    doc.fields.title.replace("First");
    await expect(doc.flush()).rejects.toThrow("Disk unavailable");
    doc.fields.title.replace("Second");
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
});

test("edits arriving during append and checkpoint remain queued and survive reopen", async () => {
  const schema = defineDocument({ title: s.text(), flag: s.boolean() });
  const io = new MemoryStore();
  const doc = await Document.open(schema, io, { title: "Initial", flag: false });
  for (const phase of ["append", "checkpoint"] as const) {
    const original = io[phase].bind(io) as (...args: any[]) => Promise<string>;
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((r) => (entered = r)),
      gate = new Promise<void>((r) => (release = r));
    (io as any)[phase] = async (...args: any[]) => {
      entered();
      await gate;
      return original(...args);
    };
    doc.fields.title.replace(`Before ${phase}`);
    const pending = phase === "append" ? doc.flush() : doc.compact();
    await started;
    doc.change((tx) => {
      tx.fields.title.replace(`During ${phase}`);
      tx.fields.flag.set(true);
    });
    release();
    await pending;
    (io as any)[phase] = original;
    await doc.flush();
  }
  const expected = doc.current;
  await doc.close();
  const reopened = await Document.open(schema, io, { title: "Unused", flag: false });
  expect(reopened.current).toEqual(expected);
  await reopened.close();
});

test("valid shallow checkpoints remain readable without enabling automatic pruning", async () => {
  const { LoroDoc } = await import("loro-crdt");
  const setting = defineDocument({ volume: s.number({ min: 0, max: 1 }) });
  const source = await Document.open(setting, new MemoryStore(), { volume: 0 });
  source.fields.volume.set(0.9);
  const engine = new LoroDoc();
  engine.import(source.exportSnapshot());
  const checkpoint = engine.export({
    mode: "shallow-snapshot",
    frontiers: engine.oplogFrontiers(),
  });
  const store = new MemoryStore();
  await store.checkpoint("0", checkpoint, source.key);
  await source.close();
  engine.free();
  const doc = await Document.open(setting, store, { volume: 0 });
  expect(doc.current.volume).toBe(0.9);
  doc.fields.volume.set(0.6);
  await doc.compact();
  await doc.close();
  const reopened = await Document.open(setting, store, { volume: 0 });
  expect(reopened.current.volume).toBe(0.6);
  await reopened.close();
});

// Save-time enforcement replaces the old pre-edit refusal/reserve contract.
test("oversized local edits remain live and CLI reports failure rather than rejection", async () => {
  const definition = defineDocument({ body: s.text(), title: s.string() });
  const store = new MemoryStore();
  const doc = await Document.open(
    definition,
    store,
    { body: "", title: "saved" },
    { capacityBytes: 96 * 1024 },
  );
  const session = new Session(doc, "epoch");
  const sent: Uint8Array[] = [];
  doc.onLocalUpdate((bytes) => sent.push(bytes));
  const reply = await session.handle({
    id: "large-edit",
    documentPath: "test",
    epoch: "epoch",
    method: "apply",
    op: { type: "text.replace", path: ["body"], value: multibyte.repeat(3) },
  });
  expect(reply).toMatchObject({ ok: false, code: "failed" });
  expect(doc.current.body).toBe(multibyte.repeat(3));
  expect(sent).toHaveLength(1);
  doc.fields.title.preview("visible draft");
  await expect(doc.close()).rejects.toThrow("Document is full");
  expect(doc.current.title).toBe("visible draft");
  // Capacity failure does not turn the session read-only.
  doc.fields.title.set("another edit");
  await session.discardPending();
  expect(doc.current.body).toBe("");
  expect(doc.current.title).toBe("saved");
  expect(doc.full).toBe(false);
  doc.fields.title.preview("small draft");
  await session.close();
  const reopened = await Document.open(definition, store, { body: "", title: "unused" });
  expect(reopened.current.body).toBe("");
  expect(reopened.current.title).toBe("small draft");
  await reopened.close();
});

test("creation checks actual snapshot bytes before writing", async () => {
  const definition = defineDocument({ body: s.text() });
  const store = new MemoryStore();
  await expect(
    Document.open(definition, store, { body: multibyte }, { capacityBytes: 96 * 1024 }),
  ).rejects.toThrow("Document is full");
  expect((await store.load()).checkpoint).toBeNull();
});

test("discard failure retains unsaved edits and ownership, then a retry restores saved state", () =>
  fixture(async (root) => {
    const store = await SQLiteStore.open(root);
    const doc = await Document.open(schema, store, initial);
    const id = doc.id;
    const load = store.load.bind(store);
    doc.fields.title.replace("unsaved");
    store.load = async () => {
      throw new Error("read unavailable");
    };
    await expect(doc.discardPending()).rejects.toThrow("read unavailable");
    expect(doc.current.title).toBe("unsaved");
    expect(doc.status).toBe("save-failed");
    await expect(SQLiteStore.open(root)).rejects.toThrow("live writer");
    store.load = load;
    await doc.discardPending();
    expect(doc.current.title).toBe("List");
    expect(doc.id).toBe(id);
    await expect(SQLiteStore.open(root)).rejects.toThrow("live writer");
    doc.fields.title.replace("after discard");
    await doc.close();
    const reopened = await Document.open(schema, await SQLiteStore.open(root), initial);
    expect(reopened.current.title).toBe("after discard");
    await reopened.close();
  }));
