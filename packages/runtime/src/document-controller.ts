import { assertJSON } from "@hitslop/schema/json";
import { getHost } from "./index.js";
import { newId } from "./id.js";
import { reconcile } from "./document-reconcile.js";
import type { Static, TSchema } from "typebox";
import type { ListSchema } from "@hitslop/schema/document";
import {
  documentMeta,
  documentMapping,
  recordValueSchema,
  validateDocument,
} from "@hitslop/schema/document";
import {
  pathInfo,
  type Address,
  type PathValue,
  type ReadonlyJSON,
  type SchemaNode,
} from "@hitslop/schema/document";
import {
  CommandError,
  failure,
  freeze,
  SnapshotSchema,
  OpenSchema,
  validate,
  type Failure,
  type JSONValue,
  type Op,
  type Position,
  type Request,
  type Result,
  type Snapshot,
  type Step,
} from "@hitslop/schema/document-protocol";
import type { Identity, Open, Lease } from "@hitslop/schema/document-protocol";
export interface CommandHost {
  readonly connected: boolean;
  readonly writable: boolean;
  open(options?: { schema: TSchema; initial: unknown }): Promise<Open>;
  onHandoff?(listener: (open: Open, previousAuthority: string) => void): () => void;
  send(request: Request): Promise<Result>;
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  onConnection(listener: () => void): () => void;
  flush(): Promise<void>;
}

type ListPath = Address<ListSchema<TSchema, string>>;
type Item<P extends ListPath> =
  P[typeof pathInfo]["schema"] extends ListSchema<infer I, string> ? Static<I> : never;
type ItemKey<P extends ListPath> =
  P[typeof pathInfo]["schema"] extends ListSchema<TSchema, infer K> ? K : never;
type InsertItem<P extends ListPath> = Omit<Item<P>, ItemKey<P>> &
  Partial<Pick<Item<P>, ItemKey<P> & keyof Item<P>>>;
export type MutationResult =
  { ok: true; revision: number; readonly canUndo: boolean; undo?: () => Promise<Result> } | Failure;
export type InsertResult = (Extract<MutationResult, { ok: true }> & { id: string }) | Failure;
type OfType<P extends Address, V> = P & (PathValue<P> extends V ? unknown : never);
export type Mutations<
  Return,
  InsertReturn = Return extends void ? string : Promise<InsertResult>,
> = {
  set<P extends Address>(path: P, value: NoInfer<PathValue<P>>): Return;
  unset(path: Address<TSchema, true>): Return;
  toggle<P extends Address>(path: OfType<P, boolean>): Return;
  increment<P extends Address>(path: OfType<P, number>, amount?: number): Return;
  insert<P extends ListPath>(
    path: P,
    value: NoInfer<InsertItem<P>>,
    position?: Position,
  ): InsertReturn;
  remove<P extends ListPath>(path: P, id: string): Return;
  move<P extends ListPath>(path: P, id: string, position: Position): Return;
  patch<P extends Address>(path: OfType<P, object>, fields: NoInfer<Partial<PathValue<P>>>): Return;
};

