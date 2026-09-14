import * as Type from "typebox";
import type { Static, TSchema } from "typebox";
import { hitslopSyncKeyword } from "./keywords.js";
import { validate } from "./validation.js";

export type { Static };

export type SyncMeta = {
  version?: 1;
  container: "map" | "movable-list" | "text" | "atomic" | "record";
  key?: string;
};

export type SyncNode =
  | { container: "map"; fields: Record<string, SyncNode> }
  | { container: "movable-list"; key: string; item: SyncNode }
  | { container: "record"; values: SyncNode }
  | { container: "text" }
  | { container: "atomic" };

type SchemaObject = Record<string, unknown>;
const isArray = globalThis.Array.isArray;
const objectEntries = globalThis.Object.entries;

const mark = <S extends TSchema>(schema: S, meta: SyncMeta): S => {
  (schema as SchemaObject)[hitslopSyncKeyword] = meta;
  return schema;
};

const objectOptions = { additionalProperties: true as const };

export const String = (options?: Parameters<typeof Type.String>[0]) => Type.String(options);
export const Text = (options?: Parameters<typeof Type.String>[0]) =>
  mark(Type.String(options), { container: "text" });
export const Boolean = (options?: Parameters<typeof Type.Boolean>[0]) => Type.Boolean(options);
export const Number = (options?: Parameters<typeof Type.Number>[0]) => Type.Number(options);
export const Integer = (options?: Parameters<typeof Type.Integer>[0]) => Type.Integer(options);
export const Null = (options?: Parameters<typeof Type.Null>[0]) => Type.Null(options);
export const Literal = Type.Literal.bind(Type) as typeof Type.Literal;
export const Union = Type.Union.bind(Type) as typeof Type.Union;

export const Atomic = <S extends TSchema>(schema: S): S => mark(schema, { container: "atomic" });

export const Object = <P extends Type.TProperties>(properties: P) =>
  mark(Type.Object(properties, objectOptions), { container: "map" });

export const Document = <P extends Type.TProperties>(properties: P) =>
  mark(Type.Object(properties, objectOptions), { version: 1, container: "map" });

export const Array = <S extends TSchema>(items: S) =>
  mark(Type.Array(items), { container: "atomic" });

export const Record = <S extends TSchema>(values: S) =>
  mark(Type.Record(Type.String(), values), { container: "record" });

export const List = <S extends TSchema>(items: S, key: string) => {
  const properties = (items as SchemaObject).properties;
  if (!properties || typeof properties !== "object" || isArray(properties) || !(key in properties)) {
    throw new Error(`S.List key "${key}" must be a property of the item object`);
  }
  return mark(Type.Array(items), { container: "movable-list", key });
};

export const syncMeta = (schema: unknown): SyncMeta | undefined => {
  if (!schema || typeof schema !== "object" || isArray(schema)) return undefined;
  const meta = (schema as SchemaObject)[hitslopSyncKeyword];
  if (!meta || typeof meta !== "object" || isArray(meta)) return undefined;
  return meta as SyncMeta;
};

export const syncMapping = (schema: unknown): SyncNode => {
  if (!schema || typeof schema !== "object" || isArray(schema)) return { container: "atomic" };
  const node = schema as SchemaObject;
  const meta = syncMeta(node);
  if (meta?.container === "atomic") return { container: "atomic" };
  if (meta?.container === "text") return { container: "text" };
  if (meta?.container === "movable-list") {
    if (!meta.key) throw new Error("movable-list mapping requires key");
    return { container: "movable-list", key: meta.key, item: syncMapping(node.items) };
  }
  if (meta?.container === "record") {
    const patterns = node.patternProperties;
    if (!patterns || typeof patterns !== "object" || isArray(patterns)) throw new Error("record mapping requires patternProperties");
    const entries = objectEntries(patterns);
    if (entries.length !== 1 || entries[0]?.[0] !== "^.*$" || !entries[0][1] || typeof entries[0][1] !== "object") {
      throw new Error("record mapping supports one unrestricted string-key value schema");
    }
    return { container: "record", values: syncMapping(entries[0][1]) };
  }
  if (meta?.container === "map" || (node.type === "object" && node.properties && typeof node.properties === "object")) {
    const fields: Record<string, SyncNode> = {};
    for (const [name, field] of objectEntries((node.properties ?? {}) as Record<string, unknown>)) {
      fields[name] = syncMapping(field);
    }
    return { container: "map", fields };
  }
  return { container: "atomic" };
};

export const collectListKeys = (mapping: SyncNode, path = ""): { path: string; key: string }[] => {
  if (mapping.container === "movable-list") {
    return [{ path, key: mapping.key }, ...collectListKeys(mapping.item, path ? `${path}[]` : "[]")];
  }
  if (mapping.container === "map") {
    return objectEntries(mapping.fields).flatMap(([name, field]) =>
      collectListKeys(field, path ? `${path}.${name}` : name),
    );
  }
  if (mapping.container === "record") return collectListKeys(mapping.values, path);
  return [];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !isArray(value) ? value as Record<string, unknown> : null;

export const assertUniqueListIds = (mapping: SyncNode, value: unknown, path = "value"): void => {
  if (mapping.container === "map") {
    const object = asRecord(value);
    if (!object) return;
    for (const [name, field] of objectEntries(mapping.fields)) assertUniqueListIds(field, object[name], `${path}.${name}`);
    return;
  }
  if (mapping.container === "record") {
    const object = asRecord(value);
    if (!object) return;
    for (const [name, child] of objectEntries(object)) assertUniqueListIds(mapping.values, child, `${path}.${name}`);
    return;
  }
  if (mapping.container !== "movable-list" || !isArray(value)) return;
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    const object = asRecord(item);
    const id = object?.[mapping.key];
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`${path}[${index}].${mapping.key} must be a non-empty string`);
    }
    if (seen.has(id)) throw new Error(`${path} contains duplicate ${mapping.key} "${id}"`);
    seen.add(id);
    assertUniqueListIds(mapping.item, item, `${path}[${index}]`);
  }
};

export const validateDocument = <S extends TSchema>(schema: S, value: unknown): Static<S> => {
  const mapping = syncMapping(schema);
  if (mapping.container !== "map") throw new Error("Document schema root must be S.Document or S.Object");
  const checked = validate(schema, value);
  assertUniqueListIds(mapping, checked);
  return checked;
};

/** Only explicitly marked documents opt into the versioned disk format. */
export const isSyncSchema = (schema: unknown): boolean => syncMeta(schema)?.version === 1;
export const envelopeSchema = <S extends TSchema>(schema: S) => Type.Object({
  $slop: Type.Object({ format: Type.Literal(1), baseRevision: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
  data: schema,
}, { additionalProperties: false });
