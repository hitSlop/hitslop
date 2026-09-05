import * as Type from "typebox";

export const protocolVersion = 1;
export const BridgeErrorCodeSchema = Type.Enum(["invalid_request", "unsupported", "revision_conflict", "validation_failed", "storage_error", "limit_exceeded", "closed"]);
export const BlobSchema = Type.Object({ $blob: Type.String() }, { additionalProperties: false });
export const SQLValueSchema = Type.Union([Type.Null(), Type.Boolean(), Type.Number({ minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }), Type.String(), BlobSchema]);
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
const jsonDefinitions = { json: { anyOf: [
  { type: "null" }, { type: "boolean" }, { type: "number" }, { type: "string" },
  { type: "array", items: { $ref: "#/$defs/json" } },
  { type: "object", additionalProperties: { $ref: "#/$defs/json" } },
] } };
export const JSONValueSchema = Type.Unsafe<JSONValue>({ $defs: jsonDefinitions, $ref: "#/$defs/json" });
const json = Type.Unsafe<JSONValue>({ $ref: "#/$defs/json" });
const object = <P extends Type.TProperties>(properties: P) => Type.Object(properties, { additionalProperties: false, $defs: jsonDefinitions });
const method = <P extends Type.TProperties, R extends Type.TSchema>(params: P, response: R) => ({ params: object(params), response });
const statement = { sql: Type.String({ minLength: 1 }), parameters: Type.Optional(Type.Array(SQLValueSchema)) };
const mediaName = Type.String({ pattern: "^[a-z][a-z0-9-]{0,63}$" });
const revision = object({ revision: Type.String() });
const snapshot = object({ value: json, revision: Type.String() });
// Capabilities may contain methods introduced by a newer host.
export const HostInfoSchema = object({ protocolVersion: Type.Literal(protocolVersion), capabilities: Type.Array(Type.String()) });

/** Single source for method names, wire arguments, and successful reply values. */
export const BridgeMethods = {
  "host.info": method({}, HostInfoSchema),
  log: method({ message: Type.String() }, Type.Null()),
  ready: method({}, Type.Null()),
  "json.open": method({ value: json }, snapshot),
  "json.read": method({}, snapshot),
  "json.write": method({ value: json, expectedRevision: Type.Optional(Type.String()) }, revision),
  "sqlite.query": method(statement, Type.Array(Type.Record(Type.String(), SQLValueSchema))),
  "sqlite.execute": method(statement, Type.Integer()),
  "sqlite.transaction": method({ statements: Type.Array(object(statement), { minItems: 1 }) }, Type.Integer()),
  "media.open": method({ name: mediaName }, object({ exists: Type.Boolean(), revision: Type.Union([Type.String(), Type.Null()]) })),
  "media.write": method({ name: mediaName, data: Type.String(), mimeType: Type.String() }, revision),
  "media.remove": method({ name: mediaName }, object({ revision: Type.Null() })),
  "window.resize": method({ width: Type.Integer({ minimum: 240, maximum: 4096 }), height: Type.Integer({ minimum: 180, maximum: 4096 }) }, object({ width: Type.Number({ exclusiveMinimum: 0 }), height: Type.Number({ exclusiveMinimum: 0 }) })),
  "window.drag": method({}, Type.Null()),
} as const;

export type BridgeMethod = keyof typeof BridgeMethods;
type Params<M extends BridgeMethod> = Type.Static<(typeof BridgeMethods)[M]["params"]>;
export type BridgeParams<M extends BridgeMethod> = keyof Params<M> extends never ? Record<string, never> : Params<M>;
export type BridgeResult<M extends BridgeMethod> = Type.Static<(typeof BridgeMethods)[M]["response"]>;
export type BridgeRequest = { [M in BridgeMethod]: { method: M } & Params<M> }[BridgeMethod];
export const bridgeMethodNames = Object.keys(BridgeMethods) as BridgeMethod[];
export const BridgeMethodSchema = Type.Enum(bridgeMethodNames);
// Object.entries loses key/value correlation. This annotation restores exactly
// the mapped request type constructed from the same method registry.
export const BridgeRequestSchema = Type.Unsafe<BridgeRequest>({
  $defs: jsonDefinitions,
  anyOf: Object.entries(BridgeMethods).map(([name, contract]) => object({ method: Type.Literal(name), ...contract.params.properties })),
});
export const BridgeReplySchema = Type.Union([
  object({ ok: Type.Literal(true), value: json }),
  object({ ok: Type.Literal(false), error: object({ code: BridgeErrorCodeSchema, message: Type.String() }) }),
], { $defs: jsonDefinitions });
export const ChangeSchema = object({ kind: Type.Enum(["json", "sqlite", "media"]), source: Type.Enum(["app", "external", "dev"]), revision: Type.Optional(Type.Union([Type.String(), Type.Null()])), sequence: Type.Optional(Type.Integer()), name: Type.Optional(mediaName) });
export type BridgeReply = Type.Static<typeof BridgeReplySchema>;
export type BridgeErrorCode = Type.Static<typeof BridgeErrorCodeSchema>;
export type HostInfo = Type.Static<typeof HostInfoSchema>;
export type SQLValue = Type.Static<typeof SQLValueSchema>;
export type SlopChange = Type.Static<typeof ChangeSchema>;
