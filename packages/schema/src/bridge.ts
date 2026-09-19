import { MediaHashSchema, MediaReferenceSchema } from "./media.js";
export type { MediaReference } from "./media.js";
import {
  SnapshotSchema,
  OpenSchema,
  ResultSchema,
  RequestSchema,
  LeaseSchema,
} from "./document-protocol.js";
import * as Type from "typebox";

export const protocolVersion = 1;
export const BridgeErrorCodeSchema = Type.Enum([
  "invalid_request",
  "unsupported",
  "validation_failed",
  "storage_error",
  "limit_exceeded",
  "closed",
]);
import type { JSONValue } from "./json.js";
export type { JSONValue } from "./json.js";
// Envelopes validate shape; bridge boundaries check plain JSON once. Application
// schemas validate document contents. Do not recursively recheck every envelope.
const json = Type.Unsafe<JSONValue>({});
const object = <P extends Type.TProperties>(properties: P) =>
  Type.Object(properties, { additionalProperties: false });
const method = <P extends Type.TProperties, R extends Type.TSchema>(params: P, response: R) => ({
  params: object(params),
  response,
});
export const DocumentFrameSchema = object({
  snapshot: SnapshotSchema,
  connected: Type.Boolean(),
  writable: Type.Boolean(),
  error: Type.Optional(Type.String()),
  projectionError: Type.Optional(Type.String()),
  handoffFrom: Type.Optional(Type.String()),
  lease: Type.Optional(LeaseSchema),
});
// Capabilities may contain methods introduced by a newer host.
export const HostInfoSchema = object({
  protocolVersion: Type.Literal(protocolVersion),
  capabilities: Type.Array(Type.String()),
});

export const RuntimeIssueSchema = object({
  source: Type.Enum(["document", "media", "render", "unhandled"]),
  code: Type.Optional(Type.String({ maxLength: 128 })),
  message: Type.String({ minLength: 1, maxLength: 4096 }),
});
export type RuntimeIssue = Type.Static<typeof RuntimeIssueSchema>;

/** Single source for method names, wire arguments, and successful reply values. */
export const BridgeMethods = {
  "host.info": method({}, HostInfoSchema),
  "runtime.reportError": method({ issue: RuntimeIssueSchema }, Type.Null()),
  log: method({ message: Type.String() }, Type.Null()),
  ready: method({}, Type.Null()),
  "document.open": method({}, OpenSchema),
  "document.execute": method({ request: RequestSchema }, ResultSchema),
  "document.flush": method({}, Type.Null()),
  "media.open": method(
    { sha256: MediaHashSchema },
    object({ src: Type.Union([Type.String(), Type.Null()]) }),
  ),
  "media.add": method(
    { data: Type.String(), kind: Type.Enum(["image", "file"]) },
    MediaReferenceSchema,
  ),
  "window.resize": method(
    {
      width: Type.Integer({ minimum: 240, maximum: 4096 }),
      height: Type.Integer({ minimum: 180, maximum: 4096 }),
    },
    object({
      width: Type.Number({ exclusiveMinimum: 0 }),
      height: Type.Number({ exclusiveMinimum: 0 }),
    }),
  ),
} as const;

export type BridgeMethod = keyof typeof BridgeMethods;
type Params<M extends BridgeMethod> = Type.Static<(typeof BridgeMethods)[M]["params"]>;
export type BridgeParams<M extends BridgeMethod> = keyof Params<M> extends never
  ? Record<string, never>
  : Params<M>;
export type BridgeResult<M extends BridgeMethod> = Type.Static<
  (typeof BridgeMethods)[M]["response"]
>;
export type BridgeRequest = { [M in BridgeMethod]: { method: M } & Params<M> }[BridgeMethod];
export const bridgeMethodNames = Object.keys(BridgeMethods) as BridgeMethod[];
export const BridgeMethodSchema = Type.Enum(bridgeMethodNames);
// Object.entries loses key/value correlation. This annotation restores exactly
// the mapped request type constructed from the same method registry.
export const BridgeRequestSchema = Type.Unsafe<BridgeRequest>({
  anyOf: Object.entries(BridgeMethods).map(([name, contract]) =>
    object({ method: Type.Literal(name), ...contract.params.properties }),
  ),
});
export const BridgeReplySchema = Type.Union([
  object({ ok: Type.Literal(true), value: json }),
  object({
    ok: Type.Literal(false),
    error: object({ code: BridgeErrorCodeSchema, message: Type.String() }),
  }),
]);
export const ChangeSchema = object({
  kind: Type.Literal("media"),
  source: Type.Enum(["app", "external", "dev"]),
  revision: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  sequence: Type.Optional(Type.Integer()),
  sha256: Type.Optional(MediaHashSchema),
});
export type BridgeReply = Type.Static<typeof BridgeReplySchema>;
export type BridgeErrorCode = Type.Static<typeof BridgeErrorCodeSchema>;
export type HostInfo = Type.Static<typeof HostInfoSchema>;
export type SlopChange = Type.Static<typeof ChangeSchema>;

export type DocumentFrame = Type.Static<typeof DocumentFrameSchema>;
