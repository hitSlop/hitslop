import * as S from "../src/schema.ts";
import { paths } from "../src/paths.ts";
import { createController } from "../src/controller.ts";
import type { Host } from "../src/host.ts";
import { documentStore } from "../src/document-store.svelte.ts";

// Compiled only; every @ts-expect-error must correspond to a real strict error.
function typeChecks(host: Host, input: HTMLInputElement) {
  const schema = S.Document({ count: S.Integer(), title: S.Text(), enabled: S.Boolean(), note: S.Optional(S.String()),
    list: S.List(S.Object({ id: S.String(), done: S.Boolean() }), "id"),
    array: S.Array(S.Object({ id: S.String() })), record: S.Record(S.Number()),
  });
  const $ = paths(schema);
  const initial = { count: 0, title: "", enabled: true, list: [], array: [], record: {} };
  const store = createController({ schema, initial, host });
  store.set($.title, "valid"); store.increment($.count); store.toggle($.enabled);
  store.unset($.note); store.unset($.record.at("a.b"));
  store.insert($.list, { id: "a", done: false }, { after: "b" });
  store.set($.list.item({ id: "a" }).done, true);
  store.set($.record.at("a.b"), 1);
  store.patch($.list.item("a"), { done: true });
  // @ts-expect-error atomic arrays have no item capability
  $.array.item("a");
  // @ts-expect-error only records have dynamic at
  $.list.at("a");
  // @ts-expect-error record value must be numeric
  store.set($.record.at("a.b"), "wrong");
  // @ts-expect-error wrong scalar type must not widen path inference
  store.set($.count, "wrong");
  // @ts-expect-error wrong operator
  store.increment($.title);
  // @ts-expect-error wrong operator
  store.toggle($.count);
  // @ts-expect-error required field
  store.unset($.title);
  // @ts-expect-error insertion is only for identity lists
  store.insert($.array, { id: "a" });
  // @ts-expect-error unknown property
  store.patch($.list.item("a"), { dne: true });
  // @ts-expect-error missing item field
  store.insert($.list, { id: "a" });
  // @ts-expect-error identity key must exist
  S.List(S.Object({ id: S.String() }), "missing");
  // @ts-expect-error identity key must be a required string
  S.List(S.Object({ id: S.Optional(S.String()) }), "id");
  // @ts-expect-error identity key must be a string
  S.List(S.Object({ id: S.Number() }), "id");
  // @ts-expect-error numeric indices are not positions
  store.move($.list, "a", { index: 1 });
  // @ts-expect-error position is exclusive
  store.move($.list, "a", { before: "b", after: "c" });
  // @ts-expect-error data is deeply readonly
  store.data.list.push({ id: "a", done: true });
  const svelteStore = documentStore({ schema, initial, host });
  svelteStore.text(input, $.title);
  // @ts-expect-error text action requires a string path
  svelteStore.text(input, $.count);
}
void typeChecks;
