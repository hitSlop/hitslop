import { createHash } from "node:crypto";
import { api, RelaySocket, secret, sleep, token, until } from "./client";

export const batch = (bytes: Uint8Array, id = crypto.randomUUID()) => ({
  id,
  hash: createHash("sha256").update(bytes).digest("hex"),
  bytes: Buffer.from(bytes).toString("base64"),
});
export async function verifyIncrementalRelay(endpoint: string) {
  const room = crypto.randomUUID(),
    owner = token(await secret(), room, "owner", true),
    schema = "a".repeat(64);
  const seed = {
    protocol: 2,
    documentId: room,
    schema,
    checkpoint: Buffer.from("seed").toString("base64"),
    version: "seed",
  };
  const hello = { protocol: 2, documentId: room, schema };
  const checks: { name: string; passed: boolean }[] = [],
    sockets: RelaySocket[] = [];
  const check = (name: string, passed: boolean) => {
    checks.push({ name, passed });
    if (!passed) throw new Error(name);
  };
  const denied = async (work: () => Promise<unknown>, name: string) => {
    let failed = false;
    try {
      await work();
    } catch {
      failed = true;
    }
    check(name, failed);
  };
  const open = async (after = 1, auto = true, greeting: object = hello) => {
    const s = await RelaySocket.open(
      endpoint,
      room,
      owner,
      after,
      auto,
      greeting,
    );
    sockets.push(s);
    return s;
  };
  const append = (
    s: RelaySocket,
    b: ReturnType<typeof batch>,
    extra: object = {},
  ) => s.send({ type: "append", ...hello, batch: b, ...extra });
  await api(endpoint, room, owner, "POST", "", seed);
  try {
    check(
      "immutable bootstrap seed is available",
      (await api(endpoint, room, owner, "GET", "/seed")).snapshot.checkpoint ===
        seed.checkpoint,
    );
    await denied(
      () =>
        api(endpoint, room, owner, "POST", "", {
          ...seed,
          checkpoint: Buffer.from("replacement").toString("base64"),
        }),
      "seed replacement rejected",
    );
    const wrong = await open(0, true, {});
    await wrong.wait("error");
    check("snapshot protocol cannot join incremental room", true);
    wrong.close();
    let a = await open();
    await a.wait("ready");
    const first = batch(Buffer.from("first delta"));
    append(a, first);
    check(
      "append acknowledges immutable ID, hash and sequence",
      (await a.wait("ack")).hash === first.hash,
    );
    append(a, first);
    check(
      "same batch retry does not append",
      (await a.wait("ack")).sequence === 2,
    );
    append(a, batch(Buffer.from("other bytes"), first.id));
    await a.wait("error");
    check("ID reuse with changed bytes rejected", true);
    append(a, { ...first, hash: "0".repeat(64) });
    await a.wait("error");
    check("hash mismatch rejected", true);
    append(a, batch(Buffer.from("wrong schema")), { schema: "b".repeat(64) });
    await a.wait("error");
    check("schema mismatch rejected", true);
    append(a, batch(Buffer.alloc(512 * 1024 + 1, 1)));
    await a.wait("error");
    check(
      "oversized single delta rejected",
      (await api(endpoint, room, owner, "GET", "/stats")).head === 2,
    );
    const second = batch(Buffer.from("second delta"));
    append(a, second);
    await a.wait("ack");
    const stalled = await open(1, false);
    await stalled.wait("update", (m) => m.sequence === 2);
    await sleep(100);
    check(
      "replay sends one unacknowledged delta",
      !stalled.messages.some((m) => m.type === "update"),
    );
    stalled.send({ type: "applied", sequence: 3 });
    await stalled.wait("error");
    stalled.send({ type: "applied", sequence: 2 });
    check(
      "ordered replay retains both deltas",
      (await stalled.wait("update")).batch.hash === second.hash,
    );
    stalled.close();
    await api(endpoint, room, owner, "POST", "/test", { dropAck: true });
    const lost = batch(Buffer.from("lost ACK delta"));
    append(a, lost);
    await until(async () => a.closed, "injected lost ACK");
    a = await open();
    await a.wait("ready");
    append(a, lost);
    check(
      "lost ACK retry keeps original sequence",
      (await a.wait("ack")).sequence === 4,
    );
    const before = await api(endpoint, room, owner, "GET", "/stats");
    await api(endpoint, room, owner, "POST", "/test", { restart: true }).catch(
      () => {},
    );
    a.close();
    a = await open();
    await a.wait("ready");
    append(a, lost);
    const after = await api(endpoint, room, owner, "GET", "/stats");
    check(
      "restart preserves deduplication and complete log",
      (await a.wait("ack")).sequence === 4 &&
        before.bootId !== after.bootId &&
        after.bytes === before.bytes &&
        after.head === 4,
    );
    await api(endpoint, room, owner, "POST", "/test", { limit: 0 });
    append(a, lost);
    check(
      "already stored retry remains valid at quota",
      (await a.wait("ack")).sequence === 4,
    );
    append(a, batch(Buffer.from("over quota")));
    await a.wait("error");
    check(
      "quota preserves retained history",
      (await api(endpoint, room, owner, "GET", "/stats")).head === 4,
    );
    return checks;
  } finally {
    for (const socket of sockets) socket.close();
    await api(endpoint, room, owner, "DELETE");
  }
}
if (import.meta.main)
  console.log(
    JSON.stringify(
      await verifyIncrementalRelay(
        process.env.HITSLOP_SPIKE_ENDPOINT ?? "http://127.0.0.1:8791",
      ),
    ),
  );
