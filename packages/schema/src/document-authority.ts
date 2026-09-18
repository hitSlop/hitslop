import type { TSchema } from "typebox";
import { prepareDocument } from "./document.js";
import { assertJSON } from "./json.js";
import { applyOps } from "./document-ops.js";
import {
  canonical,
  fail,
  failure,
  freeze,
  RequestSchema,
  RETRY_WINDOW_MS,
  validate,
  type Identity,
  type JSONValue,
  type Lease,
  type Open,
  type Request,
  type Result,
  type Snapshot,
} from "./document-protocol.js";

export type Receipt = { digest: string; result: Result };
export type PreparedCommand = { request: Request; digest: string };
export type PreparedSnapshot = { snapshot: Snapshot; json: string };
export type UndoSlot = { leaseId: string; requestId: string; revision: number; snapshot: Snapshot };
export type AuthorityInput = {
  snapshot: Snapshot;
  lease?: Lease | undefined;
  receipt?: Receipt | undefined;
  undo?: UndoSlot | undefined;
};
export type Evaluation = { result: Result; receipt?: Receipt; prepared?: PreparedSnapshot };

/** Own the request before awaiting crypto. Infrastructure failures are never receipts. */
export async function prepareCommand(input: unknown): Promise<PreparedCommand> {
  try {
    assertJSON(input, new Set(), 72);
    validate(RequestSchema, input);
  } catch (error) {
    fail("invalid_request", String(error));
  }
  const request = structuredClone(input) as Request;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(request)));
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { request, digest };
}

export function issueLease(now: number): Lease {
  return { id: crypto.randomUUID(), expiresAt: now + RETRY_WINDOW_MS };
}

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
      document = prepareDocument(schema, undo.snapshot.data);
    } else if ("replace" in request) {
      if (request.replace.baseRevision !== snapshot.revision)
        fail(
          "stale_revision",
          "Preserve this proposal: the document changed since its base revision",
        );
      document = prepareDocument(schema, request.replace.data);
    } else document = applyOps(schema, snapshot.data, request.ops);
    prepared = prepareSnapshot(snapshot, snapshot.revision + 1, document);
    result = { ok: true, revision: prepared.snapshot.revision };
  } catch (error) {
    result = failure(error);
  }
  return { result, receipt: { digest, result }, ...(prepared ? { prepared } : {}) };
}

/** Disposable preview; receipt history is private and never copied or recursively frozen. */
export class MemoryAuthority {
  private snapshot: Snapshot;
  private undo: UndoSlot | undefined;
  private leases = new Map<string, Lease>();
  private receipts = new Map<string, Map<string, Receipt>>();
  private listeners = new Set<(snapshot: Snapshot) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    readonly schema: TSchema,
    initial: JSONValue,
    identity: Identity = {
      documentId: crypto.randomUUID(),
      schemaHash: "preview",
      authority: crypto.randomUUID(),
    },
  ) {
    this.snapshot = freeze(
      prepareSnapshot(identity, 0, prepareDocument(schema, structuredClone(initial))).snapshot,
    );
  }
  open(): Open {
    const now = Date.now();
    for (const [id, lease] of this.leases)
      if (lease.expiresAt <= now) {
        this.leases.delete(id);
        this.receipts.delete(id);
        if (this.undo?.leaseId === id) this.undo = undefined;
      }
    const lease = freeze(issueLease(now));
    this.leases.set(lease.id, lease);
    return { snapshot: this.snapshot, lease };
  }
  execute(input: Request): Promise<Result> {
    // Snapshot the caller's input synchronously, before it can change while queued.
    // Attach a handler immediately, including while another command is still running.
    const prepared = prepareCommand(input).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    const task = this.queue.then(async () => {
      const preparation = await prepared;
      if ("error" in preparation) return failure(preparation.error);
      const { request } = preparation.value;
      const history = this.receipts.get(request.leaseId);
      const next = executeCommand(
        this.schema,
        {
          snapshot: this.snapshot,
          lease: this.leases.get(request.leaseId),
          receipt: history?.get(request.requestId),
          undo: this.undo,
        },
        preparation.value,
        Date.now(),
      );
      if (next.receipt) {
        const receipts = history ?? new Map<string, Receipt>();
        receipts.set(request.requestId, freeze(next.receipt));
        this.receipts.set(request.leaseId, receipts);
      }
      if (next.prepared) {
        this.undo =
          "ops" in request
            ? {
                leaseId: request.leaseId,
                requestId: request.requestId,
                revision: next.prepared.snapshot.revision,
                snapshot: this.snapshot,
              }
            : undefined;
        this.snapshot = freeze(next.prepared.snapshot);
        for (const listener of this.listeners) listener(this.snapshot);
      }
      return next.result;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
  subscribe(listener: (snapshot: Snapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
