import * as S from "@hitslop/schema/document";
import { paths } from "@hitslop/schema/document";
import {
  createDocumentController as createController,
  type CommandHost as Host,
} from "../../runtime/src/document-controller.ts";
import { createDocument } from "../src/create-document.svelte.ts";

// Compiled only; every @ts-expect-error must correspond to a real strict error.
function typeChecks(host: Host, input: HTMLInputElement) {
  const schema = S.Document({
    count: S.Integer(),
    title: S.String(),
    enabled: S.Boolean(),
    note: S.Optional(S.String()),
    list: S.List(S.Object({ id: S.String(), done: S.Boolean() }), "id"),
    custom: S.List(S.Object({ key: S.String(), label: S.String() }), "key"),
    array: S.Array(S.Object({ id: S.String() })),
    record: S.Record(S.Number()),
  });
  const fields = paths(schema);
  const initial = {
    count: 0,
    title: "",
    enabled: true,
    list: [],
    custom: [],
    array: [],
    record: {},
  };
  const store = createController({ schema, initial, host });
  store.set(fields.title, "valid");
  store.increment(fields.count);
  store.toggle(fields.enabled);
  store.unset(fields.note);
  store.unset(fields.record.at("a.b"));
  store.insert(fields.list, { id: "a", done: false }, { after: "b" });
  store.insert(fields.list, { done: false }).then((result) => {
    if (result.ok) {
      const id: string = result.id;
      void id;
    } else {
      // @ts-expect-error rejected inserts do not expose an accepted identity
      result.id;
    }
  });
  store.insert(fields.custom, { label: "Generated key" });
  store.insert(fields.custom, { key: "imported", label: "Imported key" });
  store.transaction((tx) => {
    const id: string = tx.insert(fields.list, { done: false });
    tx.set(fields.list.item(id).done, true);
  });
  // @ts-expect-error identity must still be a string when supplied
  store.insert(fields.custom, { key: 1, label: "Invalid" });
  // @ts-expect-error automatic identity does not make other fields optional
  store.insert(fields.custom, {});
  store.set(fields.list.item({ id: "a" }).done, true);
  store.set(fields.record.at("a.b"), 1);
  store.patch(fields.list.item("a"), { done: true });
  // @ts-expect-error atomic arrays have no item capability
  fields.array.item("a");
  // @ts-expect-error only records have dynamic at
  fields.list.at("a");
  // @ts-expect-error record value must be numeric
  store.set(fields.record.at("a.b"), "wrong");
  // @ts-expect-error wrong scalar type must not widen path inference
  store.set(fields.count, "wrong");
  // @ts-expect-error wrong operator
  store.increment(fields.title);
  // @ts-expect-error wrong operator
  store.toggle(fields.count);
  // @ts-expect-error required field
  store.unset(fields.title);
  // @ts-expect-error insertion is only for identity lists
  store.insert(fields.array, { id: "a" });
  // @ts-expect-error unknown property
  store.patch(fields.list.item("a"), { dne: true });
  // @ts-expect-error missing item field
  store.insert(fields.list, { id: "a" });
  // @ts-expect-error identity key must exist
  S.List(S.Object({ id: S.String() }), "missing");
  // @ts-expect-error identity key must be a required string
  S.List(S.Object({ id: S.Optional(S.String()) }), "id");
  // @ts-expect-error identity key must be a string
  S.List(S.Object({ id: S.Number() }), "id");
  // @ts-expect-error numeric indices are not positions
  store.move(fields.list, "a", { index: 1 });
  // @ts-expect-error position is exclusive
  store.move(fields.list, "a", { before: "b", after: "c" });
  // @ts-expect-error data is deeply readonly
  store.data.list.push({ id: "a", done: true });
  const svelteStore = createDocument({ schema, initial });
  svelteStore.text(svelteStore.fields.title)(input);
  // @ts-expect-error authority handoff is internal
  svelteStore.handoff({});
  // @ts-expect-error forced disposal is not authoring API
  svelteStore.dispose();
  // @ts-expect-error draft registration is internal
  svelteStore.registerDraft(() => {});
  // @ts-expect-error text attachment requires a string path
  svelteStore.text(svelteStore.fields.count);
}
void typeChecks;
