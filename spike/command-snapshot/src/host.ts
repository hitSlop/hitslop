import type { TSchema } from "typebox";
import { assertJSON, validateDocument } from "./schema.ts";
import { applyOps } from "./apply.ts";
import { canonical, fail, failure, freeze, RequestSchema, validate, type JSONValue, type Request, type Result, type Snapshot } from "./protocol.ts";

/** One in-memory authority. Receipts are intentionally unbounded for this disposable spike. */
export class Authority {
  private current: Snapshot;
  private receipts = new Map<string, { payload: string; result: Result }>();
  private listeners = new Set<(snapshot: Snapshot) => void>();
  readonly timings: { applyMs: number; validateMs: number; serializeMs: number; bytes: number }[] = [];
  constructor(readonly schema: TSchema, initial: JSONValue) {
    validateDocument(schema, initial);
    this.current = freeze({ revision: 0, data: structuredClone(initial) });
  }
  get snapshot(): Snapshot { return this.current; }
  subscribe(listener: (snapshot: Snapshot) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  execute(input: unknown, reject = false): Result {
    let request: Request;
    try { assertJSON(input, new Set(), 72); validate(RequestSchema, input); request = input as Request; }
    catch (error) { return { ok: false, error: { code: "invalid_request", message: String(error) } }; }
    const payload = canonical(request), prior = this.receipts.get(request.requestId);
    if (prior) return prior.payload === payload ? prior.result : { ok: false, error: { code: "request_reused", message: "Request ID was reused with different content" } };
    let result: Result;
    try {
      if (reject) fail("rejected", "Injected rejection. Your edit was not accepted.");
      const timing = { applyMs: 0, validateMs: 0, serializeMs: 0, bytes: 0 };
      let data: JSONValue;
      if ("replace" in request) {
        if (request.replace.baseRevision !== this.current.revision) fail("stale_revision", "Document changed; preserve the proposed replacement and retry against the current revision");
        const start = performance.now();
        validateDocument(this.schema, request.replace.data);
        timing.validateMs = performance.now() - start;
        data = structuredClone(request.replace.data);
      } else data = applyOps(this.schema, this.current.data, request.ops, timing);
      const next = { revision: this.current.revision + 1, data };
      const start = performance.now();
      const encoded = JSON.stringify(next);
      timing.serializeMs = performance.now() - start;
      timing.bytes = new TextEncoder().encode(encoded).byteLength;
      this.timings.push(timing);
      this.current = freeze(next);
      result = freeze({ ok: true, revision: next.revision });
    } catch (error) { result = freeze(failure(error)); }
    // A receipt and state are committed together here (no await). This is not disk durability.
    this.receipts.set(request.requestId, { payload, result });
    if (result.ok) for (const listener of this.listeners) listener(this.current);
    return result;
  }
}

export interface Host {
  readonly connected: boolean;
  open(): Promise<Snapshot>;
  send(request: Request): Promise<Result>;
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  onConnection(listener: () => void): () => void;
}
const delay = (ms: number) => ms ? new Promise<void>(resolve => setTimeout(resolve, ms)) : Promise.resolve();
const offline = (): Result => ({ ok: false, error: { code: "offline", message: "Reconnect before making changes." } });

/** JSON serialization at the boundary; no shared guest/authority object references. */
export class MockHost implements Host {
  connected = true;
  latency = 0;
  rejectNext = false;
  dropAckNext = false;
  private epoch = 0;
  private frames = new Set<(snapshot: Snapshot) => void>();
  private connections = new Set<() => void>();
  private unsubscribe: () => void;
  constructor(readonly authority: Authority, readonly name: string) {
    this.unsubscribe = authority.subscribe(snapshot => {
      const epoch = this.epoch, bytes = JSON.stringify(snapshot);
      void delay(this.latency / 2).then(() => {
        if (this.connected && epoch === this.epoch) this.publish(JSON.parse(bytes));
      });
    });
  }
  private publish(snapshot: Snapshot) { for (const listener of this.frames) listener(snapshot); }
  async open() { if (!this.connected) throw new Error("Offline"); return JSON.parse(JSON.stringify(this.authority.snapshot)) as Snapshot; }
  subscribe(listener: (snapshot: Snapshot) => void) { this.frames.add(listener); return () => { this.frames.delete(listener); }; }
  onConnection(listener: () => void) { this.connections.add(listener); return () => { this.connections.delete(listener); }; }
  setConnected(connected: boolean) {
    this.connected = connected; this.epoch++;
    if (connected) this.publish(JSON.parse(JSON.stringify(this.authority.snapshot)));
    for (const listener of this.connections) listener();
  }
  async send(request: Request): Promise<Result> {
    if (!this.connected) return offline();
    const bytes = JSON.stringify(request), epoch = this.epoch;
    const reject = this.rejectNext, drop = this.dropAckNext, latency = this.latency;
    this.rejectNext = false; this.dropAckNext = false;
    await delay(latency / 2);
    if (!this.connected || epoch !== this.epoch) return offline();
    const result = this.authority.execute(JSON.parse(bytes), reject);
    await delay(latency / 2);
    if (drop || !this.connected || epoch !== this.epoch) return { ok: false, error: { code: "unknown_outcome", message: "Acknowledgement lost. Resolve the original request before submitting another edit." } };
    return structuredClone(result);
  }
  dispose() { this.epoch++; this.connected = false; this.unsubscribe(); this.frames.clear(); this.connections.clear(); }
}
