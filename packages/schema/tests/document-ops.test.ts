import { expect, test, spyOn } from "bun:test";
import corpus from "../fixtures/document-ops.json";
import {
  MemoryAuthority,
  executeCommand,
  prepareCommand,
  prepareSnapshot,
  issueLease,
  type Receipt,
  type UndoSlot,
} from "../src/document-authority.js";
import {
  RETRY_WINDOW_MS,
  type Request,
  type ErrorCode,
  type JSONValue,
} from "../src/document-protocol.js";
import * as Type from "typebox";
import * as S from "../src/document.js";
import { applyOps } from "../src/document-ops.js";

function authority(
  schema: Parameters<typeof S.prepareDocument>[0],
  initial: JSONValue,
  lease = corpus.lease,
) {
  let snapshot = prepareSnapshot(corpus.identity, 0, S.prepareDocument(schema, initial)).snapshot;
  const receipts = new Map<string, Receipt>();
  let undo: UndoSlot | undefined;
  return {
    get snapshot() {
      return snapshot;
    },
    receipts,
    async execute(input: unknown, now = 0) {
      try {
        const command = await prepareCommand(input);
        const next = executeCommand(
          schema,
          { snapshot, lease, receipt: receipts.get(command.request.requestId), undo },
          command,
          now,
        );
        if (next.receipt) receipts.set(command.request.requestId, next.receipt);
        if (next.prepared) {
          undo =
            "ops" in command.request
              ? {
                  snapshot,
                  leaseId: command.request.leaseId,
                  requestId: command.request.requestId,
                  revision: next.prepared.snapshot.revision,
                }
              : undefined;
          snapshot = next.prepared.snapshot;
        }
        return next;
      } catch (error) {
        return {
          result: {
            ok: false as const,
            error: { code: "invalid_request", message: String(error) },
          },
        };
      }
    },
  };
}
for (const scenario of corpus.scenarios)
  test(`command corpus: ${scenario.name}`, async () => {
    const state = authority(corpus.schema, corpus.initial);
    for (const event of scenario.events) {
      const outcome = await state.execute(event.request);
      expect(state.snapshot.revision).toBe(event.expected.revision);
      expect(state.snapshot.data).toEqual(event.expected.data);
      expect(outcome.result.ok ? undefined : outcome.result.error.code).toBe(
        (event.expected as { error?: ErrorCode }).error,
      );
    }
  });

test("expiry precedes receipts and epochs scope all requests", async () => {
  expect(RETRY_WINDOW_MS).toBe(corpus.retryWindowMs);
  const schema = S.Document({ count: S.Integer() });
  const lease = issueLease(0),
    state = authority(schema, { count: 0 }, lease);
  const request: Request = {
    ...corpus.identity,
    leaseId: lease.id,
    requestId: "one",
    ops: [{ op: "increment", path: [{ key: "count" }], amount: 1 }],
  };
  await state.execute(request, 1);
  await state.execute(request, 2);
  expect(state.snapshot.data).toEqual({ count: 1 });
  expect((await state.execute(request, RETRY_WINDOW_MS)).result).toMatchObject({
    ok: false,
    error: { code: "lease_expired" },
  });
  state.receipts.clear();
  expect((await state.execute(request, RETRY_WINDOW_MS)).result).toMatchObject({
    ok: false,
    error: { code: "lease_expired" },
  });
  expect((await state.execute({ ...request, authority: "another" }, 1)).result).toMatchObject({
    ok: false,
    error: { code: "authority_changed" },
  });
});

