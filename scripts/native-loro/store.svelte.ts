import { registerFlush } from "@hitslop/runtime/adapter";
import { errors } from "@hitslop/runtime";
import { validateDocument, type Static } from "@hitslop/schema/document";
import type { TSchema } from "typebox";
import { tick } from "svelte";
import type { Frame, TextPolicy } from "./contract.generated";

type DraftContext = { id: string; base: string; data: unknown; parent?: number; failed: boolean };
type Captured = { base: string; data: unknown };
type Metrics = { acknowledgement: number[]; paint: number[]; errors: string[]; queueWait: number[]; inputAck: number[]; pending: number; maxPending: number; trace: object[] };
type SpikeWindow = Window & {
  webkit: { messageHandlers: { hitslopNativeSpike: { postMessage(body: unknown): Promise<unknown> } } };
  __spikePublish?: (frame: Frame<unknown>) => void;
  __spikeTextPolicy?: TextPolicy;
  __spikeMetrics?: Metrics;
};
const host = window as unknown as SpikeWindow;
const request = <T>(method: string, fields: object = {}) => host.webkit.messageHandlers.hitslopNativeSpike.postMessage({ method, ...fields }) as Promise<T>;
const freeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
type TextStore<T> = { readonly current: Readonly<T> };
type Owner = {
  readonly frame: Frame<unknown> | undefined;
  begin(frame: Frame<unknown> | undefined): DraftContext;
  end(context: DraftContext): void;
  submit(mutate: (value: any) => void, context?: DraftContext, captured?: Captured): Promise<void>;
};
const owners = new WeakMap<object, Owner>();

/** No optimistic document state. Only a native frame can change current. */
export function documentStore<S extends TSchema>({ schema, initial }: { schema: S; initial: Static<S> }) {
  type Value = Static<S>;
  let current = $state.raw(freeze(structuredClone(initial)));
  let isReady = $state(false);
  let frame = $state.raw<Frame<Value>>();
  let queue: Promise<unknown> = Promise.resolve();
  let sequence = 0, destroyed = false;
  const session = crypto.randomUUID();
  const metrics: Metrics = host.__spikeMetrics = { acknowledgement: [], paint: [], errors: [], queueWait: [], inputAck: [], pending: 0, maxPending: 0, trace: [] };
  const trace = (event: object) => { metrics.trace.push({ time: performance.now(), ...event }); if (metrics.trace.length > 256) metrics.trace.shift(); };
  const report = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    metrics.errors.push(message);
    errors.report({ id: "native-spike", message: "Native spike edit failed", details: message, dismissible: true });
  };
  const adopt = (next: Frame<Value>) => {
    if (destroyed || (frame && next.publication <= frame.publication)) return;
    trace({ event: "frame", publication: next.publication, dirty: next.dirty });
    frame = next; current = freeze(structuredClone(next.data));
    if (next.error || next.projectionError) report(next.error ?? next.projectionError);
  };
  host.__spikePublish = next => adopt(next as Frame<Value>);
  const opening = request<Frame<Value>>("open").then(next => { adopt(next); isReady = true; });
  opening.catch(report);
  // A failed edit must not prevent a later flush from recovering the native journal.
  async function flush() { await opening; await queue.catch(() => {}); adopt(await request<Frame<Value>>("flush")); }
  const unregister = registerFlush(flush);
  function submit(mutator: (draft: Value) => void, context?: DraftContext, capture?: Captured): Promise<void> {
    let captured: Value | undefined;
    if (context || capture) {
      try {
        if (context?.failed) throw new Error("This draft needs recovery");
        const value = structuredClone(context?.data ?? capture!.data) as Value;
        mutator(value); // Once, at input time, against the displayed draft.
        validateDocument(schema, value); captured = value;
        if (context) context.data = structuredClone(value);
      } catch (error) { if (context) context.failed = true; report(error); return Promise.reject(error); }
    }
    const enqueued = performance.now();
    metrics.pending++; metrics.maxPending = Math.max(metrics.maxPending, metrics.pending);
    trace({ event: "enqueue", pending: metrics.pending, draft: !!context, captured: !!capture });
    const task = queue.catch(() => {}).then(async () => {
      await opening;
      if (destroyed || !frame) throw new Error("Document view is closed");
      if (context?.failed) throw new Error("This draft needs recovery");
      const draft = captured ?? structuredClone(current) as Value;
      if (!context && !capture) mutator(draft); // Ordinary mutations run once at the queue head.
      validateDocument(schema, draft);
      const started = performance.now(), editSequence = ++sequence;
      metrics.queueWait.push(started - enqueued);
      trace({ event: "apply", sequence: editSequence });
      const next = await request<Frame<Value>>("apply", { session, sequence: editSequence, base: context?.base ?? capture?.base ?? frame.revision, after: draft,
        ...(context ? { draft: context.id, ...(context.parent === undefined ? {} : { parent: context.parent }) } : {}) });
      if (context) context.parent = editSequence;
      metrics.acknowledgement.push(performance.now() - started); metrics.inputAck.push(performance.now() - enqueued);
      adopt(next); await tick();
      requestAnimationFrame(() => requestAnimationFrame(() => metrics.paint.push(performance.now() - enqueued)));
    }).finally(() => { metrics.pending--; });
    queue = task;
    task.catch(error => { if (context) context.failed = true; report(error); });
    return task;
  }
  const store = {
    get current() { return current; }, get isReady() { return isReady; }, get isLoading() { return !isReady; },
    change(mutator: (draft: Value) => void) { return submit(mutator); }, flush,
    destroy() { void flush().then(() => { destroyed = true; unregister(); host.__spikePublish = undefined; }).catch(report); },
  };
  owners.set(store, {
    get frame() { return frame; }, submit,
    begin(displayed) {
      if (!displayed) throw new Error("Document is not ready");
      return { id: crypto.randomUUID(), base: displayed.revision, data: structuredClone(displayed.data), failed: false };
    },
    end(context) { void request("releaseDraft", { session, draft: context.id }).catch(report); },
  });
  return store;
}

