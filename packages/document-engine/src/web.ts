import type { TSchema } from "typebox";
import { prepareDocument } from "@hitslop/schema/document";
import { assertJSON } from "@hitslop/schema/json";
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
} from "@hitslop/schema/document-protocol";
import {
  executeCommand,
  prepareSnapshot,
  type PreparedCommand,
  type UndoSlot,
  type Receipt,
} from "./index.js";
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