test("a state rejection cannot resurrect; receipts contain digests only", async () => {
  const schema = S.Document({ count: S.Integer({ minimum: 0 }) });
  const state = authority(schema, { count: 0 });
  const request: Request = {
    ...corpus.identity,
    leaseId: corpus.lease.id,
    requestId: "one",
    ops: [{ op: "increment", path: [{ key: "count" }], amount: -1 }],
  };
  const rejected = await state.execute(request);
  await state.execute({
    ...request,
    requestId: "two",
    ops: [{ op: "increment", path: [{ key: "count" }], amount: 3 }],
  });
  expect((await state.execute(request)).result).toEqual(rejected.result);
  expect(state.snapshot.data).toEqual({ count: 3 });
  expect(state.receipts.get("one")!.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(Object.keys(state.receipts.get("one")!)).toEqual(["digest", "result"]);
  expect(
    (
      await state.execute({
        ...request,
        ops: [{ op: "increment", path: [{ key: "count" }], amount: 1 }],
      })
    ).result,
  ).toMatchObject({ ok: false, error: { code: "request_reused" } });
});

test.each(["ops", "replace"] as const)(
  "%s encodes the candidate once and does no candidate work on replay",
  async (kind) => {
    const schema = S.Document({ title: S.String() }),
      state = authority(schema, { title: "old" });
    const title = 'quotes " newline\n';
    const request: Request = {
      ...corpus.identity,
      leaseId: corpus.lease.id,
      requestId: "one",
      ...(kind === "replace"
        ? { replace: { baseRevision: 0, data: { title } } }
        : { ops: [{ op: "set" as const, path: [{ key: "title" }], value: title }] }),
    };
    const prepare = spyOn(S, "prepareDocument"),
      stringify = spyOn(JSON, "stringify");
    const documentEncodings = () =>
      stringify.mock.calls.filter(
        ([value]) =>
          value &&
          typeof value === "object" &&
          (Object.hasOwn(value, "title") ||
            Object.hasOwn(value.data ?? {}, "title") ||
            Object.hasOwn(value.snapshot?.data ?? {}, "title")),
      ).length;
    try {
      const outcome = await state.execute(request);
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(documentEncodings()).toBe(1);
      if (!("prepared" in outcome) || !outcome.prepared)
        throw new Error("Expected a prepared snapshot");
      expect(JSON.parse(outcome.prepared.json)).toEqual(state.snapshot);
      await state.execute(request);
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(documentEncodings()).toBe(1);
    } finally {
      prepare.mockRestore();
      stringify.mockRestore();
    }
  },
);

test("schema paths distinguish arrays, lists, records, and literal dotted keys", () => {
  const schema = S.Document({
    tasks: S.List(S.Object({ id: S.String(), done: S.Boolean() }), "id"),
    tags: S.Array(S.String()),
    names: S.Record(S.String()),
  });
  const fields = S.paths(schema);
  expect(fields.tasks.item({ id: "a" })[S.pathInfo].steps).toEqual([
    { key: "tasks" },
    { item: "a" },
  ]);
  expect(fields.names.at("a.b")[S.pathInfo].steps).toEqual([{ key: "names" }, { key: "a.b" }]);
  // @ts-expect-error atomic arrays cannot be addressed by identity
  expect(fields.tags.item).toBeUndefined();
  expect(Object.isFrozen(fields.tasks)).toBe(true);
});

test("non-JSON and overflow never mutate the committed document", () => {
  const schema = S.Document({ count: S.Number() });
  const before = { count: Number.MAX_VALUE };
  expect(() =>
    applyOps(schema, before, [
      { op: "increment", path: [{ key: "count" }], amount: Number.MAX_VALUE },
    ]),
  ).toThrow("finite");
  expect(() =>
    applyOps(schema, before, [{ op: "set", path: [{ key: "count" }], value: NaN }]),
  ).toThrow("plain JSON");
  expect(before.count).toBe(Number.MAX_VALUE);
});

test("inert reads index frozen lists without caching mutable caller arrays", () => {
  const schema = S.Document({
    tasks: S.List(S.Object({ id: S.String(), text: S.String() }), "id"),
  });
  const fields = S.paths(schema),
    path = fields.tasks.item("b").text;
  const mutable = {
    tasks: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  };
  expect(S.read(mutable, path)).toBe("B");
  mutable.tasks[1] = { id: "b", text: "Changed" };
  expect(S.read(mutable, path)).toBe("Changed");
  const frozen = { tasks: Object.freeze(mutable.tasks.map((row) => Object.freeze(row))) };
  expect(S.read(frozen, path)).toBe("Changed");
  expect(
    S.read({ tasks: Object.freeze([Object.freeze({ id: "b", text: "New snapshot" })]) }, path),
  ).toBe("New snapshot");
  expect(S.read(frozen, path)).toBe("Changed");
});

test("a shallow-frozen caller list does not cache mutable row identities", () => {
  const schema = S.Document({ tasks: S.List(S.Object({ id: S.String() }), "id") });
  const fields = S.paths(schema),
    row = { id: "before" },
    data = { tasks: Object.freeze([row]) };
  expect(S.read(data, fields.tasks.item("before"))).toBe(row);
  row.id = "after";
  expect(S.read(data, fields.tasks.item("before"))).toBeUndefined();
  expect(S.read(data, fields.tasks.item("after"))).toBe(row);
});

test("unannotated objects are atomic in paths and the interpreter", () => {
  const schema = S.Document({ plain: Type.Object({ child: Type.String() }) });
  const fields = S.paths(schema);
  // @ts-expect-error unannotated objects have no field paths
  expect(fields.plain.child).toBeUndefined();
  expect(() =>
    applyOps(schema, { plain: { child: "before" } }, [
      { op: "set", path: [{ key: "plain" }, { key: "child" }], value: "after" },
    ]),
  ).toThrow("atomic");
  expect(
    applyOps(schema, { plain: { child: "before" } }, [
      { op: "set", path: [{ key: "plain" }], value: { child: "after" } },
    ]).data,
  ).toEqual({ plain: { child: "after" } });
});

test("preview freezing work stays constant as receipt history grows", async () => {
  const schema = S.Document({ count: S.Integer() }),
    authority = new MemoryAuthority(schema, { count: 0 });
  const open = authority.open(),
    counts: number[] = [],
    freezing = spyOn(Object, "freeze");
  try {
    for (let index = 0; index < 20; index++) {
      const start = freezing.mock.calls.length;
      const result = await authority.execute({
        documentId: open.snapshot.documentId,
        schemaHash: open.snapshot.schemaHash,
        authority: open.snapshot.authority,
        leaseId: open.lease.id,
        requestId: String(index),
        ops: [{ op: "increment", path: [{ key: "count" }], amount: 1 }],
      });
      expect(result.ok).toBe(true);
      counts.push(freezing.mock.calls.length - start);
    }
    expect(Math.max(...counts)).toBe(Math.min(...counts));
    expect(authority.open().snapshot.data).toEqual({ count: 20 });
  } finally {
    freezing.mockRestore();
  }
});

test("undo requires its originating lease and cannot cross an authority", async () => {
  const authority = new MemoryAuthority(S.Document({ count: S.Integer() }), { count: 0 });
  const original = authority.open(),
    other = authority.open();
  const { data: _data, revision: _revision, ...identity } = original.snapshot;
  const write: Request = {
    ...identity,
    leaseId: original.lease.id,
    requestId: "write",
    ops: [{ op: "increment", path: [{ key: "count" }], amount: 1 }],
  };
  expect((await authority.execute(write)).ok).toBe(true);
  const undo: Request = {
    ...identity,
    leaseId: original.lease.id,
    requestId: "undo",
    undo: { requestId: "write", revision: 1 },
  };
  expect(await authority.execute({ ...undo, leaseId: other.lease.id })).toMatchObject({
    ok: false,
    error: { code: "rejected" },
  });
  expect(await authority.execute({ ...undo, authority: "other" })).toMatchObject({
    ok: false,
    error: { code: "authority_changed" },
  });
  expect(await authority.execute(undo)).toEqual({ ok: true, revision: 2 });
  expect(authority.open().snapshot.data).toEqual({ count: 0 });
});
