import type { SchemaNode as TSchema } from "@hitslop/schema/document";
import { SnapshotSchema } from "@hitslop/schema/document-protocol";
import { validate } from "@hitslop/schema/validation";
import type { APIInputs } from "@hitslop/api";
import { parseManifest, roomProtocol } from "@hitslop/schema";
import { applicationSchema, isDocumentSchema } from "@hitslop/schema/document";
import { unzipSync } from "fflate";
import { hex } from "./crypto.ts";
import { fail, HttpError } from "./errors.ts";
import type { Identity } from "./auth.ts";
import type { Registry, SharedDocument } from "./store.ts";
import type { RoomAccess } from "./room.ts";
import { inspectZip, validateSkin } from "./publish-validation.ts";
import { validatePackageMetadata } from "./publish-package.ts";

import { room, unwrap, type Rooms } from "./room-rpc.ts";
export function documentInfo(document: SharedDocument, access: RoomAccess) {
  return {
    documentId: document.id,
    owner: document.owner,
    title: document.title,
    slug: document.slug,
    schema: document.schemaHash,
    packageSha256: document.packageSha256,
    packageBytes: document.packageBytes,
    members: access.members,
    invite: access.invite,
    invitationsEnabled: access.invitationsEnabled,
  };
}

export async function handleCreateDocument(
  input: APIInputs["documents"]["create"],
  registry: Registry,
  identity: Identity,
  rooms: Rooms,
) {
  const { title, slug, schema: schemaHash, documentId, package: file } = input;
  if (!file.size || file.size > 25 * 1024 * 1024) fail("Shared package exceeds 25 MiB", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let schemaBytes: Uint8Array = new Uint8Array();
  let application: TSchema;
  try {
    inspectZip(bytes);
    const files = unzipSync(bytes);
    // Shared apps contain immutable code and initial assets, never the owner's local document state.
    if (
      Object.keys(files).some(
        (path) =>
          path.startsWith("stores/") ||
          path.startsWith("state/") ||
          path === "QuickLook/Preview.png",
      )
    )
      fail("Shared app contains private document files");
    validatePackageMetadata(files);
    if (
      !files["manifest.json"] ||
      files["manifest.json"].length > 65536 ||
      !files["app.html"] ||
      !files["data.schema.json"]
    )
      fail("Invalid shared app");
    const manifest = parseManifest(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(files["manifest.json"])),
    );
    if (manifest.slug !== slug) fail("Shared app slug mismatch");
    validateSkin(files, manifest);
    schemaBytes = files["data.schema.json"]!;
    const schema = (application = applicationSchema(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(files["data.schema.json"])),
    ));
    if (!isDocumentSchema(schema)) fail("Shared app requires a document schema");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid shared app");
  }
  if (hex(await crypto.subtle.digest("SHA-256", Uint8Array.from(schemaBytes))) !== schemaHash)
    fail("Shared app schema mismatch");
  const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
  const existing = await registry.getDocument(documentId);
  if (
    existing &&
    (existing.owner !== identity.uid ||
      existing.packageSha256 !== sha256 ||
      existing.schemaHash !== schemaHash)
  )
    fail("Document identity already exists", 409);
  const packageKey = `documents/${documentId}/${sha256}.slop.zip`;
  if (!existing) await registry.putObject(packageKey, bytes, "application/zip");
  const stub = room(rooms, documentId);
  // R2 and D1 are not a distributed transaction. Immutable inputs make every step resumable.
  unwrap(
    await stub.initialize(
      {
        room: documentId,
        user: identity.uid,
        name: identity.name,
        email: identity.email,
        owner: true,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      {
        protocol: roomProtocol,
        documentId,
        snapshot: (() => {
          try {
            const snapshot = validate(SnapshotSchema, JSON.parse(input.seed));
            if (snapshot.documentId !== documentId || snapshot.schemaHash !== schemaHash)
              fail("Seed identity mismatch");
            return snapshot;
          } catch {
            return fail("Invalid document seed");
          }
        })(),
      },
      sha256,
      application!,
    ),
  );
  let document: SharedDocument = existing ?? {
    id: documentId,
    owner: identity.uid,
    title,
    slug,
    schemaHash,
    packageKey,
    packageSha256: sha256,
    packageBytes: bytes.length,
    createdAt: new Date().toISOString(),
  };
  if (!existing) {
    try {
      await registry.putDocument(document);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 409) throw error;
      const winner = await registry.getDocument(documentId);
      if (!winner || winner.owner !== identity.uid || winner.packageSha256 !== sha256) throw error;
      document = winner;
    }
  }
  return documentInfo(document, unwrap(await stub.membership(identity.uid)));
}
export async function loadMemberDocument(
  registry: Registry,
  identity: Identity,
  id: string,
  rooms: Rooms,
): Promise<SharedDocument> {
  const document = await registry.getDocument(id);
  if (!document) return fail("This document is not shared yet.", 404);
  unwrap(await room(rooms, id).membership(identity.uid));
  return document;
}
export async function handleGetDocument(
  registry: Registry,
  identity: Identity,
  id: string,
  rooms: Rooms,
) {
  const document = await registry.getDocument(id);
  if (!document) return fail("This document is not shared yet.", 404);
  return documentInfo(document, unwrap(await room(rooms, id).membership(identity.uid)));
}
export async function handleJoinDocument(
  body: APIInputs["documents"]["join"],
  registry: Registry,
  identity: Identity,
  id: string,
  rooms: Rooms,
) {
  const document = await registry.getDocument(id);
  if (!document) return fail("This document is not shared yet.", 404);
  return documentInfo(
    document,
    unwrap(
      await room(rooms, id).joinMember(identity.uid, identity.name, identity.email, body.invite),
    ),
  );
}
export async function handleDocumentPackage(
  registry: Registry,
  identity: Identity,
  id: string,
  rooms: Rooms,
) {
  const document = await loadMemberDocument(registry, identity, id, rooms);
  const object = await registry.getObject(document.packageKey);
  if (!object) return fail("Shared package is missing", 404);
  return new File([Uint8Array.from(object.bytes)], `${document.slug}.slop.zip`, {
    type: "application/zip",
  });
}
export async function handleInvite(
  body: APIInputs["documents"]["invite"],
  registry: Registry,
  identity: Identity,
  id: string,
  rooms: Rooms,
) {
  const document = (await registry.getDocument(id)) ?? fail("Document not found", 404);
  return documentInfo(
    document,
    unwrap(await room(rooms, id).updateInvitation(identity.uid, body.enabled)),
  );
}
export async function handleRemoveMember(
  body: APIInputs["documents"]["removeMember"],
  registry: Registry,
  identity: Identity,
  rooms: Rooms,
) {
  const document = (await registry.getDocument(body.documentId)) ?? fail("Document not found", 404);
  return documentInfo(
    document,
    unwrap(await room(rooms, body.documentId).removeMember(identity.uid, body.memberId)),
  );
}
