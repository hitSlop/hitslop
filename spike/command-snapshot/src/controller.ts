import type { Static, TSchema } from "typebox";
import type { ListSchema } from "./schema.ts";
import { assertJSON, syncMeta, validateDocument } from "./schema.ts";
import { pathInfo, type Address, type PathValue, type ReadonlyJSON, type SchemaNode } from "./paths.ts";
import { CommandError, failure, freeze, type Failure, type JSONValue, type Op, type Position, type Request, type Result, type Snapshot } from "./protocol.ts";
import type { Host } from "./host.ts";

type ListPath = Address<ListSchema<TSchema, string>>;
type Item<P extends ListPath> = P[typeof pathInfo]["schema"] extends ListSchema<infer I, string> ? Static<I> : never;
type OfType<P extends Address, V> = P & (PathValue<P> extends V ? unknown : never);
export type Mutations<Return> = {
  set<P extends Address>(path: P, value: NoInfer<PathValue<P>>): Return;
  unset(path: Address<TSchema, true>): Return;
  toggle<P extends Address>(path: OfType<P, boolean>): Return;
  increment<P extends Address>(path: OfType<P, number>, amount?: number): Return;
  insert<P extends ListPath>(path: P, value: NoInfer<Item<P>>, position?: Position): Return;
  remove<P extends ListPath>(path: P, id: string): Return;
  move<P extends ListPath>(path: P, id: string, position: Position): Return;
  patch<P extends Address>(path: OfType<P, object>, fields: NoInfer<Partial<PathValue<P>>>): Return;
};

