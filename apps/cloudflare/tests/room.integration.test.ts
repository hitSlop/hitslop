import { roomProtocol } from "@hitslop/schema";
import { workerHarness } from "./harness.ts";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { resolve } from "node:path";
import { createAPIClient } from "@hitslop/api/client";
import { sharedFixture } from "./shared-fixture.ts";
import { digest, signRoomToken } from "../src/crypto.ts";

// Exercise the actual Worker/SQLite/WebSocket runtime, including restart from disk.
const key = "isolated-room-integration-test-key";
const schema = "a".repeat(64);
const harness = workerHarness(key);
let origin: string;
const start = () => harness.start(),
  stop = () => harness.stop();
beforeAll(async () => {
  await harness.initialize();
  origin = harness.origin;
}, 30000);
afterAll(() => harness.dispose());
async function token(room: string) {
  return signRoomToken(key, {
    room,
    user: "owner",
    name: "Owner",
    email: "",
    owner: true,
    exp: Math.floor(Date.now() / 1000) + 600,
  });
}
async function connection(room: string, auth: string, fingerprint = schema) {
  const frames: any[] = [];
  const ws = new WebSocket(`${origin.replace("http", "ws")}/rooms/${room}/socket`, {
    headers: { authorization: `Bearer ${auth}` },
  });
  ws.onmessage = (event) => {
    if (event.data !== "pong") frames.push(JSON.parse(String(event.data)));
  };
  const next = async (type: string): Promise<any> => {
    for (let i = 0; i < 300; i++) {
      const index = frames.findIndex((frame) => frame.type === type);
      if (index >= 0) return frames.splice(index, 1)[0];
      if (frames.some((frame) => frame.type === "error")) throw new Error(JSON.stringify(frames));
      await Bun.sleep(10);
    }
    throw new Error(`No ${type} frame: ${JSON.stringify(frames)}`);
  };
  await next("welcome");
  const send = (value: unknown) => ws.send(JSON.stringify(value));
  const hello = () =>
    send({ type: "hello", protocol: roomProtocol, documentId: room, schema: fingerprint });
  return { ws, next, send, hello, frames };
}

test("commands, durable success and failure receipts, immutable seed, and restart", async () => {
  const owner = createAPIClient(origin, { authorization: () => "test:owner" });
  const input = await sharedFixture();
  const room = input.documentId;
  await owner.documents.create(input);
  const session = await owner.documents.session({ documentId: room });
  const a = await connection(room, session.token, input.schema);
  a.hello();
  const { open } = await a.next("ready");
  const request = {
    documentId: room,
    schemaHash: input.schema,
    authority: open.snapshot.authority,
    leaseId: open.lease.id,
    requestId: crypto.randomUUID(),
    ops: [{ op: "increment", path: [{ key: "count" }], amount: 1 }],
  };
  const execute = { type: "execute", protocol: roomProtocol, request };
  a.send(execute);
  const receipt = await a.next("result");
  expect(receipt.result).toEqual({ ok: true, revision: 1 });
  expect((await a.next("snapshot")).snapshot.data.count).toBe(1);
  a.send(execute);
  expect(await a.next("result")).toEqual(receipt);
  const rejected = {
    ...execute,
    request: {
      ...request,
      requestId: crypto.randomUUID(),
      ops: [{ op: "toggle", path: [{ key: "count" }] }],
    },
  };
  a.send(rejected);
  const rejection = await a.next("result");
  expect(rejection.result.ok).toBe(false);
  a.ws.close();
  await stop();
  await start();
  const b = await connection(room, session.token, input.schema);
  b.hello();
  const reopened = (await b.next("ready")).open;
  expect(reopened.snapshot.data.count).toBe(1);
  b.send(execute);
  expect(await b.next("result")).toEqual(receipt);
  b.send(rejected);
  expect(await b.next("result")).toEqual(rejection);
  b.send({
    ...execute,
    request: { ...request, ops: [{ op: "increment", path: [{ key: "count" }], amount: 100 }] },
  });
  expect((await b.next("result")).result.error.code).toBe("request_reused");
  const { ops: _ops, ...identity } = request;
  const undo = {
    ...execute,
    request: {
      ...identity,
      requestId: "undo-once",
      undo: { requestId: request.requestId, revision: 1 },
    },
  };
  b.send({
    ...undo,
    request: { ...undo.request, leaseId: reopened.lease.id, requestId: "wrong-lease" },
  });
  expect((await b.next("result")).result.error.code).toBe("rejected");
  b.send(undo);
  const undone = await b.next("result");
  expect(undone.result).toEqual({ ok: true, revision: 2 });
  expect((await b.next("snapshot")).snapshot.data.count).toBe(0);
  b.send(undo);
  expect(await b.next("result")).toEqual(undone);
  b.send({ ...undo, request: { ...undo.request, requestId: "undo-twice" } });
  expect((await b.next("result")).result.error.code).toBe("stale_revision");
  b.ws.close();
}, 30000);

