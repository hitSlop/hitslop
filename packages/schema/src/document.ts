import { MediaReferenceSchema } from "./media.js";
export type { MediaReference } from "./media.js";
import * as Type from "typebox";
import type { Static, TSchema } from "typebox";
import { hitslopDocumentKeyword } from "./keywords.js";
import { assertJSON, validate } from "./validation.js";

export type { Static };
export { paths, read, pathInfo } from "./document-paths.js";
export type { Address, Path, PathValue, ReadonlyJSON, SchemaNode } from "./document-paths.js";

declare const mapBrand: unique symbol;
export type MapSchema<P extends Type.TProperties> = Type.TObject<P> & { readonly [mapBrand]: true };
declare const listBrand: unique symbol;
declare const recordBrand: unique symbol;
declare const atomicBrand: unique symbol;
export type AtomicSchema<I extends Type.TSchema> = I & { readonly [atomicBrand]: true };
export type ListSchema<I extends Type.TSchema, K extends string> = Type.TArray<I> & {
  readonly [listBrand]: { item: I; key: K };
};
export type RecordSchema<V extends Type.TSchema> = Type.TSchema & { readonly [recordBrand]: V };
type StringKeys<I extends Type.TSchema> = {
  [K in keyof Type.Static<I>]-?: Type.Static<I>[K] extends string ? K : never;
}[keyof Type.Static<I>] &
  string;

export type DocumentMeta = {
  version?: 1;
  container: "map" | "list" | "atomic" | "record";
  key?: string;
  media?: true;
};

export type DocumentMapping =
  | { container: "map"; fields: Record<string, DocumentMapping> }
  | { container: "list"; key: string; item: DocumentMapping }
  | { container: "record"; values: DocumentMapping }
  | { container: "atomic" };

type SchemaObject = Record<string, unknown>;
const isArray = globalThis.Array.isArray;
const objectEntries = globalThis.Object.entries;

const mark = <S extends TSchema>(schema: S, meta: DocumentMeta): S => {
  (schema as SchemaObject)[hitslopDocumentKeyword] = meta;
  return schema;
};

const objectOptions = { additionalProperties: true as const };

export const String = (options?: Parameters<typeof Type.String>[0]) => Type.String(options);
export const Boolean = (options?: Parameters<typeof Type.Boolean>[0]) => Type.Boolean(options);
export const Number = (options?: Parameters<typeof Type.Number>[0]) => Type.Number(options);
export const Integer = (options?: Parameters<typeof Type.Integer>[0]) => Type.Integer(options);
export const Null = (options?: Parameters<typeof Type.Null>[0]) => Type.Null(options);
export const Literal = Type.Literal.bind(Type) as typeof Type.Literal;
export const Union = Type.Union.bind(Type) as typeof Type.Union;

export const Atomic = <S extends TSchema>(schema: S): AtomicSchema<S> =>
  mark(schema, { container: "atomic" }) as AtomicSchema<S>;

export const Optional = <S extends TSchema>(schema: S) => {
  const optional = Type.Optional(schema);
  const meta = documentMeta(schema);
  if (meta) mark(optional as unknown as TSchema, meta);
  return optional;
};

export const Object = <P extends Type.TProperties>(properties: P) =>
  mark(Type.Object(properties, objectOptions), { container: "map" }) as MapSchema<P>;

export const Document = <P extends Type.TProperties>(properties: P) =>
  mark(Type.Object(properties, objectOptions), { version: 1, container: "map" }) as MapSchema<P>;

export const Array = <S extends TSchema>(items: S) =>
  mark(Type.Array(items), { container: "atomic" });

/** Every JSON property name, including line terminators and the empty string. */
export const recordKeyPattern = "^[\\s\\S]*$";

/** Shared by mappings, paths and interpreters. Old bundles must be rebuilt. */
export function recordValueSchema(schema: unknown): TSchema {
  const patterns = (schema as SchemaObject)?.patternProperties;
  if (!patterns || typeof patterns !== "object" || isArray(patterns))
    throw new Error("Record schema requires rebuilding with the current S.Record");
  const entries = objectEntries(patterns);
  if (
    entries.length !== 1 ||
    entries[0]?.[0] !== recordKeyPattern ||
    !entries[0][1] ||
    typeof entries[0][1] !== "object" ||
    isArray(entries[0][1])
  )
    throw new Error("Record schema requires rebuilding with the current S.Record");
  return entries[0][1] as TSchema;
}

export const Record = <S extends TSchema>(values: S) =>
  mark(Type.Record(Type.String({ pattern: recordKeyPattern }), values), {
    container: "record",
  }) as ReturnType<typeof Type.Record<Type.TString, S>> & RecordSchema<S>;

export const List = <
  S extends Type.TSchema & { properties: Type.TProperties; required?: readonly string[] },
  const K extends StringKeys<S>,