/** No Svelte here: typed commands, serial requests, confirmed snapshots and flush. */
export function createController<S extends TSchema>({ schema, initial, host }: { schema: S; initial: NoInfer<Static<S>>; host: Host }) {
  validateDocument(schema, initial);
  let data = freeze(structuredClone(initial)) as ReadonlyJSON<Static<S>>;
  let revision = -1, loading = true, pending = 0, closed = false, batching = false;
  let error: Failure["error"] | null = null;
  let uncertain: Request | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const drafts = new Set<() => Promise<Result>>();
  const resolutions = new Set<(request: Request, result: Result) => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const report = (result: Result): Result => { if (!result.ok) error = result.error; notify(); return result; };
  function adopt(snapshot: Snapshot) {
    if (closed || snapshot.revision <= revision) return;
    validateDocument(schema, snapshot.data);
    revision = snapshot.revision;
    data = freeze(snapshot.data) as ReadonlyJSON<Static<S>>;
    notify();
  }
  const unframe = host.subscribe(snapshot => { try { adopt(snapshot); } catch (cause) { report(failure(cause)); } });
  const unconnection = host.onConnection(notify);
  const opening = host.open().then(adopt).catch(cause => { report(failure(cause)); }).finally(() => { loading = false; notify(); });

  function submit(request: Request, resolving = false): Promise<Result> {
    if (closed) return Promise.resolve(report(failure(new CommandError("closed", "Store is closed"))));
    if (!host.connected) return Promise.resolve(report(failure(new CommandError("offline", "Reconnect before making changes."))));
    if (uncertain && !resolving) return Promise.resolve(report(failure(new CommandError("unknown_outcome", "Resolve the outstanding request first"))));
    pending++; notify();
    const task = queue.then(async (): Promise<Result> => {
      await opening;
      if (revision < 0) return report(failure(new CommandError("not_ready", "Open a confirmed snapshot before making changes")));
      if (uncertain && !resolving) return report(failure(new CommandError("unknown_outcome", "Resolve the outstanding request first")));
      let result: Result;
      try { result = await host.send(request); }
      catch {
        result = failure(new CommandError("unknown_outcome", "Transport interrupted. Resolve the original request before retrying."));
      }
      if (!result.ok && result.error.code === "unknown_outcome") uncertain = request;
      if (resolving && (result.ok || !["offline", "unknown_outcome"].includes(result.error.code))) uncertain = undefined;
      if (result.ok) {
        // Acknowledgement is not itself a document. Acquire a confirmed snapshot.
        try { adopt(await host.open()); }
        catch { error = { code: "offline", message: "Edit accepted; reconnect to refresh the confirmed snapshot." }; }
      }
      return report(result);
    }).catch(cause => report(failure(cause))).finally(() => { pending--; notify(); });
    queue = task;
    return task;
  }
  function steps(path: Address) {
    if (!path?.[pathInfo] || path[pathInfo].root !== schema) throw new CommandError("invalid_path", "Path belongs to another schema");
    return path[pathInfo].steps.map(step => ({ ...step }));
  }
  function verbs<R>(emit: (ops: Op[]) => R): Mutations<R> {
    const value = (input: unknown): JSONValue => { assertJSON(input, new Set(), 64); return structuredClone(input); };
    return {
      set: (path, input) => emit([{ op: "set", path: steps(path), value: value(input) }]),
      unset: path => emit([{ op: "unset", path: steps(path) }]),
      toggle: path => emit([{ op: "toggle", path: steps(path) }]),
      increment: (path, amount = 1) => emit([{ op: "increment", path: steps(path), amount }]),
      insert: (path, input, position) => emit([{ op: "insert", path: steps(path), value: value(input), ...(position ? { position: { ...position } } : {}) }]),
      remove: (path, id) => emit([{ op: "remove", path: steps(path), id }]),
      move: (path, id, position) => emit([{ op: "move", path: steps(path), id, position: { ...position } }]),
      patch: (path, fields) => {
        const base = steps(path), node = path[pathInfo].schema as SchemaNode;
        if (syncMeta(node)?.container !== "map" && syncMeta(node)?.container !== "record") throw new CommandError("invalid_operation", "patch requires an object or record");
        assertJSON(fields);
        return emit(Object.entries(fields).map(([key, input]) => ({ op: "set", path: [...base, { key }], value: value(input) })));
      },
    };
  }
  const emit = (ops: Op[]) => {
    if (batching) throw new CommandError("batch_usage", "Use tx methods inside change()");
    if (!ops.length) return Promise.resolve({ ok: true, revision } as const);
    return submit({ requestId: crypto.randomUUID(), ops });
  };
  const raw = verbs(emit);
  // Expected command failures are results. Misusing a batch throws into its callback.
  const commands = Object.fromEntries(Object.entries(raw).map(([name, fn]) => [name, (...args: unknown[]) => {
    if (batching) throw new CommandError("batch_usage", "Use tx methods inside change()");
    try { return (fn as (...args: unknown[]) => Promise<Result>)(...args); }
    catch (cause) { return Promise.resolve(report(failure(cause))); }
  }])) as unknown as Mutations<Promise<Result>>;
  const api = {
    ...commands,
    get data() { return data; },
    get revision() { return revision; },
    get isLoading() { return loading; },
    get pending() { return pending; },
    get error() { return error; },
    get connected() { return host.connected; },
    get hasUnknownOutcome() { return !!uncertain; },
    get canWrite() { return revision >= 0 && !loading && !closed && host.connected && !uncertain; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    clearError() { if (!uncertain) error = null; notify(); },
    async retryUnknown(): Promise<Result> {
      if (!uncertain) return { ok: true, revision };
      const request = uncertain;
      const result = await submit(request, true);
      if (!uncertain) for (const listener of resolutions) listener(request, result);
      if (result.ok) { error = null; notify(); }
      return result;
    },
    change(callback: (tx: Mutations<void>) => void): Promise<Result> {
      if (batching) throw new CommandError("batch_usage", "Nested batches are not supported");
      // Detect async functions before running their synchronous prefix.
      if (callback.constructor.name === "AsyncFunction") return Promise.resolve(report(failure(new CommandError("batch_usage", "Batch callbacks must be synchronous"))));
      const ops: Op[] = []; let active = true;
      const tx = verbs<void>(next => { if (!active) throw new CommandError("batch_usage", "Transaction has ended"); ops.push(...next); });
      batching = true;
      try {
        const returned = callback(tx) as unknown;
        if (returned && typeof (returned as Promise<unknown>).then === "function") {
          void Promise.resolve(returned).catch(() => undefined);
          throw new CommandError("batch_usage", "Batch callbacks must be synchronous");
        }
      } catch (cause) { return Promise.resolve(report(failure(cause))); }
      finally { active = false; batching = false; }
      return emit(ops);
    },
    registerDraft(flush: () => Promise<Result>) { drafts.add(flush); return () => { drafts.delete(flush); }; },
    onResolution(listener: (request: Request, result: Result) => void) { resolutions.add(listener); return () => { resolutions.delete(listener); }; },
    async flush(): Promise<Result> {
      for (const draft of [...drafts]) { const result = await draft(); if (!result.ok) return result; }
      await opening; await queue;
      if (uncertain) return failure(new CommandError("unknown_outcome", "Resolve the outstanding request before closing"));
      return error ? { ok: false, error } : { ok: true, revision };
    },
    async destroy(): Promise<Result> {
      const result = await api.flush();
      if (!result.ok) return result;
      closed = true; unframe(); unconnection(); listeners.clear(); drafts.clear(); resolutions.clear(); return result;
    },
    /** Test/harness cleanup only: explicit discard, never the durability path. */
    dispose() { closed = true; unframe(); unconnection(); listeners.clear(); drafts.clear(); resolutions.clear(); },
    ready: opening,
  };
  return api;
}
export type Controller<S extends TSchema> = ReturnType<typeof createController<S>>;
