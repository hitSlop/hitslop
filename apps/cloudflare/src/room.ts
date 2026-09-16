import {
  RoomClientMessageSchema,
  roomProtocol,
  type RoomSeedInput,
  type RoomSeed,
  type RoomMessage,
  type RoomClientMessage,
} from "@hitslop/schema";
import { validate } from "@hitslop/schema/validation";
import { DurableObject } from "cloudflare:workers";
import { fail, HttpError, json } from "./errors.ts";
import { hex, verifyRoomToken, type RoomClaims } from "./crypto.ts";

export type RoomResult<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

type Attachment = RoomClaims & {
  cursor: number;
  sent: number;
  started: boolean;
  batchSize?: number;
  name: string;
};
type Room = {
  protocol: number;
  id: string;
  schema: string;
  owner: string;
  bytes: number;
  limit_bytes: number;
  invite: string | null;
  artifact_hash: string | null;
};
export type RoomAccess = {
  owner: string;
  members: { id: string; name: string; email: string }[];
  invite: string | null;
  invitationsEnabled: boolean;
};
const LIMIT = 64 * 1024 * 1024;
const MAX_SNAPSHOT = 512 * 1024;
const name = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value);
const unbase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

function snapshot(value: unknown): {
  schema: string;
  documentId: string;
  version: string;
  bytes: Uint8Array;
} {
  const input = value as {
    documentId?: string;
    schema?: string;
    checkpoint?: string;
    version?: string;
  };
  if (
    !input ||
    !name(input.documentId) ||
    typeof input.schema !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.schema) ||
    typeof input.version !== "string" ||
    !input.version.length ||
    input.version.length > 65536 ||
    typeof input.checkpoint !== "string" ||
    input.checkpoint.length > Math.ceil(MAX_SNAPSHOT / 3) * 4
  )
    return fail("Invalid snapshot");
  let bytes: Uint8Array;
  try {
    bytes = unbase64(input.checkpoint);
  } catch {
    return fail("Invalid snapshot encoding");
  }
  if (!bytes.length || bytes.length > MAX_SNAPSHOT) return fail("Invalid snapshot size");
  const canonical = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
  if (canonical !== input.checkpoint) return fail("Invalid snapshot encoding");
  return { documentId: input.documentId, schema: input.schema, version: input.version, bytes };
}

async function claims(request: Request, env: { TOKEN_KEY: string }): Promise<RoomClaims> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  try {
    return await verifyRoomToken(env.TOKEN_KEY, token);
  } catch {
    return fail("Unauthorized", 401);
  }
}