>(
  items: S,
  key: K,
): ListSchema<S, K> => {
  const properties = (items as SchemaObject).properties;
  if (
    !properties ||
    typeof properties !== "object" ||
    isArray(properties) ||
    !globalThis.Object.hasOwn(properties, key)
  ) {
    throw new Error(`S.List key "${key}" must be a property of the item object`);
  }
  const identity = (properties as SchemaObject)[key] as SchemaObject;
  if (identity.type !== "string" || !items.required?.includes(key)) {
    throw new Error(`S.List key "${key}" must be a required string property`);
  }
  return mark(Type.Array(items), { container: "list", key }) as ListSchema<S, K>;
};

/** Content-addressed media descriptor. Bytes live in the host cache / R2, outside the JSON document. */
declare const mediaBrand: unique symbol;
export type MediaSchema = typeof MediaReferenceSchema & { readonly [mediaBrand]: true };
export const Media = (): MediaSchema =>
  mark(structuredClone(MediaReferenceSchema), { container: "atomic", media: true }) as MediaSchema;

export const documentMeta = (schema: unknown): DocumentMeta | undefined => {
  if (!schema || typeof schema !== "object" || isArray(schema)) return undefined;
  const meta = (schema as SchemaObject)[hitslopDocumentKeyword];
  if (!meta || typeof meta !== "object" || isArray(meta)) return undefined;
  return meta as DocumentMeta;
};

export const documentMapping = (schema: unknown): DocumentMapping => {
  if (!schema || typeof schema !== "object" || isArray(schema)) return { container: "atomic" };
  const node = schema as SchemaObject;
  const meta = documentMeta(node);
  if (
    node[hitslopDocumentKeyword] !== undefined &&
    (!meta || !["atomic", "map", "record", "list"].includes(meta.container))
  )
    throw new Error("Unsupported x-hitslop container");
  if (meta?.container === "atomic") return { container: "atomic" };
  if (meta?.container === "list") {
    if (!meta.key) throw new Error("list mapping requires key");
    return { container: "list", key: meta.key, item: documentMapping(node.items) };
  }
  if (meta?.container === "record") {
    return { container: "record", values: documentMapping(recordValueSchema(node)) };
  }
  if (meta?.container === "map") {
    const fields: Record<string, DocumentMapping> = globalThis.Object.create(null);
    for (const [name, field] of objectEntries((node.properties ?? {}) as Record<string, unknown>)) {
      fields[name] = documentMapping(field);
    }
    return { container: "map", fields };
  }
  return { container: "atomic" };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !isArray(value) ? (value as Record<string, unknown>) : null;

// Document schemas are deterministic, immutable contracts for the store lifetime.
const documentMappings = new WeakMap<TSchema, DocumentMapping>();
const encoder = new TextEncoder();
/** Serialize once; authorities may reuse json for persistence and snapshot encoding. */
export const prepareDocument = <S extends TSchema>(
  schema: S,
  value: unknown,
): { data: Static<S>; json: string; bytes: number } => {
  if (!isDocumentSchema(schema) || documentMeta(schema)?.container !== "map")
    throw new Error("Document schema root must be S.Document v1");
  let mapping = documentMappings.get(schema);
  if (!mapping) {
    mapping = documentMapping(schema);
    documentMappings.set(schema, mapping);
  }
  assertJSON(value, new Set(), 64, mapping);
  const checked = validate(schema, value);
  const json = JSON.stringify(checked),
    bytes = encoder.encode(json).byteLength;
  if (bytes > 1024 * 1024) throw new Error("Document JSON exceeds 1 MiB");
  return { data: checked, json, bytes };
};
export const validateDocument = <S extends TSchema>(schema: S, value: unknown): Static<S> =>
  prepareDocument(schema, value).data;

/** JSON documents require the v1 S.Document marker. */
export const isDocumentSchema = (schema: unknown): boolean => documentMeta(schema)?.version === 1;

/** Accept only the generated v2 disk-envelope schema at package boundaries. */
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
    metadataRequired.length !== 5 ||
    !metadataRequired.includes("format") ||
    !metadataRequired.includes("baseRevision") ||
    !fields ||
    objectEntries(fields).length !== 5 ||
    asRecord(fields.format)?.const !== 2 ||
    asRecord(fields.baseRevision)?.type !== "integer" ||
    asRecord(fields.baseRevision)?.minimum !== 0 ||
    asRecord(fields.baseRevision)?.maximum !== globalThis.Number.MAX_SAFE_INTEGER ||
    ["documentId", "schemaHash", "authority"].some(
      (key) =>
        !metadataRequired.includes(key) ||
        asRecord(fields[key])?.type !== "string" ||
        asRecord(fields[key])?.minLength !== 1,
    ) ||
    asRecord(data)?.type !== "object" ||
    !isDocumentSchema(data) ||
    documentMeta(data)?.container !== "map"
  ) {
    throw new Error("Expected a v2 document envelope schema generated from S.Document");
  }
  return data as TSchema;
};

export const envelopeSchema = <S extends TSchema>(schema: S) =>
  Type.Object(
    {
      $slop: Type.Object(
        {
          format: Type.Literal(2),
          baseRevision: Type.Integer({ minimum: 0, maximum: globalThis.Number.MAX_SAFE_INTEGER }),
          documentId: Type.String({ minLength: 1 }),
          schemaHash: Type.String({ minLength: 1 }),
          authority: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
      data: schema,
    },
    { additionalProperties: false },
  );
