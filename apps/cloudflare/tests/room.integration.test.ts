import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createAPIClient } from "@hitslop/api/client";
import { sharedFixture } from "./shared-fixture.ts";
import { digest, signRoomToken } from "../src/crypto.ts";

// Exercise the actual Worker/SQLite/WebSocket runtime, including restart from disk.
const key = "isolated-room-integration-test-key";
const schema = "a".repeat(64);
let directory: string, origin: string, process: ReturnType<typeof Bun.spawn>;
let port: number;
async function start() {
  process = Bun.spawn(
    [
      "node",
      resolve(import.meta.dir, "../node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "tests/worker.ts",
      "--local",
      "--port",
      String(port),
      "--persist-to",
      directory,
      "--var",
      `TOKEN_KEY:${key}`,
    ],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "ignore",
      stderr: "inherit",
      env: {
        ...Bun.env,
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
        WRANGLER_SEND_METRICS: "false",
      },
    },
  );
  for (let i = 0; i < 400; i++) {
    if (process.exitCode !== null) throw new Error(`Wrangler exited ${process.exitCode}`);
    try {
      await fetch(origin);
      return;
    } catch {
      await Bun.sleep(50);
    }
  }
  throw new Error("Wrangler startup timed out");
}
async function stop() {
  process?.kill();
  if (process) await process.exited;
}
beforeAll(async () => {
  directory = await mkdtemp(resolve(tmpdir(), "hitslop-room-test-"));
  const reserve = Bun.serve({ port: 0, fetch: () => new Response() });
  port = reserve.port!;
  reserve.stop(true);
  origin = `http://127.0.0.1:${port}`;
  const migration = Bun.spawn(
    [
      "node",
      resolve(import.meta.dir, "../node_modules/wrangler/bin/wrangler.js"),
      "d1",
      "execute",
      "DB",
      "--local",
      "--persist-to",
      directory,
      "--file",
      resolve(import.meta.dir, "../migrations/0001_init.sql"),
      "--yes",
    ],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "ignore",
      stderr: "inherit",
      env: {
        ...Bun.env,
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
        WRANGLER_SEND_METRICS: "false",
      },
    },
  );
  if ((await migration.exited) !== 0) throw new Error("Local test migration failed");
  await start();
}, 30000);
afterAll(async () => {
  await stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});
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
async function seed(room: string, auth: string, checkpoint = "AQ==") {
  return fetch(`${origin}/rooms/${room}`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ protocol: 1, documentId: room, schema, checkpoint, version: "seed" }),
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
  const hello = (after: number) =>
    send({
      type: "hello",
      protocol: 1,
      documentId: room,
      schema: fingerprint,
      after,
      batchSize: 8,
    });
  return { ws, next, send, hello, frames };
}

test("room identity, immutable seed, durable retry, replay windows, and restart", async () => {
  const room = crypto.randomUUID(),
    auth = await token(room);
  const wrong = await fetch(`${origin}/rooms/${crypto.randomUUID()}`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      protocol: 1,
      documentId: room,
      schema,
      checkpoint: "AQ==",
      version: "seed",
    }),
  });
  expect(wrong.status).toBe(403);
  expect((await seed(room, auth)).status).toBe(200);
  expect((await seed(room, auth)).status).toBe(200);
  expect((await seed(room, auth, "Ag==")).status).toBe(409);
  const a = await connection(room, auth);
  a.hello(1);
  await a.next("ready");
  const bytes = new Uint8Array([2, 3, 4]);
  const batch = {
    id: crypto.randomUUID(),
    hash: await digest(bytes),
    bytes: Buffer.from(bytes).toString("base64"),
  };
  const append = { type: "append", protocol: 1, documentId: room, schema, batch };
  a.send(append);
  const ack = await a.next("ack");
  expect(ack.sequence).toBe(2);
  const delivered = await a.next("updates");
  expect(delivered.updates[0].batch).toEqual(batch);
  a.send(append); // Lost ACK: exact same immutable batch is safe to retry.
  expect(await a.next("ack")).toEqual(ack);
  a.send({ type: "applied", sequence: 2 });
  await a.next("ready");
  const b2 = { id: crypto.randomUUID(), hash: await digest(new Uint8Array([5])), bytes: "BQ==" };
  a.send({ ...append, batch: b2 });
  expect((await a.next("ack")).sequence).toBe(3);
  a.ws.close();
  await stop();
  await start();
  const b = await connection(room, auth);
  b.hello(1);
  const replay = await b.next("updates");
  expect(replay.updates.map((entry: any) => entry.sequence)).toEqual([2, 3]);
  b.send({ type: "applied", sequence: 3 });
  expect((await b.next("ready")).head).toBe(3);
  b.send(append);
  expect(await b.next("ack")).toEqual(ack);
  b.ws.close();
}, 30000);

test("real Worker RPC attaches an invited member before issuing room credentials", async () => {
  const owner = createAPIClient(origin, { authorization: () => "test:owner" });
  const guest = createAPIClient(origin, { authorization: () => "test:friend_with_underscore" });
  const input = await sharedFixture(),
    documentId = input.documentId;
  const document = await owner.documents.create(input);
  expect(await owner.documents.create(input)).toEqual(document);
  await expect(owner.documents.create({ ...input, checkpoint: "Ag==" })).rejects.toMatchObject({
    code: "CONFLICT",
  });
  await guest.documents.join({ documentId, invite: document.invite! });
  const ownerSession = await owner.documents.session({ documentId });
  const session = await guest.documents.session({ documentId });
  const guestRoom = createAPIClient(origin, { authorization: () => session.token });
  expect((await guestRoom.rooms.seed({ documentId })).snapshot.checkpoint).toBe("AQ==");
  const socket = await connection(documentId, session.token, document.schema);
  socket.hello(1);
  expect((await socket.next("ready")).head).toBe(1);
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
  "Swift replicas merge offline edits through real HTTP and WebSockets",
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