export class SlopRoom extends DurableObject<{ TOKEN_KEY: string }> {
  private readonly bootId = crypto.randomUUID();
  constructor(ctx: DurableObjectState, env: { TOKEN_KEY: string }) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS room (id TEXT PRIMARY KEY, schema TEXT NOT NULL, owner TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0, limit_bytes INTEGER NOT NULL DEFAULT ${LIMIT}, protocol INTEGER NOT NULL DEFAULT ${roomProtocol}, invite TEXT, artifact_hash TEXT)`,
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', blocked INTEGER NOT NULL DEFAULT 0)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS updates (sequence INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL UNIQUE, checkpoint BLOB NOT NULL, version TEXT NOT NULL, batch_id TEXT)",
    );
    ctx.storage.sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS batch_identity ON updates(batch_id)");
  }
  private room(): Room {
    const room =
      this.ctx.storage.sql.exec<Room>("SELECT * FROM room").toArray()[0] ??
      fail("Room not found", 404);
    if (room.protocol !== roomProtocol) fail("Unsupported room format; create a new v1 room", 409);
    return room;
  }
  private authorize(user: RoomClaims, owner = false): Room {
    const room = this.room();
    if (user.exp <= Date.now() / 1000) fail("Room credential expired", 401);
    if (user.room !== room.id) fail("Wrong room", 403);
    if (
      !this.ctx.storage.sql
        .exec("SELECT id FROM members WHERE id = ? AND blocked=0", user.user)
        .toArray().length ||
      (owner && user.user !== room.owner)
    )
      fail("Access revoked", 403);
    return room;
  }
  private head() {
    return this.ctx.storage.sql
      .exec<{ n: number }>("SELECT COALESCE(MAX(sequence),0) AS n FROM updates")
      .one().n;
  }
  private presence() {
    const seen = new Map<string, { id: string; name: string }>();
    const members = new Set(
      this.ctx.storage.sql
        .exec<{ id: string }>("SELECT id FROM members WHERE blocked=0")
        .toArray()
        .map((member) => member.id),
    );
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() as Attachment;
        if (socket.readyState !== WebSocket.OPEN || !members.has(attachment.user)) continue;
        seen.set(attachment.user, {
          id: attachment.user,
          name: attachment.name || attachment.user,
        });
      } catch {
        /* closed */
      }
    }
    return [...seen.values()];
  }
  private broadcastPresence() {
    const peers = this.presence();
    const payload = JSON.stringify({ type: "presence", peers } satisfies RoomMessage);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        /* closed */
      }
    }
  }
  private access(uid: string): RoomAccess {
    const room = this.room();
    if (
      !this.ctx.storage.sql.exec("SELECT id FROM members WHERE id=? AND blocked=0", uid).toArray()
        .length
    )
      fail("Access revoked", 403);
    return {
      owner: room.owner,
      invite: uid === room.owner ? room.invite : null,
      invitationsEnabled: room.invite !== null,
      members: this.ctx.storage.sql
        .exec<{ id: string; name: string; email: string }>(
          "SELECT id,name,email FROM members WHERE blocked=0 ORDER BY id",
        )
        .toArray(),
    };
  }
  /** Only authenticated Worker handlers call these RPC methods. The room is the sole ACL authority. */
  async membership(uid: string) {
    return this.result(() => this.access(uid));
  }
  async joinMember(uid: string, name: string, email: string, invite: string) {
    return this.result(() =>
      this.ctx.storage.transactionSync(() => {
        const room = this.room();
        if (!room.invite || room.invite !== invite) fail("Invitation is unavailable", 403);
        const prior = this.ctx.storage.sql
          .exec<{ blocked: number }>("SELECT blocked FROM members WHERE id=?", uid)
          .toArray()[0];
        if (prior?.blocked) fail("Access revoked", 403);
        if (!prior) {
          const count = this.ctx.storage.sql
            .exec<{ n: number }>("SELECT COUNT(*) AS n FROM members WHERE blocked=0")
            .one().n;
          if (count >= 20) fail("This document has reached its 20-person limit", 429);
          this.ctx.storage.sql.exec(
            "INSERT INTO members(id,name,email) VALUES(?,?,?)",
            uid,
            name,
            email,
          );
        }
        return this.access(uid);
      }),
    );
  }
  async updateInvitation(uid: string, enabled: boolean) {
    return this.result(() => {
      if (this.room().owner !== uid) fail("Only the owner can change invitations", 403);
      const invite = enabled ? hex(crypto.getRandomValues(new Uint8Array(32))) : null;
      this.ctx.storage.sql.exec("UPDATE room SET invite=?", invite);
      return this.access(uid);
    });
  }
  async removeMember(uid: string, member: string) {
    return this.result(() => {
      if (this.room().owner !== uid || member === uid)
        fail("Only the owner can remove other members", 403);
      this.ctx.storage.sql.exec("UPDATE members SET blocked=1 WHERE id=?", member);
      for (const ws of this.ctx.getWebSockets(member)) {
        try {
          this.send(ws, { type: "error", status: 403, message: "Access revoked" });
          ws.close(1008, "Access revoked");
        } catch {
          /* closed */
        }
      }
      this.broadcastPresence();
      return this.access(uid);
    });
  }
  async initialize(user: RoomClaims, raw: RoomSeedInput, artifactHash: string | null = null) {
    return this.result(async () => {
      if (!user.owner) fail("Owner credential required", 403);
      if (raw.protocol !== roomProtocol) fail("Protocol mismatch");
      const input = snapshot(raw);
      const hash = hex(await crypto.subtle.digest("SHA-256", input.bytes));
      if (input.documentId !== user.room) fail("Wrong document");
      this.ctx.storage.transactionSync(() => {
        const existing = this.ctx.storage.sql.exec<Room>("SELECT * FROM room").toArray()[0];
        if (existing) {
          this.authorize(user, true);
          if (
            existing.schema !== input.schema ||
            (artifactHash && existing.artifact_hash !== artifactHash)
          )
            fail("Schema or app bundle mismatch", 409);
        } else {
          this.ctx.storage.sql.exec(
            "INSERT INTO room(id,schema,owner,protocol,invite,artifact_hash) VALUES(?,?,?,?,?,?)",
            user.room,
            input.schema,
            user.user,
            roomProtocol,
            hex(crypto.getRandomValues(new Uint8Array(32))),
            artifactHash,
          );
          this.ctx.storage.sql.exec(
            "INSERT INTO members(id,name,email) VALUES(?,?,?)",
            user.user,
            user.name,
            user.email,
          );
        }
        if (this.head() > 0) {
          const seed = this.ctx.storage.sql
            .exec<{ hash: string; version: string }>(
              "SELECT hash,version FROM updates WHERE sequence=1",
            )
            .one();
          if (seed.hash !== hash || seed.version !== input.version)
            fail("Room seed is immutable", 409);
          return;
        }
        this.ctx.storage.sql.exec(
          "INSERT INTO updates(hash,checkpoint,version) VALUES(?,?,?)",
          hash,
          input.bytes.buffer,
          input.version,
        );
        this.ctx.storage.sql.exec("UPDATE room SET bytes=?", input.bytes.length);
      });
      await this.ctx.storage.sync();
      return { roomId: user.room, protocol: roomProtocol };
    });
  }
  async readSeed(user: RoomClaims) {
    return this.result<RoomSeed>(() => {
      const room = this.authorize(user);
      const seed = this.ctx.storage.sql
        .exec<{ hash: string; checkpoint: ArrayBuffer; version: string }>(
          "SELECT hash,checkpoint,version FROM updates WHERE sequence=1",
        )
        .one();
      return {
        protocol: roomProtocol,
        sequence: 1,
        hash: seed.hash,
        snapshot: {
          documentId: room.id,
          schema: room.schema,
          version: seed.version,
          checkpoint: btoa(
            Array.from(new Uint8Array(seed.checkpoint), (b) => String.fromCharCode(b)).join(""),
          ),
        },
      };
    });
  }
  // Expected failures cross RPC as data; custom Error properties do not survive RPC.
  private async result<T>(action: () => T | Promise<T>): Promise<RoomResult<T>> {
    try {
      return { ok: true, value: await action() };
    } catch (error) {
      if (error instanceof HttpError)
        return { ok: false, status: error.status, message: error.message };
      throw error;
    }
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const user = await claims(request, this.env);
      const url = new URL(request.url);
      const path = /^\/rooms\/([a-zA-Z0-9-]{1,80})(.*)$/.exec(url.pathname);
      if (!path || path[1] !== user.room) fail("Wrong room route", 403);
      const route = path?.[2] || "";
      this.authorize(user);
      if (
        route === "/socket" &&
        request.method === "GET" &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        this.ctx.acceptWebSocket(server, [user.user]);
        server.serializeAttachment({
          ...user,
          cursor: 0,
          sent: 0,
          started: false,
          name: user.name,
        } satisfies Attachment);
        this.send(server, {
          type: "welcome",
          protocol: roomProtocol,
          bootId: this.bootId,
          peers: this.presence(),
        });
        this.broadcastPresence();
        return new Response(null, { status: 101, webSocket: client });
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      if (!request.bodyUsed) {
        try {
          await request.body?.cancel();
        } catch {
          /* Request already closed. */
        }
      }
      if (!(error instanceof HttpError)) console.error("Room request failed", error);
      return json(
        { error: error instanceof HttpError ? error.message : "Request failed" },
        error instanceof HttpError ? error.status : 500,
      );
    }
  }
  private send(ws: WebSocket, message: RoomMessage) {
    ws.send(JSON.stringify(message));
  }
  private async appendBatch(
    user: RoomClaims,
    input: Extract<RoomClientMessage, { type: "append" }>,
  ) {
    const batch = input.batch;
    const decoded = snapshot({
      documentId: input.documentId,
      schema: input.schema,
      version: "update",
      checkpoint: batch.bytes,
    });
    const hash = hex(await crypto.subtle.digest("SHA-256", decoded.bytes));
    if (hash !== batch.hash) fail("Batch hash mismatch");
    const ack = this.ctx.storage.transactionSync(() => {
      const room = this.authorize(user);
      if (
        room.protocol !== roomProtocol ||
        room.id !== input.documentId ||
        room.schema !== input.schema
      )
        fail("Document, schema, or protocol mismatch");
      const prior = this.ctx.storage.sql
        .exec<{ sequence: number; hash: string }>(
          "SELECT sequence,hash FROM updates WHERE batch_id=?",
          batch.id,
        )
        .toArray()[0];
      if (prior) {
        if (prior.hash !== batch.hash) fail("Batch ID reused for different bytes");
        return { id: batch.id, hash, sequence: prior.sequence };
      }
      if (
        this.ctx.storage.sql.exec("SELECT sequence FROM updates WHERE hash=?", hash).toArray()
          .length
      )
        fail("Duplicate bytes with a different batch ID");
      const total = room.bytes + decoded.bytes.length;
      if (total > room.limit_bytes || this.head() >= 10000)
        fail("Room storage limit; changes remain local", 429);
      const row = this.ctx.storage.sql
        .exec<{ sequence: number }>(
          "INSERT INTO updates(hash,checkpoint,version,batch_id) VALUES(?,?,?,?) RETURNING sequence",
          hash,
          decoded.bytes.buffer,
          "",
          batch.id,
        )
        .one();
      this.ctx.storage.sql.exec("UPDATE room SET bytes=?", total);
      return { id: batch.id, sequence: row.sequence, hash };
    });
    await this.ctx.storage.sync();
    for (const socket of this.ctx.getWebSockets()) this.sendNext(socket);
    return ack;
  }
  private sendNext(ws: WebSocket) {
    try {
      const attachment = ws.deserializeAttachment() as Attachment;
      const room = this.authorize(attachment);
      if (!attachment.started || attachment.sent !== attachment.cursor) return;
      const limit = attachment.batchSize ?? 1;
      const rows = this.ctx.storage.sql
        .exec<{ sequence: number; hash: string; checkpoint: ArrayBuffer; batch_id: string }>(
          "SELECT sequence,hash,checkpoint,batch_id FROM updates WHERE sequence>? ORDER BY sequence LIMIT ?",
          attachment.cursor,
          limit,
        )
        .toArray();
      let size = 0;
      const updates: { sequence: number; batch: { id: string; hash: string; bytes: string } }[] =
        [];
      for (const row of rows) {
        if (row.sequence === 1) continue;
        if (updates.length && size + row.checkpoint.byteLength > 262144) break;
        size += row.checkpoint.byteLength;
        updates.push({
          sequence: row.sequence,
          batch: {
            id: row.batch_id,
            hash: row.hash,
            bytes: btoa(
              Array.from(new Uint8Array(row.checkpoint), (b) => String.fromCharCode(b)).join(""),
            ),
          },
        });
      }
      if (updates.length) {
        attachment.sent = updates.at(-1)!.sequence;
        ws.serializeAttachment(attachment);
        this.send(ws, { type: "updates", documentId: room.id, schema: room.schema, updates });
      } else {
        this.send(ws, {
          type: "ready",
          head: this.head(),
          bootId: this.bootId,
          peers: this.presence(),
        });
      }
    } catch {
      try {
        ws.close(1008, "Access unavailable");
      } catch {
        /* closed */
      }
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const attachment = ws.deserializeAttachment() as Attachment;
      this.authorize(attachment);
      if (typeof message !== "string") return fail("Invalid frame");
      if (message.length > 1024 * 1024) return fail("Invalid frame");
      const input = (() => {
        try {
          return validate(RoomClientMessageSchema, JSON.parse(message));
        } catch {
          return fail("Invalid room message");
        }
      })();
      if (input.type === "hello") {
        const room = this.room();
        if (input.protocol !== roomProtocol) fail("Protocol mismatch");
        if (input.documentId !== room.id || input.schema !== room.schema) {
          fail("Install matching room seed before replay");
        }
        if (input.after > this.head() || attachment.started) fail("Invalid replay cursor");
        attachment.started = true;
        attachment.cursor = input.after;
        attachment.sent = attachment.cursor;
        if (input.batchSize !== undefined) attachment.batchSize = input.batchSize;
        ws.serializeAttachment(attachment);
        this.sendNext(ws);
        this.broadcastPresence();
      } else if (input.type === "applied") {
        if (!attachment.started || input.sequence !== attachment.sent)
          fail("Noncontiguous acknowledgement");
        attachment.cursor = input.sequence;
        ws.serializeAttachment(attachment);
        this.sendNext(ws);
      } else if (input.type === "append") {
        if (!attachment.started) fail("Send hello before appending");
        const ack = await this.appendBatch(attachment, input);
        this.send(ws, { type: "ack", ...ack });
      } else fail("Unknown message");
    } catch (error) {
      try {
        this.send(ws, {
          type: "error",
          status: error instanceof HttpError ? error.status : 400,
          message: error instanceof HttpError ? error.message : "Invalid message",
        });
      } catch {
        /* closed */
      }
      if (error instanceof HttpError && error.status === 403) ws.close(1008, "Access revoked");
    }
  }
  webSocketClose() {
    this.broadcastPresence();
  }
  webSocketError(ws: WebSocket) {
    try {
      ws.close(1011, "Socket failed");
    } catch {
      /* closed */
    }
  }
}
