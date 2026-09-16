import { DurableObject } from "cloudflare:workers";

interface Env { ROOMS: DurableObjectNamespace<SlopRoom>; TOKEN_KEY: string; TEST_CONTROLS?: string }
type Claims = { room: string; user: string; exp: number; owner?: boolean };
type Attachment = Claims & { cursor: number; sent: number; started: boolean; batchSize?: number };
type Snapshot = { documentId: string; schema: string; checkpoint: string; version: string };
type Room = { protocol: number; id: string; schema: string; owner: string; bytes: number; limit_bytes: number; drop_ack: number };
const LIMIT = 64 * 1024 * 1024, MAX_SNAPSHOT = 512 * 1024;
const encoder = new TextEncoder();
const json = (value: unknown, status = 200) => Response.json(value, { status });
const fail = (message: string, status = 400): never => { throw new HttpError(message, status); };
class HttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const name = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value);
const unbase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const unurl = (value: string) => unbase64(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
const hex = (data: ArrayBuffer) => Array.from(new Uint8Array(data), b => b.toString(16).padStart(2, "0")).join("");
async function claims(request: Request, env: Env): Promise<Claims> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const parts = token.split(".");
  if (!env.TOKEN_KEY || parts.length !== 2 || token.length > 2048) fail("Unauthorized", 401);
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(env.TOKEN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("HMAC", key, unurl(parts[1]), encoder.encode(parts[0]))) fail("Unauthorized", 401);
    const value = JSON.parse(new TextDecoder().decode(unurl(parts[0]))) as Claims;
    if (!name(value.room) || !name(value.user) || !Number.isSafeInteger(value.exp) || value.exp <= Date.now() / 1000) fail("Expired or invalid credential", 401);
    return value;
  } catch { return fail("Unauthorized", 401); }
}
function snapshot(value: unknown): { value: Snapshot; bytes: Uint8Array } {
  const s = value as Snapshot;
  if (!s || !name(s.documentId) || typeof s.schema !== "string" || !/^[a-f0-9]{64}$/.test(s.schema)
    || typeof s.version !== "string" || !s.version.length || s.version.length > 65536
    || typeof s.checkpoint !== "string" || s.checkpoint.length > Math.ceil(MAX_SNAPSHOT / 3) * 4) fail("Invalid snapshot");
  let bytes: Uint8Array;
  try { bytes = unbase64(s.checkpoint); } catch { return fail("Invalid snapshot encoding"); }
  if (!bytes.length || bytes.length > MAX_SNAPSHOT) fail("Invalid snapshot size");
  // Canonical base64 prevents alternate representations bypassing idempotency.
  const canonical = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
  if (canonical !== s.checkpoint) fail("Invalid snapshot encoding");
  return { value: s, bytes };
}
async function body(request: Request): Promise<any> {
  if (Number(request.headers.get("Content-Length")) > 1024 * 1024) fail("Request too large", 413);
  const text = await request.text();
  if (text.length > 1024 * 1024) fail("Request too large", 413);
  try { return JSON.parse(text); } catch { return fail("Invalid JSON"); }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url), match = /^\/rooms\/([a-zA-Z0-9-]{1,80})(?:\/.*)?$/.exec(url.pathname);
      if (!match) return json({ error: "Not found" }, 404);
      const user = await claims(request, env);
      if (user.room !== match[1]) fail("Wrong room", 403);
      return await env.ROOMS.getByName(match[1]).fetch(request);
    } catch (e) { return json({ error: e instanceof HttpError ? e.message : "Request failed" }, e instanceof HttpError ? e.status : 500); }
  },
} satisfies ExportedHandler<Env>;

