import { createHash, randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

// Full Loro snapshots are append-only for the first small-document release.
// They merge as CRDT updates; the server never chooses a last-writer JSON value.
export const MAX_CHECKPOINT_BYTES = 512 * 1024;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpsError("invalid-argument", "Expected an object.");
  return value as Record<string, unknown>;
};
function text(value: unknown, limit: number): string {
  if (typeof value !== "string" || !value.length || value.length > limit) throw new HttpsError("invalid-argument", "Invalid sharing parameter.");
  return value;
}
export function snapshot(value: unknown) {
  const input = object(value);
  const documentId = text(input.documentId, 80);
  if (!/^[a-zA-Z0-9-]+$/.test(documentId)) throw new HttpsError("invalid-argument", "Invalid document identity.");
  const schema = text(input.schema, 64);
  if (!/^[a-f0-9]{64}$/.test(schema)) throw new HttpsError("invalid-argument", "Invalid schema fingerprint.");
  const checkpoint = text(input.checkpoint, Math.ceil(MAX_CHECKPOINT_BYTES / 3) * 4);
  const bytes = Buffer.from(checkpoint, "base64");
  if (bytes.length === 0 || bytes.length > MAX_CHECKPOINT_BYTES || bytes.toString("base64") !== checkpoint) throw new HttpsError("invalid-argument", "Invalid or oversized document checkpoint.");
  return { documentId, schema, checkpoint, version: text(input.version, 64 * 1024) };
}
type Member = { name: string; email: string };
type Room = { owner: string; documentId: string; schema: string; title: string; slug: string; template: string;
  members: Record<string, Member>; blocked: string[]; invite: string | null; updates: number; seed: ReturnType<typeof snapshot> };
const denied = () => new HttpsError("permission-denied", "You do not have access to this shared document. Ask its owner for an invitation.");
export class SharingBackend {
  constructor(private readonly db: Firestore) {}
  async perform(uid: string | undefined, profile: Member, value: unknown): Promise<unknown> {
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to collaborate.");
    const input = object(value);
    const action = text(input.action, 20);
    const id = text(input.roomId, 80);
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new HttpsError("invalid-argument", "Invalid room identity.");
    const ref = this.db.collection("syncRooms").doc(id);
    const member = { name: profile.name.slice(0, 120), email: profile.email.slice(0, 254) };
    return this.db.runTransaction(async tx => {
      const stored = await tx.get(ref);
      let room = stored.exists ? stored.data() as Room : undefined;
      if (action === "create" && !room) {
        const seed = snapshot(input.snapshot);
        const template = text(input.template, 64);
        if (seed.documentId !== id || !/^[a-f0-9]{64}$/.test(template)) throw new HttpsError("invalid-argument", "Document or template identity mismatch.");
        room = { owner: uid, documentId: id, schema: seed.schema, title: text(input.title, 200), slug: text(input.slug, 100), template,
          members: { [uid]: member }, blocked: [], invite: randomBytes(32).toString("hex"), updates: 1, seed };
        tx.create(ref, room);
        tx.create(ref.collection("updates").doc(hash(seed.checkpoint)), seed);
        return this.info(id, room, uid);
      }
      if (!room) throw new HttpsError("not-found", "This document is not shared yet.");
      if (action === "join") {
        const token = text(input.invite, 64);
        if (!room.invite || token !== room.invite || room.blocked.includes(uid)) throw denied();
        if (!Object.hasOwn(room.members, uid) && Object.keys(room.members).length >= 20) throw new HttpsError("resource-exhausted", "This document has reached its 20-person limit.");
        room.members[uid] = member;
        tx.update(ref, { members: room.members });
        return this.info(id, room, uid);
      }
      if (!Object.hasOwn(room.members, uid)) throw denied();
      if (action === "info" || action === "create") return this.info(id, room, uid);
      if (action === "append") {
        const update = snapshot(input.snapshot);
        if (update.documentId !== id || update.schema !== room.schema) throw new HttpsError("invalid-argument", "Shared document identity or schema changed.");
        const updateRef = ref.collection("updates").doc(hash(update.checkpoint));
        if ((await tx.get(updateRef)).exists) return { accepted: true };
        if (room.updates >= 10000) throw new HttpsError("resource-exhausted", "This document has reached the current sharing history limit. Local changes remain saved.");
        tx.create(updateRef, update);
        tx.update(ref, { updates: room.updates + 1 });
        return { accepted: true };
      }
      if (room.owner !== uid) throw denied();
      if (action === "invite") {
        if (typeof input.enabled !== "boolean") throw new HttpsError("invalid-argument", "Expected enabled.");
        room.invite = input.enabled ? randomBytes(32).toString("hex") : null;
        tx.update(ref, { invite: room.invite });
      } else if (action === "remove") {
        const target = text(input.uid, 128);
        if (target === uid || !Object.hasOwn(room.members, target)) throw new HttpsError("invalid-argument", "Cannot remove that member.");
        delete room.members[target];
        room.blocked = [...new Set([...room.blocked, target])];
        // Bound the room document even under repeated join/remove churn.
        if (room.blocked.length > 100) throw new HttpsError("resource-exhausted", "This room has reached its member-management limit.");
        tx.update(ref, { members: room.members, blocked: room.blocked });
      } else throw new HttpsError("invalid-argument", "Unknown sharing action.");
      return this.info(id, room, uid);
    });
  }
  private info(roomId: string, room: Room, uid: string) {
    return { roomId, owner: room.owner, title: room.title, slug: room.slug, template: room.template,
      members: Object.entries(room.members).map(([id, member]) => ({ id, ...member })),
      invite: room.owner === uid ? room.invite : null, invitationsEnabled: room.invite !== null, seed: room.seed };
  }
}
