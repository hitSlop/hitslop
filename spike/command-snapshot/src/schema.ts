/** Thin type-only adaptation; runtime schemas and validation remain canonical. */
import type * as Type from "typebox";
import * as Canonical from "../../../packages/schema/src/document.ts";
export * from "../../../packages/schema/src/document.ts";
export { assertJSON } from "../../../packages/schema/src/json.ts";

declare const listBrand: unique symbol;
declare const recordBrand: unique symbol;
export type ListSchema<I extends Type.TSchema, K extends string> = Type.TArray<I> & {
  readonly [listBrand]: { item: I; key: K };
};
export type RecordSchema<V extends Type.TSchema> = Type.TSchema & {
  readonly [recordBrand]: V;
};
type StringKeys<I extends Type.TSchema> = {
  [K in keyof Type.Static<I>]-?: Type.Static<I>[K] extends string ? K : never;
}[keyof Type.Static<I>] & string;

export function List<I extends Type.TObject, const K extends StringKeys<I>>(item: I, key: K) {
  return Canonical.List(item, key) as ListSchema<I, K>;
}
export function Record<V extends Type.TSchema>(value: V) {
  return Canonical.Record(value) as ReturnType<typeof Canonical.Record<V>> & RecordSchema<V>;
}
