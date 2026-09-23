import type { CommitOptions, Document, Scope } from "./document.ts";
import type { At, Handle } from "./handles";
import type { Definition, ObjectNode, Value } from "./schema.ts";
import { schemaKey } from "./schema.ts";
import { getContext, onDestroy } from "svelte";
import { documentContext } from "./document-context";
export { documentContext } from "./document-context";
/** Handle for any object from `current`: the root, a row, a nested object, a record entry or a tree node. */
export type { At } from "./handles";
export type DocumentScope<N extends ObjectNode> = Scope<N>;
export type SlopDocument<N extends ObjectNode> = {
  /** Immutable snapshot. Unchanged rows keep their identity across edits. */
  readonly current: Value<N>;
  readonly status: Document<N>["status"];
  readonly error: string | null;
  /** Typed write handles; each call is its own commit. */
  readonly fields: Handle<N>;
  readonly at: At;
  /** One synchronous, all-or-nothing commit. */
  change<R>(callback: (tx: DocumentScope<N>) => R, options?: Pick<CommitOptions, "message">): R;
  /** Durability barrier: commits drafts and previews, then waits for storage. */
  flush(): Promise<void>;
};
export function useDocument<N extends ObjectNode>(definition: Definition<N>): SlopDocument<N> {
  const doc = getContext<Document<N>>(documentContext);
  if (!doc || doc.key !== schemaKey(definition.descriptor))
    throw new Error("Host document/schema mismatch");
  let current = $state.raw<Value<N>>(doc.current);
  let status = $state(doc.status);
  let error = $state(doc.error);
  onDestroy(
    doc.subscribe(() => {
      current = doc.current;
      status = doc.status;
      error = doc.error;
    }),
  );
  return {
    get current() {
      return current;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    fields: doc.fields,
    at: (value) => doc.at(value),
    change: (callback, options) => doc.change(callback, { message: options?.message }),
    flush: () => doc.flush(),
  };
}

export { bindText } from "./bind-text";
export { bindValue } from "./bind-value";
export { default as Slop } from "./Slop.svelte";
export type { Handle, TextHandle, RichTextHandle, ScalarHandle, InsertResult } from "./handles";
