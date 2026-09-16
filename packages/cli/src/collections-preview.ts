import { validate } from "@hitslop/schema/validation";
import type { CollectionSchema } from "@hitslop/schema/collections";

/** Browser-only, disposable adapter. Never included by the native build. */
export function installPreview(schema: CollectionSchema) {
  let data: Record<string, Record<string, any>> = Object.fromEntries(Object.keys(schema.collections).map(n => [n, {}]));
  (window as any).__slopCollections = { async request(r: any) {
    const definition = schema.collections[r.collection], args = r.args ?? {};
    if (!definition) throw new Error("Unknown collection");
    const rows = data[r.collection]!;
    if (["insert", "update", "delete"].includes(r.operation)) {
      const next = structuredClone(data), records = next[r.collection]!; let result: string | number;
      if (r.operation === "insert") {
        if (Object.keys(args).some(k => !Object.hasOwn(definition.fields, k))) throw new Error("Unknown field");
        result = crypto.randomUUID(); records[result] = { ...args, _id: result, _deleted: false };
      } else {
        const row = records[args.id]; result = row && !row._deleted ? 1 : 0;
        if (result) {
          if (r.operation === "delete") row._deleted = true;
          else { if (!args.changes || Object.keys(args.changes).some(k => !Object.hasOwn(definition.fields, k))) throw new Error("Unknown field"); Object.assign(row, args.changes); }
        }
      }
      validate(schema.document, next); data = next;
      window.dispatchEvent(new Event("slop-collections-change")); return result;
    }
    let records = Object.values(rows).filter(row => !row._deleted);
    const publicRow = ({ _deleted, ...row }: any) => row;
    if (r.operation === "findOne") return rows[args.id] && !rows[args.id]._deleted ? publicRow(rows[args.id]) : null;
    for (const [field, value] of Object.entries(args.where ?? {})) {
      if (!Object.hasOwn(definition.fields, field)) throw new Error("Unknown filter field");
      validate(definition.fields[field]!, value); records = records.filter(row => row[field] === value);
    }
    if (r.operation === "count") return records.length;
    if (r.operation !== "find") throw new Error("Unknown operation");
    if (args.index && !definition.indexes[args.index]) throw new Error("Unknown index");
    const fields = [...(definition.indexes[args.index] ?? []), "_id"], direction = args.order === "desc" ? -1 : 1;
    const compare = (a: any, b: any) => { for (const f of fields) { if (a[f] < b[f]) return -direction; if (a[f] > b[f]) return direction; } return 0; };
    records.sort(compare);
    const binding = JSON.stringify([r.collection, args.where ?? {}, args.index, args.order]);
    if (args.cursor) { const cursor = JSON.parse(atob(args.cursor)); if (cursor.binding !== binding) throw new Error("Cursor does not match query"); records = records.filter(row => compare(row, cursor.row) > 0); }
    const limit = args.limit ?? 50; if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Limit must be 1–200");
    const items = records.slice(0, limit);
    return { items: items.map(publicRow), nextCursor: records.length > limit ? btoa(JSON.stringify({ binding, row: Object.fromEntries(fields.map(f => [f, items.at(-1)[f]])) })) : null };
  } };
}
