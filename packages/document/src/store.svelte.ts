import type { Document } from "./document.ts";
import type { Definition, ObjectNode, Value } from "./schema.ts";
import { schemaKey } from "./schema.ts";
import { getContext, onDestroy } from "svelte";
export const documentContext = Symbol("hitslop.document");
export function useDocument<N extends ObjectNode>(definition: Definition<N>) {
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
    set: doc.set.bind(doc),
    clear: doc.clear.bind(doc),
    text: doc.text.bind(doc),
    transaction: doc.transaction.bind(doc),
    insert: doc.insert.bind(doc),
    remove: doc.remove.bind(doc),
    move: doc.move.bind(doc),
    flush: doc.flush.bind(doc),
  };
}

export { bindText } from "./bind-text";
export { default as Slop } from "./Slop.svelte";
export { useSlop } from "./slop-context";
export type { Handle, TextHandle, InsertResult } from "./handles";