/** Opaque byte relay. SQLite is authoritative; no Loro or JSON merge code runs here. */
export class SlopRoom extends DurableObject<Env> {
  private readonly bootId = crypto.randomUUID();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS room (id TEXT PRIMARY KEY, schema TEXT NOT NULL, owner TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0, limit_bytes INTEGER NOT NULL DEFAULT ${LIMIT}, drop_ack INTEGER NOT NULL DEFAULT 0)`);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS updates (sequence INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL UNIQUE, checkpoint BLOB NOT NULL, version TEXT NOT NULL)");
    // Additive migration of this test service; existing snapshot rooms remain v1.
    if (!ctx.storage.sql.exec<{name:string}>("PRAGMA table_info(room)").toArray().some(c=>c.name==="protocol")) ctx.storage.sql.exec("ALTER TABLE room ADD COLUMN protocol INTEGER NOT NULL DEFAULT 1");
    if (!ctx.storage.sql.exec<{name:string}>("PRAGMA table_info(updates)").toArray().some(c=>c.name==="batch_id")) ctx.storage.sql.exec("ALTER TABLE updates ADD COLUMN batch_id TEXT");
    ctx.storage.sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS batch_identity ON updates(batch_id)");
  }
  private room(): Room { return this.ctx.storage.sql.exec<Room>("SELECT * FROM room").toArray()[0] ?? fail("Room not found", 404); }
  private authorize(user: Claims, owner = false): Room {
    const room = this.room();
    if (user.exp <= Date.now() / 1000 || user.room !== room.id) fail("Expired or wrong room", 403);
    if (!this.ctx.storage.sql.exec("SELECT id FROM members WHERE id = ?", user.user).toArray().length || (owner && user.user !== room.owner)) fail("Access revoked", 403);
    return room;
  }
  private head() { return this.ctx.storage.sql.exec<{ n: number }>("SELECT COALESCE(MAX(sequence),0) AS n FROM updates").one().n; }
  async fetch(request: Request): Promise<Response> {
    try {
      const user = await claims(request, this.env), url = new URL(request.url);
      const route = url.pathname.slice(`/rooms/${user.room}`.length);
      if (request.method === "POST" && route === "") {
        if (user.owner !== true) fail("Owner credential required", 403);
        const raw = await body(request), protocol = raw.protocol ?? 1;
        if (protocol !== 1 && protocol !== 2) fail("Unsupported protocol");
        const input = snapshot(raw);
        if (input.value.documentId !== user.room) fail("Wrong document");
        this.ctx.storage.transactionSync(() => {
          const existing = this.ctx.storage.sql.exec<Room>("SELECT * FROM room").toArray()[0];
          if (existing) { this.authorize(user, true); if (existing.schema !== input.value.schema || existing.protocol !== protocol) fail("Schema or protocol mismatch"); }
          else {
            this.ctx.storage.sql.exec("INSERT INTO room(id,schema,owner,protocol) VALUES(?,?,?,?)", user.room, input.value.schema, user.user, protocol);
            this.ctx.storage.sql.exec("INSERT INTO members(id) VALUES(?)", user.user);
          }
        });
        await this.append(user, input.value);
        return json({ roomId: user.room });
      }
      this.authorize(user);
      if (route === "/seed" && request.method === "GET") {
        const room = this.authorize(user);
        if (room.protocol !== 2) fail("Not an incremental room");
        const seed = this.ctx.storage.sql.exec<{hash:string; checkpoint:ArrayBuffer; version:string}>("SELECT hash,checkpoint,version FROM updates WHERE sequence=1").one();
        return json({ protocol: 2, sequence: 1, hash: seed.hash, snapshot: {documentId:room.id,schema:room.schema,version:seed.version,
          checkpoint:btoa(Array.from(new Uint8Array(seed.checkpoint), b=>String.fromCharCode(b)).join(""))} });
      }
      if (route === "/socket" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server, [user.user]);
        server.serializeAttachment({ ...user, cursor: 0, sent: 0, started: false } satisfies Attachment);
        server.send(JSON.stringify({ type: "welcome", protocol: this.room().protocol, bootId: this.bootId }));
        return new Response(null, { status: 101, webSocket: client });
      }
      if (route === "/stats" && request.method === "GET") {
        const room = this.authorize(user, true);
        return json({ protocol:room.protocol, head: this.head(), bytes: room.bytes, limit: room.limit_bytes, connections: this.ctx.getWebSockets().length, bootId: this.bootId });
      }
      if (route.startsWith("/members/")) {
        this.authorize(user, true); const member = route.slice(9);
        if (!name(member) || member === this.room().owner) fail("Invalid member");
        if (request.method === "PUT") {
          const count = this.ctx.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM members").one().n;
          if (count >= 20 && !this.ctx.storage.sql.exec("SELECT id FROM members WHERE id=?", member).toArray().length) fail("Member limit", 429);
          this.ctx.storage.sql.exec("INSERT OR IGNORE INTO members(id) VALUES(?)", member);
        } else if (request.method === "DELETE") {
          this.ctx.storage.sql.exec("DELETE FROM members WHERE id=?", member);
          for (const ws of this.ctx.getWebSockets(member)) ws.close(1008, "Access revoked");
        } else fail("Method not allowed", 405);
        return json({ accepted: true });
      }
      if (route === "/test" && request.method === "POST" && this.env.TEST_CONTROLS === "true") {
        this.authorize(user, true); const input = await body(request);
        this.authorize(user, true);
        if (input.restart === true) this.ctx.abort("Injected test restart");
        if (input.dropAck === true) this.ctx.storage.sql.exec("UPDATE room SET drop_ack=1");
        if (Number.isSafeInteger(input.limit) && input.limit >= 0 && input.limit <= LIMIT) this.ctx.storage.sql.exec("UPDATE room SET limit_bytes=?", input.limit);
        return json({ accepted: true });
      }
      if (route === "" && request.method === "DELETE") {
        this.authorize(user, true);
        for (const ws of this.ctx.getWebSockets()) ws.close(1000, "Test room removed");
        await this.ctx.storage.deleteAll(); return json({ removed: true });
      }
      return json({ error: "Not found" }, 404);
    } catch (e) { return json({ error: e instanceof HttpError ? e.message : "Request failed" }, e instanceof HttpError ? e.status : 500); }
  }
  private async append(user: Claims, value: unknown): Promise<{ sequence: number; hash: string }> {
    const { value: s, bytes } = snapshot(value), hash = hex(await crypto.subtle.digest("SHA-256", bytes));
    const sequence = this.ctx.storage.transactionSync(() => {
      const room = this.authorize(user);
      if (s.documentId !== room.id || s.schema !== room.schema) fail("Document or schema mismatch");
      if (room.protocol === 2 && this.head() > 0) {
        const seed = this.ctx.storage.sql.exec<{hash:string}>("SELECT hash FROM updates WHERE sequence=1").one();
        if (seed.hash !== hash) fail("Incremental seed is immutable");
        return 1;
      }
      const prior = this.ctx.storage.sql.exec<{ sequence: number }>("SELECT sequence FROM updates WHERE hash=?", hash).toArray()[0];
      if (prior) return prior.sequence;
      if (room.bytes + bytes.length > room.limit_bytes || this.head() >= 10000) fail("Room storage limit; changes remain local", 429);
      const row = this.ctx.storage.sql.exec<{ sequence: number }>("INSERT INTO updates(hash,checkpoint,version) VALUES(?,?,?) RETURNING sequence", hash, bytes.buffer, s.version).one();
      this.ctx.storage.sql.exec("UPDATE room SET bytes=bytes+?", bytes.length);
      return row.sequence;
    });
    await this.ctx.storage.sync(); // Explicit durability barrier before ack or fanout.
    for (const ws of this.ctx.getWebSockets()) this.sendNext(ws);
    return { sequence, hash };
  }
  private async appendBatch(user: Claims, input: any): Promise<{id:string;sequence:number;hash:string}> {
    return (await this.appendBatches(user, { ...input, batches: [input.batch] }))[0]!;
  }
  private async appendBatches(user: Claims, input: any): Promise<{id:string;sequence:number;hash:string}[]> {
    if (input.protocol !== 2 || !Array.isArray(input.batches) || !input.batches.length || input.batches.length > 32) fail("Invalid batch window");
    const batches = await Promise.all(input.batches.map(async (b: any) => {
      if (!b || typeof b.id !== "string" || !/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(b.id)
        || typeof b.hash !== "string" || !/^[a-f0-9]{64}$/.test(b.hash)) fail("Invalid incremental batch");
      const decoded = snapshot({documentId:input.documentId,schema:input.schema,version:"update",checkpoint:b.bytes});
      const hash = hex(await crypto.subtle.digest("SHA-256", decoded.bytes));
      if (hash !== b.hash) fail("Batch hash mismatch");
      return { id: b.id as string, hash, bytes: decoded.bytes };
    }));
    if (new Set(batches.map(b=>b.id)).size !== batches.length || (batches.length > 1 && batches.reduce((sum,b)=>sum+b.bytes.length,0) > 262144)) fail("Oversized or duplicate batch window");
    const results = this.ctx.storage.transactionSync(()=>{
      const room = this.authorize(user);
      if (room.protocol !== 2 || room.id !== input.documentId || room.schema !== input.schema) fail("Document, schema, or protocol mismatch");
      let total = room.bytes;
      return batches.map(b=>{
        const prior = this.ctx.storage.sql.exec<{sequence:number;hash:string}>("SELECT sequence,hash FROM updates WHERE batch_id=?",b.id).toArray()[0];
        if (prior) { if (prior.hash !== b.hash) fail("Batch ID reused for different bytes"); return { id:b.id, hash:b.hash, sequence:prior.sequence }; }
        if (this.ctx.storage.sql.exec("SELECT sequence FROM updates WHERE hash=?",b.hash).toArray().length) fail("Duplicate bytes with a different batch ID");
        total += b.bytes.length;
        if (total > room.limit_bytes || this.head() >= 10000) fail("Room storage limit; changes remain local",429);
        const row = this.ctx.storage.sql.exec<{sequence:number}>("INSERT INTO updates(hash,checkpoint,version,batch_id) VALUES(?,?,?,?) RETURNING sequence",b.hash,b.bytes.buffer,"",b.id).one();
        this.ctx.storage.sql.exec("UPDATE room SET bytes=?",total);
        return {id:b.id,sequence:row.sequence,hash:b.hash};
      });
    });
    await this.ctx.storage.sync();
    for (const ws of this.ctx.getWebSockets()) this.sendNext(ws);
    return results;
  }
  private sendNext(ws: WebSocket) {
    try {
      const a = ws.deserializeAttachment() as Attachment, room = this.authorize(a);
      if (!a.started || a.sent !== a.cursor) return;
      if (room.protocol === 2 && a.batchSize) {
        const rows = this.ctx.storage.sql.exec<{sequence:number;hash:string;checkpoint:ArrayBuffer;batch_id:string}>("SELECT sequence,hash,checkpoint,batch_id FROM updates WHERE sequence>? ORDER BY sequence LIMIT ?",a.cursor,a.batchSize).toArray();
        let size = 0;
        const updates: any[] = [];
        for (const row of rows) {
          if (updates.length && size + row.checkpoint.byteLength > 262144) break;
          size += row.checkpoint.byteLength;
          updates.push({sequence:row.sequence,batch:{id:row.batch_id,hash:row.hash,bytes:btoa(Array.from(new Uint8Array(row.checkpoint),b=>String.fromCharCode(b)).join(""))}});
        }
        if (updates.length) { a.sent = updates.at(-1).sequence; ws.serializeAttachment(a); ws.send(JSON.stringify({type:"updates",documentId:room.id,schema:room.schema,updates})); }
        else ws.send(JSON.stringify({type:"ready",head:this.head(),bootId:this.bootId}));
        return;
      }
      const row = this.ctx.storage.sql.exec<{ sequence: number; hash: string; checkpoint: ArrayBuffer; version: string; batch_id: string | null }>("SELECT * FROM updates WHERE sequence>? ORDER BY sequence LIMIT 1", a.cursor).toArray()[0];
      if (row) {
        a.sent = row.sequence; ws.serializeAttachment(a);
        if (room.protocol === 2) {
          ws.send(JSON.stringify({type:"update",sequence:row.sequence,documentId:room.id,schema:room.schema,
            batch:{id:row.batch_id,hash:row.hash,bytes:btoa(Array.from(new Uint8Array(row.checkpoint),b=>String.fromCharCode(b)).join(""))}}));
          return;
        }
        ws.send(JSON.stringify({ type: "snapshot", sequence: row.sequence, hash: row.hash, snapshot: {
          documentId: room.id, schema: room.schema, version: row.version,
          checkpoint: btoa(Array.from(new Uint8Array(row.checkpoint), b => String.fromCharCode(b)).join("")),
        } }));
      } else ws.send(JSON.stringify({ type: "ready", head: this.head(), bootId: this.bootId }));
    } catch { try { ws.close(1008, "Access unavailable"); } catch {} }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const a = ws.deserializeAttachment() as Attachment; this.authorize(a);
      if (typeof message !== "string") return fail("Invalid frame");
      if (message.length > 1024 * 1024) fail("Invalid frame");
      const input = JSON.parse(message);
      if (input.type === "hello") {
        const room = this.room();
        if ((input.protocol ?? 1) !== room.protocol) fail("Protocol mismatch");
        if (room.protocol === 2 && (input.documentId !== room.id || input.schema !== room.schema || input.after < 1)) fail("Install matching room seed before replay");
        if (!Number.isSafeInteger(input.after) || input.after < 0 || input.after > this.head() || a.started) fail("Invalid replay cursor");
        if (input.batchSize !== undefined) { if (room.protocol !== 2 || !Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 32) fail("Invalid replay window"); a.batchSize = input.batchSize; }
        a.started = true; a.cursor = input.after; a.sent = input.after; ws.serializeAttachment(a); this.sendNext(ws);
      } else if (input.type === "applied") {
        if (!a.started || input.sequence !== a.sent) fail("Noncontiguous acknowledgement");
        a.cursor = input.sequence; ws.serializeAttachment(a); this.sendNext(ws);
      } else if (input.type === "appendMany") {
        if (!a.started) fail("Invalid append");
        const acks = await this.appendBatches(a,input);
        const room = this.authorize(a);
        if (room.drop_ack) { this.ctx.storage.sql.exec("UPDATE room SET drop_ack=0"); await this.ctx.storage.sync(); ws.close(1012,"Injected lost acknowledgement"); return; }
        ws.send(JSON.stringify({type:"acks",acks}));
      } else if (input.type === "append") {
        const roomProtocol = this.room().protocol;
        if (!a.started || (roomProtocol === 1 && !name(input.id))) fail("Invalid append");
        const result = roomProtocol === 2 ? await this.appendBatch(a,input) : {id:input.id,...await this.append(a, input.snapshot)};
        const room = this.authorize(a);
        if (room.drop_ack) {
          this.ctx.storage.sql.exec("UPDATE room SET drop_ack=0"); await this.ctx.storage.sync();
          ws.close(1012, "Injected lost acknowledgement"); return;
        }
        ws.send(JSON.stringify({ type: "ack", ...result }));
      } else fail("Unknown message");
    } catch (e) {
      try { ws.send(JSON.stringify({ type: "error", message: e instanceof HttpError ? e.message : "Invalid message" })); } catch {}
      if (e instanceof HttpError && e.status === 403) ws.close(1008, "Access revoked");
    }
  }
  webSocketClose(ws: WebSocket) { try { ws.close(); } catch {} }
  webSocketError(ws: WebSocket) { try { ws.close(1011, "Socket failed"); } catch {} }
}