test("real Worker RPC attaches an invited member before issuing room credentials", async () => {
  const owner = createAPIClient(origin, { authorization: () => "test:owner" });
  const guest = createAPIClient(origin, { authorization: () => "test:friend_with_underscore" });
  const input = await sharedFixture(),
    documentId = input.documentId;
  const document = await owner.documents.create(input);
  expect(await owner.documents.create(input)).toEqual(document);
  await expect(
    owner.documents.create({
      ...input,
      seed: JSON.stringify({ ...JSON.parse(input.seed), data: { count: 2 } }),
    }),
  ).rejects.toMatchObject({
    code: "CONFLICT",
  });
  await guest.documents.join({ documentId, invite: document.invite! });
  const ownerSession = await owner.documents.session({ documentId });
  const session = await guest.documents.session({ documentId });
  const guestRoom = createAPIClient(origin, { authorization: () => session.token });
  expect((await guestRoom.rooms.seed({ documentId })).snapshot.data).toEqual({ count: 0 });
  const socket = await connection(documentId, session.token, document.schema);
  socket.hello();
  expect((await socket.next("ready")).open.snapshot.revision).toBe(0);
  const replacement = await owner.documents.invite({ documentId, enabled: true });
  await expect(
    guest.documents.join({ documentId, invite: document.invite! }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(replacement.invite).not.toBe(document.invite);
  await owner.documents.removeMember({ documentId, memberId: "friend_with_underscore" });
  expect((await socket.next("error")).status).toBe(403);
  await expect(guest.documents.session({ documentId })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(guestRoom.rooms.seed({ documentId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    guest.documents.join({ documentId, invite: replacement.invite! }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  socket.ws.close();
  const obsolete = await fetch(`${origin}/rooms/${documentId}/members`, {
    method: "PUT",
    headers: { authorization: `Bearer ${ownerSession.token}` },
  });
  expect(obsolete.status).toBe(404);
});

test("concurrent joins preserve the member cap and cannot restore a rotated invitation", async () => {
  const owner = createAPIClient(origin, { authorization: () => "test:owner" });
  const input = await sharedFixture(),
    documentId = input.documentId;
  const created = await owner.documents.create(input);
  const clients = Array.from({ length: 25 }, (_, i) =>
    createAPIClient(origin, { authorization: () => `test:guest-${i}` }),
  );
  const joined = await Promise.allSettled(
    clients.map((client) => client.documents.join({ documentId, invite: created.invite! })),
  );
  expect(joined.filter((x) => x.status === "fulfilled")).toHaveLength(19);
  expect((await owner.documents.get({ documentId })).members).toHaveLength(20);
  const [, rotated] = await Promise.all([
    clients[0]!.documents.join({ documentId, invite: created.invite! }).catch(() => null),
    owner.documents.invite({ documentId, enabled: true }),
  ]);
  expect((await owner.documents.get({ documentId })).invite).toBe(rotated.invite);
  await expect(
    clients[0]!.documents.join({ documentId, invite: created.invite! }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("sharing excludes document state and requires the exact packaged schema", async () => {
  const owner = createAPIClient(origin, { authorization: () => "test:owner" });
  const privateFiles = await sharedFixture({
    "stores/data.json": new TextEncoder().encode("secret"),
  });
  await expect(owner.documents.create(privateFiles)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const input = await sharedFixture();
  await expect(owner.documents.create({ ...input, schema: "a".repeat(64) })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

test.skipIf(!Bun.env.HITSLOP_NATIVE_SYNC)(
  "Swift commands recover through real HTTP and WebSockets",
  async () => {
    const native = Bun.spawn(
      [
        "/usr/bin/swift",
        "test",
        "--package-path",
        resolve(import.meta.dir, "../../apple/Packages/HitSlopApple"),
        "--filter",
        "native.*ThroughRealCloudflareRoom",
      ],
      {
        env: { ...Bun.env, HITSLOP_NATIVE_ROOM_ORIGIN: origin },
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    expect(await native.exited).toBe(0);
  },
  180000,
);