/** A plain text field binding. Revision and draft bookkeeping are private. */
export function documentText<T>(node: HTMLTextAreaElement, options: {
  store: TextStore<T>; read(data: Readonly<T>): string; write(data: T, value: string): void;
}) {
  let config = $state.raw(options);
  const owner = owners.get(options.store);
  if (!owner) throw new Error("documentText requires a native documentStore");
  const immediate = host.__spikeTextPolicy === "host-frame";
  let pending = 0, composing = false, submitted = options.read(options.store.current), disposed = false;
  let displayed = owner.frame, context: DraftContext | undefined;
  node.value = submitted;
  const reconcile = () => {
    // Recovery can confirm the failed input. Only release the held draft when
    // every visible character is now confirmed; never discard additional typing.
    if (context?.failed && !pending && !owner.frame?.error && config.read(config.store.current) === node.value) {
      owner.end(context); context = undefined;
    }
    if (disposed || (!immediate && (pending || composing || context?.failed))) return;
    if (context) { owner.end(context); context = undefined; }
    displayed = owner.frame;
    const next = config.read(config.store.current), previous = node.value;
    if (next === previous) return;
    let prefix = 0;
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++;
    let suffix = 0;
    while (suffix < previous.length - prefix && suffix < next.length - prefix && previous.at(-suffix - 1) === next.at(-suffix - 1)) suffix++;
    const adjust = (position: number) => position <= prefix ? position : position >= previous.length - suffix ? position + next.length - previous.length : next.length - suffix;
    const start = adjust(node.selectionStart), end = adjust(node.selectionEnd), direction = node.selectionDirection;
    node.value = next; submitted = next;
    if (document.activeElement === node) node.setSelectionRange(start, end, direction);
  };
  const input = () => {
    if ((!immediate && composing) || node.value === submitted) return;
    if (!immediate) context ??= owner.begin(displayed);
    if (!displayed) return;
    const value = node.value; submitted = value; pending++;
    const write = config.write;
    void owner.submit(data => write(data, value), context, immediate ? { base: displayed.revision, data: displayed.data } : undefined)
      .catch(() => {}).finally(() => { pending--; if (disposed) { if (context && !pending) owner.end(context); } else reconcile(); });
  };
  const compositionStart = () => { if (!immediate) context ??= owner.begin(displayed); composing = true; };
  const compositionEnd = () => { composing = false; input(); reconcile(); };
  // Read the reactive values even while reconcile is holding a local text draft.
  $effect(() => { owner.frame; config.read(config.store.current); reconcile(); });
  node.addEventListener("input", input); node.addEventListener("compositionstart", compositionStart); node.addEventListener("compositionend", compositionEnd);
  return {
    update(next: typeof options) { if (next.store !== options.store) throw new Error("Text store cannot change"); config = next; },
    destroy() { disposed = true; if (context && !pending) owner.end(context); node.removeEventListener("input", input); node.removeEventListener("compositionstart", compositionStart); node.removeEventListener("compositionend", compositionEnd); },
  };
}
