import * as Type from "typebox";
import type { Static, TSchema } from "typebox";
import { hitslopSyncKeyword } from "./keywords.js";
import { assertJSON, validate } from "./validation.js";

export type { Static };

export type SyncMeta = {
  version?: 1;
  container: "map" | "movable-list" | "text" | "atomic" | "record";
  key?: string;
  media?: true;
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

export const Optional = <S extends TSchema>(schema: S) => {
  const optional = Type.Optional(schema);
  const meta = syncMeta(schema);
  if (meta) mark(optional as unknown as TSchema, meta);
  return optional;
};

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
  if (
    !properties ||
    typeof properties !== "object" ||
    isArray(properties) ||
    !(key in properties)
  ) {
    throw new Error(`S.List key "${key}" must be a property of the item object`);
  }
  return mark(Type.Array(items), { container: "movable-list", key });
};

/** Content-addressed media descriptor. Bytes live in the host cache / R2, never in Loro. */
export const Media = () =>
  mark(
    Type.Object(
      {
        sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
        mime: Type.String({ minLength: 1, maxLength: 127 }),
        filename: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
        bytes: Type.Optional(Type.Integer({ minimum: 1 })),
      },
      { additionalProperties: true },
    ),
    { container: "atomic", media: true },
  );

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
    if (!patterns || typeof patterns !== "object" || isArray(patterns))
      throw new Error("record mapping requires patternProperties");
    const entries = objectEntries(patterns);
    if (
      entries.length !== 1 ||
      entries[0]?.[0] !== "^.*$" ||
      !entries[0][1] ||
      typeof entries[0][1] !== "object"
    ) {
      throw new Error("record mapping supports one unrestricted string-key value schema");
    }
    return { container: "record", values: syncMapping(entries[0][1]) };
  }
  if (
    meta?.container === "map" ||
    (node.type === "object" && node.properties && typeof node.properties === "object")
  ) {
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
    return [
      { path, key: mapping.key },
      ...collectListKeys(mapping.item, path ? `${path}[]` : "[]"),
    ];
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
  value && typeof value === "object" && !isArray(value) ? (value as Record<string, unknown>) : null;

export const assertUniqueListIds = (mapping: SyncNode, value: unknown, path = "value"): void => {
  if (mapping.container === "map") {
    const object = asRecord(value);
    if (!object) return;
    for (const [name, field] of objectEntries(mapping.fields))
      assertUniqueListIds(field, object[name], `${path}.${name}`);
    return;
  }
  if (mapping.container === "record") {
    const object = asRecord(value);
    if (!object) return;
    for (const [name, child] of objectEntries(object))
      assertUniqueListIds(mapping.values, child, `${path}.${name}`);
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

// Document schemas are deterministic, immutable contracts for the store lifetime.
const documentMappings = new WeakMap<TSchema, SyncNode>();
export const validateDocument = <S extends TSchema>(schema: S, value: unknown): Static<S> => {
  if (!isSyncSchema(schema) || syncMeta(schema)?.container !== "map")
    throw new Error("Document schema root must be S.Document v1");
  assertJSON(value, new Set(), 64);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 1024 * 1024)
    throw new Error("Document JSON exceeds 1 MiB");
  let mapping = documentMappings.get(schema);
  if (!mapping) {
    mapping = syncMapping(schema);
    documentMappings.set(schema, mapping);
  }
  const checked = validate(schema, value);
  assertUniqueListIds(mapping, checked);
  return checked;
};

/** JSON documents require the v1 S.Document marker. */
export const isSyncSchema = (schema: unknown): boolean => syncMeta(schema)?.version === 1;

/** Accept only the generated v1 disk-envelope schema at package boundaries. */
export const applicationSchema = (schema: unknown): TSchema => {
  const node = asRecord(schema);
  const properties = asRecord(node?.properties);
  const metadata = asRecord(properties?.$slop);
  const fields = asRecord(metadata?.properties);
  const required = node?.required;
  const metadataRequired = metadata?.required;
  const data = properties?.data;
  if (
    node?.type !== "object" ||
    node.additionalProperties !== false ||
    !isArray(required) ||
    required.length !== 2 ||
    !required.includes("$slop") ||
    !required.includes("data") ||
    !properties ||
    objectEntries(properties).length !== 2 ||
    metadata?.type !== "object" ||
    metadata.additionalProperties !== false ||
    !isArray(metadataRequired) ||
    metadataRequired.length !== 2 ||
    !metadataRequired.includes("format") ||
    !metadataRequired.includes("baseRevision") ||
    !fields ||
    objectEntries(fields).length !== 2 ||
    asRecord(fields.format)?.const !== 1 ||
    asRecord(fields.baseRevision)?.type !== "string" ||
    asRecord(fields.baseRevision)?.minLength !== 1 ||
    asRecord(data)?.type !== "object" ||
    !isSyncSchema(data) ||
    syncMeta(data)?.container !== "map"
  ) {
    throw new Error("Expected a v1 document envelope schema generated from S.Document");
  }
  return data as TSchema;
};

export const envelopeSchema = <S extends TSchema>(schema: S) =>
  Type.Object(
    {
      $slop: Type.Object(
        { format: Type.Literal(1), baseRevision: Type.String({ minLength: 1 }) },
        { additionalProperties: false },
      ),
      data: schema,
    },
    { additionalProperties: false },
  );
