import { mkdir, writeFile } from "node:fs/promises";
import { api, artifacts, RelaySocket, secret, sleep, token, until } from "./client";

export async function verifyRelay(endpoint: string) {
  const room = crypto.randomUUID(), key = await secret();
  const owner = token(key, room, "owner", true), editor = token(key, room, "editor");
  const checks: { name: string; passed: boolean; details?: unknown }[] = [];
  const check = (name: string, passed: boolean, details?: unknown) => { checks.push({ name, passed, ...(details ? { details } : {}) }); if (!passed) throw new Error(name); };
  const denied = async (work: () => Promise<unknown>, name: string) => { let failed = false; try { await work(); } catch { failed = true; } check(name, failed); };
  const snapshot = (text: string) => ({ documentId: room, schema: "a".repeat(64), checkpoint: Buffer.from(text).toString("base64"), version: text });
  let a: RelaySocket | undefined, b: RelaySocket | undefined, blocked: RelaySocket | undefined;
  let created = false;
  try {
    await denied(() => api(endpoint, room, token(key, room, "owner", true, 1), "POST", "", snapshot("seed")), "expired credentials rejected");
    await api(endpoint, room, owner, "POST", "", snapshot("seed")); created = true;
    await denied(() => api(endpoint, room, editor, "GET", "/stats"), "unknown membership denied");
    await api(endpoint, room, owner, "PUT", "/members/editor");
    a = await RelaySocket.open(endpoint, room, owner); b = await RelaySocket.open(endpoint, room, editor);
    await a.wait("ready"); await b.wait("ready");
    a.send({ type: "append", id: "one", snapshot: snapshot("one") });
    const ack = await a.wait("ack"); await b.wait("snapshot", m => m.sequence === ack.sequence);
    check("persist and fanout", ack.sequence === 2);
    a.send({ type: "append", id: "duplicate", snapshot: snapshot("one") });
    check("duplicate append retains sequence", (await a.wait("ack")).sequence === 2);
    a.send({ type: "append", id: "wrong-schema", snapshot: { ...snapshot("bad"), schema: "b".repeat(64) } });
    await a.wait("error"); check("schema mismatch rejected", (await api(endpoint, room, owner, "GET", "/stats")).head === 2);
    a.send({ type: "append", id: "too-large", snapshot: snapshot("x".repeat(512 * 1024 + 1)) });
    await a.wait("error"); check("oversized snapshot rejected", (await api(endpoint, room, owner, "GET", "/stats")).head === 2);
    blocked = await RelaySocket.open(endpoint, room, editor, 0, false);
    await blocked.wait("snapshot"); await sleep(150);
    check("replay bounds one unacknowledged snapshot", !blocked.messages.some(m => m.type === "snapshot"));
    blocked.send({ type: "applied", sequence: 2 }); await blocked.wait("error");
    check("noncontiguous replay acknowledgement rejected", true); blocked.close();
    await api(endpoint, room, owner, "POST", "/test", { dropAck: true });
    a.send({ type: "append", id: "lost-ack", snapshot: snapshot("durable") });
    await until(async () => a!.closed, "lost ack connection closes");
    const lostAckState = await api(endpoint, room, owner, "GET", "/stats");
    check("lost ack follows durable storage", lostAckState.head === 3, { head: lostAckState.head, close: a.closeDetails, messages: a.messages.map(m => ({ type: m.type, message: m.message })) });
    a = await RelaySocket.open(endpoint, room, owner, 2); await a.wait("snapshot", m => m.sequence === 3); await a.wait("ready");
    a.send({ type: "append", id: "retry", snapshot: snapshot("durable") });
    check("lost ack retry is idempotent", (await a.wait("ack")).sequence === 3);
    const beforeRestart = await api(endpoint, room, owner, "GET", "/stats");
    await api(endpoint, room, owner, "POST", "/test", { restart: true }).catch(() => {});
    a.close(); b.close();
    a = await RelaySocket.open(endpoint, room, owner, 2); b = await RelaySocket.open(endpoint, room, editor, 2);
    await a.wait("snapshot", m => m.sequence === 3); await a.wait("ready"); await b.wait("ready");
    const afterRestart = await api(endpoint, room, owner, "GET", "/stats");
    check("object restart preserves replay and stored bytes", beforeRestart.bootId !== afterRestart.bootId && afterRestart.head === 3 && afterRestart.bytes === beforeRestart.bytes);
    await api(endpoint, room, owner, "POST", "/test", { limit: 0 });
    a.send({ type: "append", id: "quota", snapshot: snapshot("new") });
    check("quota rejection leaves history intact", (await a.wait("error")).message.includes("storage limit") && (await api(endpoint, room, owner, "GET", "/stats")).head === 3);
    await api(endpoint, room, owner, "DELETE", "/members/editor");
    await until(async () => b!.closed, "revoked connection closes"); check("revocation closes live connections", true);
    await denied(() => api(endpoint, room, editor, "GET", "/stats"), "revoked member denied on reconnect");
    check("stored bytes count unique snapshots", (await api(endpoint, room, owner, "GET", "/stats")).bytes === 14);
  } finally {
    a?.close(); b?.close(); blocked?.close();
    if (created) await api(endpoint, room, owner, "DELETE");
    await mkdir(artifacts, { recursive: true });
    await writeFile(`${artifacts}/relay-${endpoint.startsWith("https") ? "hosted" : "local"}.json`, JSON.stringify({ endpoint, checks, passed: checks.length === 15 && checks.every(c => c.passed) }, null, 2));
  }
  return checks;
}
if (import.meta.main) console.log(JSON.stringify(await verifyRelay(process.env.HITSLOP_SPIKE_ENDPOINT ?? "http://127.0.0.1:8791")));
