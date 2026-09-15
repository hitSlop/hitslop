import { expect, test } from "bun:test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SharingBackend, snapshot, MAX_CHECKPOINT_BYTES } from "../src/sharing";

const seed = { documentId: "test-room", schema: "a".repeat(64), checkpoint: Buffer.from("opaque-loro-bytes").toString("base64"), version: "[]" };
const profile = { name: "Test", email: "test@example.com" };
test("sharing rejects malformed/oversized snapshots and unauthenticated requests", async () => {
  expect(snapshot(seed)).toEqual(seed);
  expect(() => snapshot({ ...seed, checkpoint: "not base64" })).toThrow();
  expect(() => snapshot({ ...seed, checkpoint: Buffer.alloc(MAX_CHECKPOINT_BYTES + 1).toString("base64") })).toThrow();
  expect(() => snapshot({ ...seed, documentId: "../escape" })).toThrow();
  const backend = new SharingBackend({} as never);
  await expect(backend.perform(undefined, profile, {})).rejects.toThrow("Sign in");
});

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
(emulator ? test : test.skip)("room invitations, duplicate append, membership revocation and authorization", async () => {
  const app = initializeApp({ projectId: "hitslopapp" }, `sharing-${crypto.randomUUID()}`);
  const db = getFirestore(app), backend = new SharingBackend(db);
  const roomId = crypto.randomUUID();
  const input = { action: "create", roomId, snapshot: { ...seed, documentId: roomId }, title: "List", slug: "quick-checklist", template: "b".repeat(64) };
  try {
    const created = await backend.perform("owner", profile, input) as { invite: string };
    expect(created.invite).toHaveLength(64);
    await expect(backend.perform("stranger", profile, { action: "info", roomId })).rejects.toThrow("access");
    await expect(backend.perform("stranger", profile, input)).rejects.toThrow("access");
    await expect(backend.perform("editor", profile, { action: "join", roomId, invite: "wrong" })).rejects.toThrow("access");
    const joined = await backend.perform("editor", profile, { action: "join", roomId, invite: created.invite }) as { invite: string | null };
    expect(joined.invite).toBeNull();
    await backend.perform("editor", profile, { action: "append", roomId, snapshot: input.snapshot });
    await backend.perform("editor", profile, { action: "append", roomId, snapshot: input.snapshot });
    expect((await db.doc(`syncRooms/${roomId}`).get()).get("updates")).toBe(1);
    await expect(backend.perform("editor", profile, { action: "invite", roomId, enabled: false })).rejects.toThrow("access");
    await expect(backend.perform("editor", profile, { action: "append", roomId, snapshot: { ...input.snapshot, schema: "f".repeat(64) } })).rejects.toThrow("changed");
    await backend.perform("owner", profile, { action: "remove", roomId, uid: "editor" });
    await expect(backend.perform("editor", profile, { action: "info", roomId })).rejects.toThrow("access");
    await expect(backend.perform("editor", profile, { action: "append", roomId, snapshot: input.snapshot })).rejects.toThrow("access");
    await expect(backend.perform("editor", profile, { action: "join", roomId, invite: created.invite })).rejects.toThrow("access");
    await backend.perform("owner", profile, { action: "invite", roomId, enabled: false });
    await expect(backend.perform("third", profile, { action: "join", roomId, invite: created.invite })).rejects.toThrow("access");
  } finally { await db.recursiveDelete(db.doc(`syncRooms/${roomId}`)); await deleteApp(app); }
});
