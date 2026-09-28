// The Svelte adapter, compiled into each slop. It depends only on the ctx ABI.
import { getContext, mount, tick, unmount, type Component } from "svelte";
import type { Binding, SlopApp, SlopContext } from "../abi";
import type { Issue, Scope } from "../contracts";
import type { At, Handle, ScalarHandle, TextHandle } from "../handle-types";
import type { Definition, ObjectNode, Value } from "../schema";
import { schemaKey } from "../schema";
import { activate, deactivate, current, slopContext } from "./context";
const adapterContext = Symbol("hitslop.document");
/** Handle for any object from `current`: the root, a row, a nested object, a record entry or a tree node. */
export type { At } from "../handle-types";
export type { DocumentEvent, Issue } from "../contracts";
export type { SlopContext, SlopApp } from "../abi";
export type DocumentScope<N extends ObjectNode> = Scope<N>;

/** The package entry: `export default defineSlop(App)`; the host mounts it. */
export function defineSlop(App: Component): SlopApp {
  return {
    mount(ctx, target) {
      activate(ctx);
      const adapter = createAdapter(ctx.document);
      try {
        const app = mount(App, {
          target,
          context: new Map<symbol, unknown>([
            [slopContext, ctx],
            [adapterContext, adapter.document],
          ]),
        });
        return {
          rendered: tick,
          unmount: async () => {
            try {
              await unmount(app);
            } finally {
              adapter.dispose();
              deactivate(ctx);
            }
          },
        };
      } catch (error) {
        adapter.dispose();
        deactivate(ctx);
        throw error;
      }
    },
  };
}

export type SlopDocument<N extends ObjectNode> = {
  /** Immutable snapshot. Unchanged rows keep their identity across edits. */
  readonly current: Value<N>;
  readonly status: "saved" | "saving" | "save-failed";
  readonly error: string | null;
  /** Merged-state anomalies; stored values are preserved, never repaired. */
  readonly issues: readonly Issue[];
  /** The last save exceeded capacity; live edits remain available until saved or explicitly discarded. */
  readonly full: boolean;
  /** Typed write handles; each call is its own commit. */
  readonly fields: Handle<N>;
  readonly at: At;
  /** One synchronous, all-or-nothing commit. */
  change<R>(callback: (tx: DocumentScope<N>) => R, options?: { message?: string }): R;
  /** Durability barrier: commits drafts and previews, then waits for storage. */
  flush(): Promise<void>;
};
export function useDocument<N extends ObjectNode>(definition: Definition<N>): SlopDocument<N> {
  const ctx = getContext<SlopContext | undefined>(slopContext);
  const doc = ctx?.document;
  if (!doc || doc.key !== schemaKey(definition.descriptor))
    throw new Error("Host document/schema mismatch");
  const adapter = getContext<SlopDocument<N> | undefined>(adapterContext);
  if (!adapter) throw new Error("Missing mounted document adapter");
  return adapter;
}
function createAdapter<N extends ObjectNode>(doc: SlopContext["document"]) {
  let current = $state.raw<Value<N>>(doc.current as Value<N>);
  let status = $state(doc.status);
  let error = $state(doc.error);
  let full = $state(doc.full);
  const dispose = doc.subscribe(() => {
    current = doc.current as Value<N>;
    status = doc.status;
    error = doc.error;
    full = doc.full;
  });
  const document: SlopDocument<N> = {
    get current() {
      return current;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    get issues() {
      // Tracks `current`; the runtime computes issues lazily and caches them per revision.
      void current;
      return doc.issues;
    },
    get full() {
      return full;
    },
    fields: doc.fields as unknown as Handle<N>,
    at: doc.at,
    change: (callback, options) => doc.change(callback as any, { message: options?.message }),
    flush: () => doc.flush(),
  };
  return { document, dispose };
}

/** Svelte action: `use:bindText={doc.fields.title}`. */
export function bindText(
  element: HTMLInputElement | HTMLTextAreaElement,
  handle: TextHandle,
): Binding<TextHandle> {
  return current().bind.text(element, handle);
}
/** Svelte action: `use:bindValue={doc.fields.done}`. */
export function bindValue<V extends string | number | boolean>(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  handle: ScalarHandle<V>,
): Binding<ScalarHandle<V>> {
  return current().bind.value(element, handle);
}

export { default as Slop } from "./Slop.svelte";
export type {
  Handle,
  TextHandle,
  RichTextHandle,
  ScalarHandle,
  InsertResult,
} from "../handle-types";
