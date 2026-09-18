import type { TSchema } from "typebox";
import { prepareDocument, type DocumentTrace } from "@hitslop/schema/document";
import { applyOps } from "./document-ops.js";
import {
  fail,
  failure,
  type Identity,
  type JSONValue,
  type Lease,
  type Request,
  type Result,
  type Snapshot,
} from "@hitslop/schema/document-protocol";

export type Receipt = { digest: string; result: Result };
export type PreparedCommand = { request: Request; digest: string };
export type PreparedSnapshot = { snapshot: Snapshot; json: string; dataJSON: string };
export type UndoSlot = { leaseId: string; requestId: string; revision: number; snapshot: Snapshot };
export type AuthorityInput = {
  snapshot: Snapshot;
  writable?: boolean;
  lease?: Lease | undefined;
  receipt?: Receipt | undefined;
  undo?: UndoSlot | undefined;
};
export type Evaluation = { result: Result; receipt?: Receipt; prepared?: PreparedSnapshot };

/** Only prepared document JSON may be embedded; headers are encoded separately. */
export function prepareSnapshot(
  identity: Identity,
  revision: number,
  data: ReturnType<typeof prepareDocument>,
): PreparedSnapshot {
  const header = JSON.stringify({
    documentId: identity.documentId,
    schemaHash: identity.schemaHash,
    authority: identity.authority,
    revision,
  });
  return {
    dataJSON: data.json,
    snapshot: { ...identity, revision, data: data.data as JSONValue },
    json: `${header.slice(0, -1)},"data":${data.json}}`,
  };
}

/** Pure evaluation against committed state. Adapters commit the delta before publishing. */
export function executeCommand(
  schema: TSchema,
  state: AuthorityInput,
  command: PreparedCommand,
  now: number,
  trace?: DocumentTrace,
): Evaluation {
  const { request, digest } = command,
    { snapshot, lease, receipt } = state;
  const reject = (code: Parameters<typeof fail>[0], message: string): Evaluation => ({
    result: { ok: false, error: { code, message } },
  });
  if (
    request.documentId !== snapshot.documentId ||
    request.schemaHash !== snapshot.schemaHash ||
    request.authority !== snapshot.authority
  )
    return reject("authority_changed", "Reopen the current document authority");
  // Expiry precedes lookup: a forgotten receipt cannot turn a retry into a new execution.
  if (!lease || lease.id !== request.leaseId || lease.expiresAt <= now)
    return reject("lease_expired", "This retry lease has expired; this attempt cannot execute");
  if (receipt)
    return receipt.digest === digest
      ? { result: receipt.result }
      : reject("request_reused", "Request ID reused with different content");
  if (state.writable === false)
    return reject("offline", "This document is owned by its shared authority");
  let prepared: PreparedSnapshot | undefined, result: Result;
  try {
    if (snapshot.revision >= Number.MAX_SAFE_INTEGER)
      fail("invalid_operation", "Document revision limit reached");
    let document: ReturnType<typeof prepareDocument>;
    if ("undo" in request) {
      const undo = state.undo;
      if (
        request.undo.revision !== snapshot.revision ||
        !undo ||
        undo.revision !== snapshot.revision
      )
        fail("stale_revision", "Undo unavailable after another change.");
      if (undo.leaseId !== request.leaseId || undo.requestId !== request.undo.requestId)
        fail("rejected", "Undo belongs to another command or session");
      if (
        undo.snapshot.documentId !== snapshot.documentId ||
        undo.snapshot.schemaHash !== snapshot.schemaHash ||
        undo.snapshot.authority !== snapshot.authority
      )
        fail("authority_changed", "Undo belongs to another authority");
      document = prepareDocument(schema, undo.snapshot.data, trace);
    } else if ("replace" in request) {
      if (request.replace.baseRevision !== snapshot.revision)
        fail(
          "stale_revision",
          "Preserve this proposal: the document changed since its base revision",
        );
      document = prepareDocument(schema, request.replace.data, trace);
    } else document = applyOps(schema, snapshot.data, request.ops, trace);
    prepared = prepareSnapshot(snapshot, snapshot.revision + 1, document);
    result = { ok: true, revision: prepared.snapshot.revision };
  } catch (error) {
    result = failure(error);
  }
  return { result, receipt: { digest, result }, ...(prepared ? { prepared } : {}) };
}

export { applyOps } from "./document-ops.js";
