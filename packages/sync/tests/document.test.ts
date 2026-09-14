import { test, expect } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as S from "@hitslop/schema/document";
import { DocumentEngine } from "../src/document";
import { FileDocumentIO } from "../src/storage";
import { unpack } from "../src/encoding";
const schema = S.Document({ title: S.String(), tasks: S.List(S.Object({ id: S.String(), text: S.Text(), done: S.Boolean() }), "id") });
const initial = { title: "List", tasks: [{ id: "a", text: "Hello", done: false }] };
async function fixture(run: (root: string, doc: DocumentEngine<typeof schema>, io: FileDocumentIO) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "slop-versioned-"));
  try {
    const io = await FileDocumentIO.at(root);
    const doc = await DocumentEngine.open({ schema, initial, io });
    await run(root, doc, io);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const readEnvelope = async (root: string) => JSON.parse(await readFile(join(root, "stores/data.json"), "utf8"));
const save = (root: string, value: unknown) => writeFile(join(root, "stores/data.json"), JSON.stringify(value));

test("versioned stale file merges without reverting the concurrent checkbox; retry is durable", async () => fixture(async (root, doc, io) => {
  const old = await readEnvelope(root);
  doc.change(draft => { draft.tasks[0]!.done = true; }); await doc.flush();
  old.data.title = "Agent title";
  old.data.tasks[0].text += " world";
  await save(root, old); await doc.externalChanged();
  expect(doc.state.projectionError).toBeNull();
  expect(doc.current).toEqual({ title: "Agent title", tasks: [{ id: "a", text: "Hello world", done: true }] });
  const reopened = await DocumentEngine.open({ schema, initial, io });
  await save(root, old); await reopened.externalChanged();
  expect(reopened.current.tasks[0]!.text).toBe("Hello world");
  old.data.tasks[0].text += " again";
  await save(root, old); await reopened.externalChanged();
  expect(reopened.state.projectionError).toContain("already edited");
  expect(await readEnvelope(root)).toEqual(old);
}));

test("invalid JSON blocks only projection; UI edits remain durable through reopen", async () => fixture(async (root, doc, io) => {
  await writeFile(join(root, "stores/data.json"), "{unfinished");
  await doc.externalChanged();
  doc.change(draft => { draft.title = "Still saved"; }); await doc.flush();
  expect(await readFile(join(root, "stores/data.json"), "utf8")).toBe("{unfinished");
  expect(doc.state.error).toBeNull();
  const reopened = await DocumentEngine.open({ schema, initial, io });
  expect(reopened.current.title).toBe("Still saved");
  expect(reopened.state.projectionError).not.toBeNull();
}));

test("unknown current revision requires review; approval preserves original", async () => fixture(async (root, doc, io) => {
  let status: any;
  const reviewedIO = { open: () => io.open(), commit: io.commit.bind(io), status: async (value: unknown) => { status = value; } };
  const reviewing = await DocumentEngine.open({ schema, initial, io: reviewedIO });
  await save(root, { $slop: {format: 1, baseRevision: "unknown"}, data: { ...initial, title: "Reviewed" } }); await reviewing.externalChanged();
  expect(status.needsReview).toBe(true);
  expect(reviewing.current.title).toBe("List");
  expect(await reviewing.resolveReview(status.token, "apply")).toBe(true);
  expect(reviewing.current.title).toBe("Reviewed");
  expect((await readEnvelope(root)).$slop.format).toBe(1);
  const { readdir } = await import("node:fs/promises");
  expect((await readdir(join(root, "state/journal"))).some(x => x.startsWith("recovery-"))).toBe(true);
}));

test("healthy open leaves bytes and token unchanged; missing projection reconstructs", async () => fixture(async (root, doc, io) => {
  const before = await io.open();
  await DocumentEngine.open({ schema, initial, io });
  expect(await io.open()).toEqual(before);
  await rm(join(root, "stores/data.json")); await doc.externalChanged();
  expect((await readEnvelope(root)).data).toEqual(initial);
}));

for (const path of ["state/journal/pending.json", "state/identity.json", "state/checkpoint.loro", "state/materialization.json", "stores/data.json"]) {
  test(`recover interrupted commit after ${path} without losing typing`, async () => fixture(async (root, doc) => {
    let failed = false;
    const io = await FileDocumentIO.at(root, current => { if (!failed && current === path) { failed = true; throw new Error("Injected crash"); } });
    // Open the engine before arming a changed save: healthy opens never write.
    const engine = await DocumentEngine.open({ schema, initial, io });
    engine.change(draft => { draft.title = "Recovered"; });
    await engine.flush().catch(() => {});
    await engine.flush();
    const reopened = await DocumentEngine.open({ schema, initial, io: await FileDocumentIO.at(root) });
    expect(reopened.current.title).toBe("Recovered");
  }));
}

test("review approval is invalidated by newer typing or a changed external file", async () => fixture(async (root, _doc, io) => {
  let status: import('@hitslop/schema/sync').SyncStatus | undefined;
  const doc = await DocumentEngine.open({ schema, initial, io: { open: io.open.bind(io), commit: io.commit.bind(io), status: async value => { status = value; } } });
  await save(root, { $slop: { format: 1, baseRevision: "unknown" }, data: { ...initial, title: "External" } }); await doc.externalChanged();
  expect(status!.canApply).toBe(true);
  const old = status!.token;
  doc.change(draft => { draft.title = "New typing"; }); await doc.flush();
  expect(await doc.resolveReview(old, "apply")).toBe(false);
  const current = status!.token;
  await save(root, { $slop: { format: 1, baseRevision: "unknown" }, data: { ...initial, title: "Different external" } });
  expect(await doc.resolveReview(current, "apply")).toBe(false);
  expect(doc.current.title).toBe("New typing");
}));

for (const kind of ["missing", "foreign", "unknown", "invalid-data"] as const) {
  test(`${kind} revision preserves file and valid state`, async () => fixture(async (root, doc) => {
    const envelope = await readEnvelope(root);
    if (kind === "missing") delete envelope.$slop;
    if (kind === "foreign" || kind === "unknown") {
      const token = JSON.parse(Buffer.from(envelope.$slop.baseRevision, "base64").toString());
      if (kind === "foreign") token.documentId = "some-other-document";
      else token.frontiers = [{ peer: "99999999", counter: 99999999 }];
      envelope.$slop.baseRevision = Buffer.from(JSON.stringify(token)).toString("base64");
    }
    if (kind === "invalid-data") envelope.data.tasks.push(envelope.data.tasks[0]);
    await save(root, envelope); await doc.externalChanged();
    expect(doc.state.projectionError).not.toBeNull();
    expect(doc.current).toEqual(initial);
    expect(await readEnvelope(root)).toEqual(envelope);
  }));
}

test("copied versioned documents get new writers and merge through the same engine", async () => fixture(async (root, left) => {
  const { cp } = await import("node:fs/promises");
  const other = await mkdtemp(join(tmpdir(), "slop-replica-copy-"));
  try {
    await cp(root, other, { recursive: true });
    const right = await DocumentEngine.open({ schema, initial, io: await FileDocumentIO.at(other) });
    expect(right.replica.doc.peerIdStr).not.toBe(left.replica.doc.peerIdStr);
    left.change(draft => { draft.title = "Left"; });
    right.change(draft => { draft.tasks[0]!.done = true; });
    left.importUpdates(right.replica.exportUpdates()); right.importUpdates(left.replica.exportUpdates());
    await Promise.all([left.flush(), right.flush()]);
    expect(left.current).toEqual(right.current);
    expect(left.current.title).toBe("Left"); expect(left.current.tasks[0]!.done).toBe(true);
  } finally { await rm(other, { recursive: true, force: true }); }
}));

test("invalid envelope cannot be applied", async () => fixture(async (root, _doc, io) => {
  let status: import('@hitslop/schema/sync').SyncStatus | undefined;
  const doc = await DocumentEngine.open({ schema, initial, io: { open: io.open.bind(io), commit: io.commit.bind(io), status: async value => { status = value; } } });
  await save(root, { data: { ...initial, title: "Stripped envelope" } }); await doc.externalChanged();
  expect(status?.needsReview).toBe(true); expect(status?.canApply).toBe(false);
  expect(doc.current.title).toBe("List");
  expect(await doc.resolveReview(status!.token, "apply")).toBe(false);
  expect(doc.current.title).toBe("List");
}));


test('failed first commit retains the same engine and pending edits for retry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'slop-first-save-'));
  try {
    const disk = await FileDocumentIO.at(root); let fail = true;
    const io = {open:disk.open.bind(disk),commit:async (value: import('@hitslop/schema/sync').SyncCommit) => {
      if(fail) throw new Error('Disk unavailable'); return disk.commit(value);
    }};
    const doc = await DocumentEngine.open({schema,initial,io});
    expect(doc.state.isReady).toBe(true);expect(doc.state.error).toBe('Disk unavailable');
    doc.change(draft=>{draft.title='Retained typing';}); await doc.flush().catch(()=>undefined);
    fail=false;await doc.flush();
    expect(doc.state.isDirty).toBe(false);
    expect((await DocumentEngine.open({schema,initial,io})).current.title).toBe('Retained typing');
  } finally {await rm(root,{recursive:true,force:true});}
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
test("typing batches saves, flush bypasses debounce, and failures do not spin", async () => fixture(async (_root, _doc, disk) => {
  let reads = 0, commits = 0, fail = false;
  const doc = await DocumentEngine.open({ schema, initial, io: {
    open: () => { reads++; return disk.open(); },
    commit: value => { commits++; if (fail) throw new Error("offline"); return disk.commit(value); },
  } });
  reads = commits = 0;
  for (let n = 0; n < 100; n++) doc.change(draft => { draft.title = String(n); });
  expect(doc.current.title).toBe("99");
  expect(reads).toBe(0);
  await wait(400);
  await doc.flush();
  expect(commits).toBe(1);
  expect(reads).toBe(2); // One automatic save and the explicit durability check.
  reads = commits = 0;
  doc.change(draft => { draft.title = "Final character"; });
  await Promise.all(Array.from({ length: 100 }, () => doc.flush()));
  expect(reads).toBe(1);
  expect(commits).toBe(1);
  await wait(300);
  expect(reads).toBe(1);
  fail = true;
  doc.change(draft => { draft.title = "Retry me"; });
  await wait(400);
  expect(doc.state.error).toBe("offline");
  const attempts = commits;
  await wait(1100);
  expect(commits).toBe(attempts);
  fail = false;
  await doc.flush();
}));

test("continuous typing starts a save within the maximum wait", async () => fixture(async (_root, _doc, disk) => {
  let commits = 0;
  const doc = await DocumentEngine.open({ schema, initial, io: {
    open: () => disk.open(), commit: value => { commits++; return disk.commit(value); },
  } });
  commits = 0;
  try {
    for (let n = 0; n < 12; n++) {
      doc.change(draft => { draft.title = String(n); });
      await wait(100);
    }
    expect(commits).toBeGreaterThan(0);
  } finally { await doc.flush(); }
}));
