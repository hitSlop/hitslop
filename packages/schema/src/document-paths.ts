import type { Static, TSchema, TObject, TOptional } from "typebox";
import type { ListSchema, RecordSchema, AtomicSchema, MapSchema } from "./document.js";
import { documentMeta, recordValueSchema } from "./document.js";
import type { Step } from "./document-protocol.js";

export const pathInfo: unique symbol = Symbol("hitSlop inert path");
export type Address<S extends TSchema = TSchema, Removable extends boolean = boolean> = {
  readonly [pathInfo]: {
    readonly schema: S;
    readonly root: TSchema;
    readonly steps: readonly Step[];
    readonly removable: Removable;
  };
};
export type Path<S extends TSchema, D extends boolean = false> = Address<S, D> &
  (S extends AtomicSchema<TSchema>
    ? {}
    : S extends ListSchema<infer I, infer K>
      ? { item(row: string | Readonly<Record<K, string>>): Path<I> }
      : S extends RecordSchema<infer V>
        ? { at(key: string): Path<V, true> }
        : S extends MapSchema<infer P>
          ? { readonly [K in keyof P]-?: Path<P[K], P[K] extends TOptional ? true : false> }
          : {});
export type PathValue<P extends Address> = Static<P[typeof pathInfo]["schema"]>;
export type ReadonlyJSON<T> = T extends object
  ? { readonly [K in keyof T]: ReadonlyJSON<T[K]> }
  : T;
export type SchemaNode = TSchema & {
  type?: string;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  patternProperties?: Record<string, SchemaNode>;
};

/** Null-prototype nodes plus lazy getters; no Proxy and no writer attached. */
export function paths<S extends TSchema>(schema: S): Path<S> {
  function node(current: SchemaNode, steps: readonly Step[], removable: boolean): Address {
    const result = Object.create(null) as Address;
    Object.defineProperty(result, pathInfo, {
      value: Object.freeze({
        schema: current,
        root: schema,
        steps: Object.freeze(steps.map((step) => Object.freeze(step))),
        removable,
      }),
    });
    const meta = documentMeta(current);
    if (meta?.container === "list") {
      Object.defineProperty(result, "item", {
        value: (row: string | Record<string, unknown>) => {
          const id = typeof row === "string" ? row : row[meta.key!];
          if (typeof id !== "string" || !id)
            throw new Error("List identity must be a non-empty string");
          return node(current.items!, [...steps, { item: id }], false);
        },
      });
    } else if (meta?.container === "record") {
      Object.defineProperty(result, "at", {
        value: (key: string) => {
          if (typeof key !== "string") throw new Error("Record key must be a string");
          return node(recordValueSchema(current), [...steps, { key }], true);
        },
      });
    } else if (meta?.container === "map" && current.properties) {
      for (const [key, child] of Object.entries(current.properties)) {
        let cached: Address | undefined;
        Object.defineProperty(result, key, {
          enumerable: true,
          get: () =>
            (cached ??= node(child, [...steps, { key }], !current.required?.includes(key))),
        });
      }
    }
    return Object.freeze(result);
  }
  return node(schema, [], false) as Path<S>;
}

// Confirmed arrays are immutable. Cache identity lookup per array (and declared
// key), so N text bindings do not each scan N rows after every publication.
const listIndexes = new WeakMap<readonly unknown[], Map<string, Map<string, unknown>>>();
function itemValue(list: unknown, key: string | undefined, id: string): unknown {
  if (!Array.isArray(list) || !key) return undefined;
  if (!Object.isFrozen(list)) return list.find((item) => item?.[key] === id);
  let indexes = listIndexes.get(list);
  if (!indexes) {
    indexes = new Map();
    listIndexes.set(list, indexes);
  }
  let index = indexes.get(key);
  if (!index) {
    if (!list.every((item) => Object.isFrozen(item)))
      return list.find((item) => item?.[key] === id);
    index = new Map(list.map((item) => [item?.[key], item]));
    indexes.set(key, index);
  }
  return index.get(id);
}

export function read<P extends Address>(
  data: unknown,
  path: P,
): ReadonlyJSON<PathValue<P>> | undefined {
  let value: any = data;
  let schema = path[pathInfo].root as SchemaNode;
  for (const step of path[pathInfo].steps) {
    if ("key" in step) {
      value = value && Object.hasOwn(value, step.key) ? value[step.key] : undefined;
      schema =
        schema.properties?.[step.key] ??
        (documentMeta(schema)?.container === "record" ? recordValueSchema(schema) : undefined) ??
        {};
    } else {
      const key = documentMeta(schema)?.key;
      value = itemValue(value, key, step.item);
      schema = schema.items ?? {};
    }
  }
  return value;
}
