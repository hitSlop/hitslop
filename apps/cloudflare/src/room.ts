import {
  RoomClientMessageSchema,
  RoomSeedInputSchema,
  roomProtocol,
  type RoomSeedInput,
  type RoomSeed,
  type RoomMessage,
} from "@hitslop/schema";
import type { SchemaNode as TSchema } from "@hitslop/schema/document";
import { checkDataSchema } from "@hitslop/schema";
import { validateDocument } from "@hitslop/schema/document";
import { validate } from "@hitslop/schema/validation";
import {
  executeCommand,
  issueLease,
  prepareCommand,
  type AuthorityInput,
} from "@hitslop/schema/document-authority";
import {
  canonical,
  type Snapshot,
  type Request as CommandRequest,
  type Open,
} from "@hitslop/schema/document-protocol";
import { DurableObject } from "cloudflare:workers";
import { fail, HttpError, json } from "./errors.ts";
import { hex, roomClaims, type RoomClaims } from "./crypto.ts";
export type RoomResult<T> = { ok: true; value: T } | { ok: false; status: number; message: string };
type Attachment = RoomClaims & { started: boolean; name: string };
type Room = {
  protocol: number;
  id: string;
  schema: string;
  owner: string;
  invite: string | null;
  artifact_hash: string | null;
};
export type RoomAccess = {
  owner: string;
  members: { id: string; name: string; email: string }[];
  invite: string | null;
  invitationsEnabled: boolean;
};
export class SlopRoom extends DurableObject<{ TOKEN_KEY: string }> {
  private schema?: TSchema;
  constructor(ctx: DurableObjectState, env: { TOKEN_KEY: string }) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS room (id TEXT PRIMARY KEY, schema TEXT NOT NULL, owner TEXT NOT NULL, protocol INTEGER NOT NULL, invite TEXT, artifact_hash TEXT)`,
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', blocked INTEGER NOT NULL DEFAULT 0)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS document_state (id INTEGER PRIMARY KEY CHECK(id=1), schema_json TEXT NOT NULL, snapshot_json TEXT NOT NULL, seed_hash TEXT NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS leases (id TEXT PRIMARY KEY, user TEXT NOT NULL, expires INTEGER NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS receipts (lease TEXT NOT NULL, request TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(lease,request))",
    );
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS lease_expiry ON leases(expires)");
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS undo (id INTEGER PRIMARY KEY CHECK(id=1), lease TEXT NOT NULL, request TEXT NOT NULL, revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL)",
    );
  }
  private room(): Room {
    const room =
      this.ctx.storage.sql.exec<Room>("SELECT * FROM room").toArray()[0] ??
      fail("Room not found", 404);
    if (room.protocol !== roomProtocol) fail("Unsupported room format", 409);
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

  private snapshot(): Snapshot {
    this.room();
    const state = this.ctx.storage.sql
      .exec<{ snapshot_json: string; schema_json: string }>(
        "SELECT snapshot_json,schema_json FROM document_state WHERE id=1",
      )
      .one();
    this.schema ??= JSON.parse(state.schema_json) as TSchema;
    return JSON.parse(state.snapshot_json) as Snapshot;
  }
  /** Fresh initialization requires the schema extracted by the verified immutable-app handler. */
  async initialize(
    user: RoomClaims,
    raw: RoomSeedInput,
    artifactHash: string | null = null,
    application?: TSchema,
  ) {
    return this.result(async () => {
      if (!user.owner || user.exp <= Date.now() / 1000) fail("Owner credential required", 403);
      try {
        validate(RoomSeedInputSchema, raw);
      } catch {
        fail("Invalid room seed");
      }
      if (
        raw.documentId !== user.room ||
        raw.snapshot.documentId !== user.room ||
        raw.snapshot.revision !== 0
      )
        fail("Wrong document seed");
      const hash = hex(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(raw.snapshot))),
      );
      this.ctx.storage.transactionSync(() => {
        const existing = this.ctx.storage.sql.exec<Room>("SELECT * FROM room").toArray()[0];
        if (existing) {
          this.authorize(user, true);
          const state = this.ctx.storage.sql
            .exec<{ seed_hash: string }>("SELECT seed_hash FROM document_state WHERE id=1")
            .one();
          if (
            existing.schema !== raw.snapshot.schemaHash ||
            (artifactHash && existing.artifact_hash !== artifactHash) ||
            state.seed_hash !== hash
          )
            fail("The room seed and app bundle are immutable", 409);
          return;
        }
        if (!application || !artifactHash)
          return fail("Initialize the room with its verified immutable app bundle", 409);
        try {
          checkDataSchema(application as Record<string, unknown>);
          validateDocument(application, raw.snapshot.data);
        } catch {
          return fail("Room seed does not match its application schema");
        }
        this.ctx.storage.sql.exec(
          "INSERT INTO room(id,schema,owner,protocol,invite,artifact_hash) VALUES(?,?,?,?,?,?)",
          user.room,
          raw.snapshot.schemaHash,
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
        this.ctx.storage.sql.exec(
          "INSERT INTO document_state(id,schema_json,snapshot_json,seed_hash) VALUES(1,?,?,?)",
          JSON.stringify(application),
          JSON.stringify(raw.snapshot),
          hash,
        );
        this.schema = application;
      });
      await this.ctx.storage.sync();
      return { roomId: user.room, protocol: roomProtocol } as const;
    });
  }
  async readSeed(user: RoomClaims) {
    return this.result<RoomSeed>(() => {
      this.authorize(user);
      return { protocol: roomProtocol, snapshot: this.snapshot() };
    });
  }
  private opening(user: RoomClaims): Open {
    return this.ctx.storage.transactionSync(() => {
      this.authorize(user);
      const now = Date.now();
      this.ctx.storage.sql.exec(
        "DELETE FROM receipts WHERE lease IN (SELECT id FROM leases WHERE expires<=?)",
        now,
      );
      this.ctx.storage.sql.exec(
        "DELETE FROM undo WHERE lease IN (SELECT id FROM leases WHERE expires<=?)",
        now,
      );
      this.ctx.storage.sql.exec("DELETE FROM leases WHERE expires<=?", now);
      const snapshot = this.snapshot();
      const lease = issueLease(now);
      this.ctx.storage.sql.exec(
        "INSERT INTO leases(id,user,expires) VALUES(?,?,?)",
        lease.id,
        user.user,
        lease.expiresAt,
      );
      return { snapshot, lease };
    });
  }
  private async execute(user: RoomClaims, request: CommandRequest) {
    this.authorize(user);
    const command = await prepareCommand(request);
    request = command.request;
    const outcome = this.ctx.storage.transactionSync(() => {
      this.authorize(user);
      const snapshot = this.snapshot();
      const lease = this.ctx.storage.sql
        .exec<{ id: string; expires: number; user: string }>(
          "SELECT id,expires,user FROM leases WHERE id=?",
          request.leaseId,
        )
        .toArray()[0];
      if (lease && lease.user !== user.user)
        fail("This retry lease belongs to another member", 403);
      const receipt = this.ctx.storage.sql
        .exec<{ digest: string; result: string }>(
          "SELECT digest,result FROM receipts WHERE lease=? AND request=?",
          request.leaseId,
          request.requestId,
        )
        .toArray()[0];
      const state: AuthorityInput = {
        snapshot,
        lease: lease ? { id: lease.id, expiresAt: lease.expires } : undefined,
        receipt: receipt
          ? { digest: receipt.digest, result: JSON.parse(receipt.result) }
          : undefined,
      };
      if ("undo" in request) {
        const undo = this.ctx.storage.sql
          .exec<{ lease: string; request: string; revision: number; snapshot_json: string }>(
            "SELECT lease,request,revision,snapshot_json FROM undo WHERE id=1",
          )
          .toArray()[0];
        if (undo)
          state.undo = {
            leaseId: undo.lease,
            requestId: undo.request,
            revision: undo.revision,
            snapshot: JSON.parse(undo.snapshot_json),
          };
      }
      const evaluated = executeCommand(this.schema!, state, command, Date.now());
      if (evaluated.receipt)
        this.ctx.storage.sql.exec(
          "INSERT INTO receipts(lease,request,digest,result) VALUES(?,?,?,?)",
          request.leaseId,
          request.requestId,
          evaluated.receipt.digest,
          JSON.stringify(evaluated.result),
        );
      if (evaluated.prepared) {
        if ("ops" in request)
          this.ctx.storage.sql.exec(
            "INSERT OR REPLACE INTO undo(id,lease,request,revision,snapshot_json) SELECT 1,?,?,?,snapshot_json FROM document_state WHERE id=1",
            request.leaseId,
            request.requestId,
            evaluated.prepared.snapshot.revision,
          );
        else this.ctx.storage.sql.exec("DELETE FROM undo");
        this.ctx.storage.sql.exec(
          "UPDATE document_state SET snapshot_json=? WHERE id=1",
          evaluated.prepared.json,
        );
      }
      return evaluated;
    });
    await this.ctx.storage.sync();
    if (outcome.prepared) {
      const bytes = `{"type":"snapshot","snapshot":${outcome.prepared.json}}`;
      for (const socket of this.ctx.getWebSockets()) {
        try {
          const attachment = socket.deserializeAttachment() as Attachment;
          this.authorize(attachment);
          if (attachment.started) socket.send(bytes);
        } catch {
          /* closed or revoked */
        }
      }
    }
    return outcome.result;
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
      const user = await roomClaims(request, this.env);
      const path = /^\/rooms\/([a-zA-Z0-9-]{1,80})\/socket$/.exec(new URL(request.url).pathname);
      if (!path || path[1] !== user.room) fail("Wrong room route", 403);
      this.authorize(user);
      if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return json({ error: "Not found" }, 404);
      const pair = new WebSocketPair(),
        client = pair[0],
        server = pair[1];
      this.ctx.acceptWebSocket(server, [user.user]);
      server.serializeAttachment({ ...user, started: false, name: user.name } satisfies Attachment);
      this.send(server, { type: "welcome", protocol: roomProtocol, peers: this.presence() });
      this.broadcastPresence();
      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      return json(
        { error: error instanceof HttpError ? error.message : "Room unavailable" },
        error instanceof HttpError ? error.status : 503,
      );
    }
  }
  private send(ws: WebSocket, message: RoomMessage) {
    ws.send(JSON.stringify(message));
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const user = ws.deserializeAttachment() as Attachment;
      this.authorize(user);
      if (typeof message !== "string" || new TextEncoder().encode(message).length > 2 * 1024 * 1024)
        fail("Invalid frame");
      let input;
      try {
        input = validate(RoomClientMessageSchema, JSON.parse(message as string));
      } catch {
        return fail("Invalid room message");
      }
      if (input.type === "hello") {
        const room = this.room();
        if (user.started || input.documentId !== room.id || input.schema !== room.schema)
          fail("Wrong document or repeated hello");
        const open = this.opening(user);
        await this.ctx.storage.sync();
        user.started = true;
        ws.serializeAttachment(user);
        // Reload after the durability await so a concurrent commit cannot be missed at hello.
        open.snapshot = this.snapshot();
        this.send(ws, { type: "ready", open, peers: this.presence() });
      } else {
        if (!user.started) fail("Send hello before commands");
        const result = await this.execute(user, input.request as CommandRequest);
        this.send(ws, {
          type: "result",
          requestId: input.request.requestId,
          leaseId: input.request.leaseId,
          authority: input.request.authority,
          result,
        });
      }
    } catch (error) {
      try {
        this.send(ws, {
          type: "error",
          status: error instanceof HttpError ? error.status : 503,
          message:
            error instanceof HttpError
              ? error.message
              : "Outcome unknown; reconnect and resolve the original request",
        });
        if (error instanceof HttpError && [401, 403].includes(error.status))
          ws.close(1008, "Access unavailable");
      } catch {
        /* closed */
      }
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
