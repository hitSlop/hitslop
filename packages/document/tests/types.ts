import { defineDocument, s } from "../src/schema";
import type { Document } from "../src/document";
const schema = defineDocument({
  title: s.text(),
  currency: s.enum(["CAD", "USD"]),
  tasks: s.list(
    s.object({
      text: s.text(),
      done: s.boolean(),
      note: s.optional(s.string()),
      amount: s.number(),
    }),
  ),
});
export function authoringTypes(doc: Document<typeof schema.fields.node>) {
  doc.text(schema.fields.title).replace("Fine");
  doc.set(schema.fields.currency, "CAD");
  doc.insert(schema.fields.tasks, { text: "x", done: false, amount: 100 });
  doc.clear(schema.fields.tasks.item("id").note);
  // @ts-expect-error Text is not a scalar register
  doc.set(schema.fields.title, "wrong API");
  // @ts-expect-error Unknown enum variant
  doc.set(schema.fields.currency, "GBP");
  // @ts-expect-error Only optional scalars can be cleared
  doc.clear(schema.fields.currency);
  // @ts-expect-error Nested boolean requires boolean
  doc.set(schema.fields.tasks.item("id").done, "true");
  // @ts-expect-error Required values cannot be omitted
  doc.insert(schema.fields.tasks, { text: "Missing done" });
  // @ts-expect-error Only scalar fields can be optional
  s.optional(s.text());
  // @ts-expect-error Lists require objects
  s.list(s.string());
}

export function handleTypes(doc: Document<typeof schema.fields.node>) {
  const { title, currency, tasks } = doc.fields;
  title.replace("Packing");
  currency.set("USD");
  const { id } = tasks.insert({ text: "x", done: false, amount: 100 });
  tasks.item(id).note.set("optional");
  tasks.item(id).note.clear();
  const inserted: string = doc.transaction((tx) => {
    const { id } = tx.fields.tasks.insert({ text: "x", done: false, amount: 100 });
    tx.fields.tasks.item(id).done.set(true);
    return id;
  });
  tasks.remove(inserted);
  // @ts-expect-error Text handles do not expose scalar set
  title.set("wrong");
  // @ts-expect-error Scalars do not expose replace
  tasks.item(id).done.replace("wrong");
  // @ts-expect-error Clear is only on optional scalar handles
  currency.clear();
  // @ts-expect-error Invalid enum variant
  currency.set("GBP");
  // @ts-expect-error Explicit clear rather than undefined assignment
  tasks.item(id).note.set(undefined);
  // @ts-expect-error Required row values cannot be omitted
  tasks.insert({ text: "missing values" });
  // @ts-expect-error Handle values are not readable snapshots
  tasks.item(id).done.value;
}
