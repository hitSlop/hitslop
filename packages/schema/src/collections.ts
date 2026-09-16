/** Experimental collection DSL. TypeBox remains the schema authority. */
import * as S from "./document.js";
import type { TSchema, Static } from "typebox";

export type Collection = { fields: Record<string, TSchema>; indexes: Record<string, string[]> };
export type CollectionSchema = { format: "hitslop-collections-1"; collections: Record<string, Collection>; document: TSchema };
const identifier = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
export function collection<P extends Record<string, TSchema>>(fields: P) {
  const indexes: Record<string, string[]> = {};
  return { fields, indexes, index(name: string, keys: (keyof P & string)[]) {
    if (!identifier.test(name) || indexes[name] || !keys.length || new Set(keys).size !== keys.length || keys.some(k => !Object.hasOwn(fields, k))) throw new Error("Invalid collection index");
    indexes[name] = [...keys]; return this;
  } };
}
export function defineSchema(collections: Record<string, Collection>): CollectionSchema {
  const definitions: Record<string, Collection> = {}, roots: Record<string, TSchema> = {};
  for (const [name, c] of Object.entries(collections).sort()) {
    if (!identifier.test(name) || !Object.keys(c.fields).length) throw new Error("Invalid collection name or empty collection");
    for (const [field, schema] of Object.entries(c.fields)) {
      if (!identifier.test(field) || !["string", "boolean", "number", "integer"].includes(String((schema as Record<string, unknown>).type)) || (schema as Record<string, unknown>)["x-hitslop"]) throw new Error("Collection spike supports named scalar fields only; use S.String, S.Boolean, S.Number, or S.Integer");
    }
    definitions[name] = { fields: c.fields, indexes: c.indexes };
    const row = S.Object({ ...c.fields, _id: S.String(), _deleted: S.Boolean() });
    (row as unknown as Record<string, unknown>).additionalProperties = false;
    roots[name] = S.Record(row);
  }
  if (!Object.keys(roots).length) throw new Error("Define at least one collection");
  const document = S.Document(roots); (document as unknown as Record<string, unknown>).additionalProperties = false;
  return { format: "hitslop-collections-1", collections: definitions, document };
}

export type Id<C extends string> = string & { readonly __collection: C };
export type Row<T, C extends string> = T & { _id: Id<C> };
export type FindArgs<T, I extends string = string> = { where?: Partial<T>; index?: I; order?: "asc" | "desc"; limit?: number; cursor?: string };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type Reference<A, R, K extends "query" | "mutation"> = { collection: string; operation: string; kind: K; readonly __args?: A; readonly __result?: R };
export function collectionAPI<T, C extends string, I extends string = string>(name: C) {
  const ref = <A, R, K extends "query" | "mutation">(operation: string, kind: K): Reference<A, R, K> => ({ collection: name, operation, kind });
  return {
    insert: ref<T, Id<C>, "mutation">("insert", "mutation"),
    find: ref<FindArgs<T, I>, Page<Row<T, C>>, "query">("find", "query"),
    findOne: ref<{ id: Id<C> }, Row<T, C> | null, "query">("findOne", "query"),
    update: ref<{ id: Id<C>; changes: Partial<T> }, number, "mutation">("update", "mutation"),
    delete: ref<{ id: Id<C> }, number, "mutation">("delete", "mutation"),
    count: ref<{ where?: Partial<T> }, number, "query">("count", "query"),
  };
}
export type Fields<P extends Record<string, TSchema>> = { [K in keyof P]: Static<P[K]> };