/** No Svelte here: typed commands, serial requests, confirmed snapshots and flush. */
export function createDocumentController<S extends TSchema>({
  schema,
  initial,
  host = getHost().document,
}: {
  schema: S;
  initial: NoInfer<Static<S>>;
  host?: CommandHost;
}) {
  validateDocument(schema, initial);
  let data = freeze(structuredClone(initial)) as ReadonlyJSON<Static<S>>;
  const mapping = documentMapping(schema);
  let identity: Identity | undefined, lease: Lease | undefined;
  let earlySnapshot: Snapshot | undefined;
  let revision = -1,
    loading = true,
    pending = 0,
    closed = false,
    batching = false;
  let error: Failure["error"] | null = null;
  let uncertain: Request | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const errors = new Set<(error: Failure["error"]) => void>();
  const pendingPaths = new Map<object, Step[][]>();
  function affected(op: Op): Step[] {
    if (op.op === "remove" || op.op === "move") return [...op.path, { item: op.id }];
    if (op.op !== "insert") return op.path;
    let node = schema as SchemaNode;
    for (const step of op.path) {
      node =
        "item" in step
          ? node.items!
          : (node.properties?.[step.key] ??
              (documentMeta(node)?.container === "record" ? recordValueSchema(node) : undefined))!;
    }
    const key = documentMeta(node)?.key;
    const id =
      key && op.value && typeof op.value === "object" && !Array.isArray(op.value)
        ? op.value[key]
        : undefined;
    return typeof id === "string" ? [...op.path, { item: id }] : op.path;
  }
  const sameStep = (a: Step, b: Step) =>
    "key" in a && "key" in b ? a.key === b.key : "item" in a && "item" in b && a.item === b.item;
  const drafts = new Set<() => Promise<Result>>();
  const resolutions = new Set<(request: Request, result: Result) => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const report = <R extends Result>(result: R): R => {
    if (!result.ok) {
      error = result.error;
      for (const listener of errors) listener(error);
    } else if (!uncertain) error = null;
    notify();
    return result;
  };
  const retiredAuthorities = new Set<string>();
  function adopt(snapshot: Snapshot) {
    if (closed) return;
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0)
      throw new CommandError("invalid_request", "Invalid snapshot revision");
    validate(SnapshotSchema, snapshot);
    if (!identity) {
      earlySnapshot = snapshot;
      return;
    }
    if (
      snapshot.documentId !== identity.documentId ||
      snapshot.schemaHash !== identity.schemaHash
    ) {
      report(
        failure(new CommandError("authority_changed", "Unexpected document or schema identity")),
      );
      return;
    }
    if (snapshot.authority !== identity.authority) {
      if (!retiredAuthorities.has(snapshot.authority))
        report(
          failure(
            new CommandError(
              "authority_changed",
              "Unexpected authority; a confirmed handoff is required",
            ),
          ),
        );
      return;
    }
    if (snapshot.revision <= revision) return;
    revision = snapshot.revision;
    data = reconcile(data, snapshot.data, mapping) as ReadonlyJSON<Static<S>>;
    notify();
  }
  const unframe = host.subscribe((snapshot) => {
    try {
      adopt(snapshot);
    } catch (cause) {
      report(failure(cause));
    }
  });
  const unconnection = host.onConnection(notify);
  const opening = host
    .open({ schema, initial })
    .then((open) => {
      validate(OpenSchema, open);
      identity = {
        documentId: open.snapshot.documentId,
        schemaHash: open.snapshot.schemaHash,
        authority: open.snapshot.authority,
      };
      lease = open.lease;
      adopt(open.snapshot);
      if (earlySnapshot) {
        adopt(earlySnapshot);
        earlySnapshot = undefined;
      }
    })
    .catch((cause) => {
      report(failure(cause));
    })
    .finally(() => {
      loading = false;
      notify();
    });

  function submit(input: Request | Op[], resolving = false): Promise<Result> {
    if (closed)
      return Promise.resolve(report(failure(new CommandError("closed", "Store is closed"))));
    if (!host.connected || (!host.writable && !resolving))
      return Promise.resolve(
        report(failure(new CommandError("offline", "Reconnect before making changes."))),
      );
    if (uncertain && !resolving)
      return Promise.resolve(
        report(
          failure(new CommandError("unknown_outcome", "Resolve the outstanding request first")),
        ),
      );
    const ops = Array.isArray(input) ? input : "ops" in input ? input.ops : undefined;
    pendingPaths.set(input, ops ? ops.map(affected) : [[]]);
    pending++;
    notify();
    const task = queue
      .then(async (): Promise<Result> => {
        await opening;
        if (revision < 0)
          return report(
            failure(
              new CommandError("not_ready", "Open a confirmed snapshot before making changes"),
            ),
          );
        if (uncertain && !resolving)
          return report(
            failure(new CommandError("unknown_outcome", "Resolve the outstanding request first")),
          );
        if (Array.isArray(input) && lease!.expiresAt <= Date.now()) {
          const open = await host.open({ schema, initial });
          if (open.lease.expiresAt <= Date.now())
            return report(
              failure(new CommandError("offline", "Reconnect to obtain a current write lease")),
            );
          const result = acceptOpening(open, identity!.authority);
          if (!result.ok) return result;
        }
        const request = Array.isArray(input)
          ? freeze({ ...identity!, leaseId: lease!.id, requestId: newId(), ops: input })
          : input;
        let result: Result;
        try {
          result = await host.send(request);
        } catch {
          result = failure(
            new CommandError(
              "unknown_outcome",
              "Transport interrupted. Resolve the original request before retrying.",
            ),
          );
        }
        if (!result.ok && result.error.code === "unknown_outcome") uncertain = request;
        if (resolving && (result.ok || !["offline", "unknown_outcome"].includes(result.error.code)))
          uncertain = undefined;
        report(result);
        return "ops" in request ? mutation(result, request, lease) : result;
      })
      .catch((cause) => report(failure(cause)))
      .finally(() => {
        pendingPaths.delete(input);
        pending--;
        notify();
      });
    queue = task;
    return task;
  }
  function mutation(result: Result, request?: Request, originalLease?: Lease): MutationResult {
    if (!result.ok) return result;
    let running: Promise<Result> | undefined;
    let resolved: Result | undefined;
    let attempt: Request | undefined;
    const current = () =>
      !!request &&
      identity?.authority === request.authority &&
      identity.documentId === request.documentId &&
      identity.schemaHash === request.schemaHash &&
      revision === result.revision &&
      !closed;
    const undo = request
      ? (): Promise<Result> => {
          if (batching)
            throw new CommandError("batch_usage", "Use tx methods inside transaction()");
          if (running) return running;
          if (resolved?.ok) return Promise.resolve(resolved);
          running = (async () => {
            if (attempt && uncertain?.requestId === attempt.requestId) return api.retryUnknown();
            const flushed = await api.flush();
            if (!flushed.ok) return report(flushed);
            if (identity?.authority !== request.authority)
              return report(
                failure(new CommandError("authority_changed", "Undo belongs to another authority")),
              );
            if (!current())
              return report(
                failure(
                  new CommandError("stale_revision", "Undo unavailable after another change."),
                ),
              );
            if (!originalLease || originalLease.expiresAt <= Date.now())
              return report(
                failure(new CommandError("lease_expired", "This undo session has expired")),
              );
            attempt = freeze({
              documentId: request.documentId,
              schemaHash: request.schemaHash,
              authority: request.authority,
              leaseId: request.leaseId,
              requestId: newId(),
              undo: { requestId: request.requestId, revision: result.revision },
            });
            const outcome = await submit(attempt);
            if (!outcome.ok && outcome.error.code === "unknown_outcome") {
              const resolvedAttempt = (request: Request, value: Result) => {
                if (request.requestId !== attempt!.requestId) return;
                resolved = value;
                resolutions.delete(resolvedAttempt);
              };
              resolutions.add(resolvedAttempt);
            }
            return outcome;
          })()
            .then((value) => {
              resolved = value;
              return value;
            })
            .finally(() => {
              running = undefined;
              notify();
            });
          notify();
          return running;
        }
      : undefined;
    // SDK-only behavior never becomes part of a JSON receipt or snapshot.
    return Object.defineProperties(
      { ...result },
      {
        canUndo: {
          get: () =>
            !!undo &&
            current() &&
            api.canWrite &&
            !pending &&
            !running &&
            !resolved?.ok &&
            !!originalLease &&
            originalLease.expiresAt > Date.now(),
        },
        ...(undo ? { undo: { value: undo } } : {}),
      },
    ) as MutationResult;
  }
  function steps(path: Address) {
    if (!path?.[pathInfo] || path[pathInfo].root !== schema)
      throw new CommandError("invalid_path", "Path belongs to another schema");
    return path[pathInfo].steps.map((step) => ({ ...step }));
  }
  function verbs<R, I>(
    emit: (ops: Op[]) => R,
    inserted: (result: R, id: string) => I,
  ): Mutations<R, I> {
    const value = (input: unknown): JSONValue => {
      assertJSON(input, new Set(), 64);
      return structuredClone(input);
    };
    return {
      set: (path, input) => emit([{ op: "set", path: steps(path), value: value(input) }]),
      unset: (path) => emit([{ op: "unset", path: steps(path) }]),
      toggle: (path) => emit([{ op: "toggle", path: steps(path) }]),
      increment: (path, amount = 1) => emit([{ op: "increment", path: steps(path), amount }]),
      insert: (path, input, position) => {
        const address = steps(path);
        const meta = documentMeta(path[pathInfo].schema);
        if (meta?.container !== "list" || !meta.key)
          throw new CommandError("invalid_operation", "insert requires an identity list");
        const item = value(input);
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new CommandError("invalid_operation", "List items must be objects");
        if (!Object.hasOwn(item, meta.key))
          Object.defineProperty(item, meta.key, {
            value: newId(),
            enumerable: true,
            writable: true,
            configurable: true,
          });
        const id = item[meta.key];
        if (typeof id !== "string" || !id)
          throw new CommandError("invalid_operation", "List identity must be a non-empty string");
        return inserted(
          emit([
            {
              op: "insert",
              path: address,
              value: item,
              ...(position ? { position: { ...position } } : {}),
            },
          ]),
          id,
        );
      },
      remove: (path, id) => emit([{ op: "remove", path: steps(path), id }]),
      move: (path, id, position) =>
        emit([{ op: "move", path: steps(path), id, position: { ...position } }]),
      patch: (path, fields) => {
        const base = steps(path),
          node = path[pathInfo].schema as SchemaNode;
        if (documentMeta(node)?.container !== "map" && documentMeta(node)?.container !== "record")
          throw new CommandError("invalid_operation", "patch requires an object or record");
        assertJSON(fields);
        return emit(
          Object.entries(fields).map(([key, input]) => ({
            op: "set",
            path: [...base, { key }],
            value: value(input),
          })),
        );
      },
    };
  }
  const emit = (ops: Op[]): Promise<MutationResult> => {
    if (batching) throw new CommandError("batch_usage", "Use tx methods inside transaction()");
    if (!ops.length) return Promise.resolve(mutation({ ok: true, revision }));
    if (!identity || !lease)
      return Promise.resolve(
        report(failure(new CommandError("not_ready", "Open the document before editing"))),
      );
    return submit(ops) as Promise<MutationResult>;
  };
  const raw = verbs(emit, async (pending, id): Promise<InsertResult> => {
    const result = await pending;
    return result.ok
      ? (Object.defineProperty(result, "id", { value: id, enumerable: true }) as InsertResult)
      : result;
  });
  // Expected command failures are results. Misusing a batch throws into its callback.
  const commands = Object.fromEntries(
    Object.entries(raw).map(([name, fn]) => [
      name,
      (...args: unknown[]) => {
        if (batching) throw new CommandError("batch_usage", "Use tx methods inside transaction()");
        try {
          return (fn as (...args: unknown[]) => Promise<Result>)(...args);
        } catch (cause) {
          return Promise.resolve(report(failure(cause)));
        }
      },
    ]),
  ) as unknown as Mutations<Promise<MutationResult>>;
  function acceptOpening(open: Open, previousAuthority: string): Result {
    validate(OpenSchema, open);
    if (
      identity &&
      open.snapshot.authority === identity.authority &&
      open.snapshot.documentId === identity.documentId &&
      open.snapshot.schemaHash === identity.schemaHash
    ) {
      lease = open.lease;
      adopt(open.snapshot);
      return { ok: true, revision };
    }
    if (
      !identity ||
      identity.authority !== previousAuthority ||
      uncertain ||
      open.snapshot.documentId !== identity.documentId ||
      open.snapshot.schemaHash !== identity.schemaHash
    )
      return report(
        failure(new CommandError("authority_changed", "Cannot adopt this authority handoff")),
      );
    retiredAuthorities.add(identity.authority);
    identity = {
      documentId: open.snapshot.documentId,
      schemaHash: open.snapshot.schemaHash,
      authority: open.snapshot.authority,
    };
    lease = open.lease;
    revision = -1;
    adopt(open.snapshot);
    return { ok: true, revision };
  }
  function dispose() {
    if (closed) return;
    closed = true;
    unframe();
    unconnection();
    unhandoff();
    listeners.clear();
    errors.clear();
    drafts.clear();
    resolutions.clear();
  }
  const api = {
    ...commands,
    get data() {
      return data;
    },
    get revision() {
      return revision;
    },
    get authority() {
      return identity?.authority;
    },
    /** Only a confirmed host handoff may switch epochs; drain outstanding work first. */
    async handoff(open: Open, previousAuthority: string): Promise<Result> {
      await queue;
      return acceptOpening(open, previousAuthority);
    },
    get isLoading() {
      return loading;
    },
    get pending() {
      return pending;
    },
    get error() {
      return error;
    },
    get connected() {
      return host.connected;
    },
    get hasUnknownOutcome() {
      return !!uncertain;
    },
    get canWrite() {
      return revision >= 0 && !loading && !closed && host.connected && host.writable && !uncertain;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onError(listener: (error: Failure["error"]) => void) {
      errors.add(listener);
      return () => {
        errors.delete(listener);
      };
    },
    isPending(path: Address) {
      const query = steps(path);
      return [...pendingPaths.values()].some((paths) =>
        paths.some((candidate) => {
          const length = Math.min(query.length, candidate.length);
          return query.slice(0, length).every((step, index) => sameStep(step, candidate[index]!));
        }),
      );
    },
    clearError() {
      if (!uncertain) error = null;
      notify();
    },
    async retryUnknown(): Promise<Result> {
      if (!uncertain) return { ok: true, revision };
      const request = uncertain;
      const result = await submit(request, true);
      if (!uncertain) for (const listener of resolutions) listener(request, result);
      if (result.ok) {
        error = null;
        notify();
      }
      return result;
    },
    transaction(callback: (tx: Mutations<void>) => void): Promise<MutationResult> {
      if (batching) throw new CommandError("batch_usage", "Nested batches are not supported");
      // Detect async functions before running their synchronous prefix.
      if (callback.constructor.name === "AsyncFunction")
        return Promise.resolve(
          report(failure(new CommandError("batch_usage", "Batch callbacks must be synchronous"))),
        );
      const ops: Op[] = [];
      let active = true;
      const tx = verbs(
        (next): void => {
          if (!active) throw new CommandError("batch_usage", "Transaction has ended");
          ops.push(...next);
        },
        (_, id) => id,
      );
      batching = true;
      try {
        const returned = callback(tx) as unknown;
        if (returned && typeof (returned as Promise<unknown>).then === "function") {
          void Promise.resolve(returned).catch(() => undefined);
          throw new CommandError("batch_usage", "Batch callbacks must be synchronous");
        }
      } catch (cause) {
        return Promise.resolve(report(failure(cause)));
      } finally {
        active = false;
        batching = false;
      }
      return emit(ops);
    },
    registerDraft(flush: () => Promise<Result>) {
      drafts.add(flush);
      return () => {
        drafts.delete(flush);
      };
    },
    onResolution(listener: (request: Request, result: Result) => void) {
      resolutions.add(listener);
      return () => {
        resolutions.delete(listener);
      };
    },
    async flush(): Promise<Result> {
      for (const draft of [...drafts]) {
        const result = await draft();
        if (!result.ok) return result;
      }
      await opening;
      await queue;
      if (uncertain)
        return failure(
          new CommandError("unknown_outcome", "Resolve the outstanding request before closing"),
        );
      if (revision < 0)
        return failure(new CommandError("not_ready", "No confirmed document was opened"));
      try {
        await host.flush();
      } catch (cause) {
        return report(failure(new CommandError("storage_unavailable", String(cause))));
      }
      return { ok: true, revision };
    },
    async destroy(): Promise<Result> {
      const result = await api.flush();
      if (!result.ok) return result;
      dispose();
      return result;
    },
    /** Test/harness cleanup only: explicit discard, never the durability path. */
    dispose,
    ready: opening,
  };
  const unhandoff =
    host.onHandoff?.((open, previous) => {
      void api.handoff(open, previous).catch((cause) => report(failure(cause)));
    }) ?? (() => {});
  return api;
}
export type Controller<S extends TSchema> = ReturnType<typeof createDocumentController<S>>;
