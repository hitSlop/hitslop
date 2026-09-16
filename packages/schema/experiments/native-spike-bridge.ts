import * as Type from "typebox";
import { JSONValueSchema, type JSONValue } from "../src/bridge";

// Type.Unsafe retains schema options at runtime without exposing them in its static type.
const definitions = (JSONValueSchema as unknown as { $defs: Record<string, Type.TSchema> }).$defs;
const json = Type.Unsafe<JSONValue>({ $ref: "#/$defs/json" });
const object = <P extends Type.TProperties>(properties: P) => Type.Object(properties, {
  additionalProperties: false, $defs: definitions,
});
export const FrameSchema = object({
  publication: Type.Integer({ minimum: 0 }), revision: Type.String(), data: json,
  dirty: Type.Boolean(), error: Type.Union([Type.String(), Type.Null()]),
  projectionError: Type.Union([Type.String(), Type.Null()]),
});
export const EditSchema = object({
  session: Type.String({ minLength: 1 }), sequence: Type.Integer({ minimum: 1 }),
  base: Type.String(), after: json, draft: Type.Optional(Type.String({ minLength: 1 })),
  parent: Type.Optional(Type.Integer({ minimum: 1 })),
});
export const ConfirmationSchema = Type.Enum(["accepted", "durable"]);
export const TextPolicySchema = Type.Enum(["ancestry", "host-frame"]);
export type Frame<T = JSONValue> = Omit<Type.Static<typeof FrameSchema>, "data"> & { data: T };
export type Edit = Type.Static<typeof EditSchema>;
export type TextPolicy = Type.Static<typeof TextPolicySchema>;
export const Methods = {
  open: {}, apply: EditSchema.properties, flush: {},
  releaseDraft: { session: Type.String(), draft: Type.String() },
  // Harness-only fault controls, never installed by the production host.
  remote: { after: json, base: Type.Optional(Type.String()) },
  delay: { milliseconds: Type.Number({ minimum: 0, maximum: 1000 }), phase: Type.Optional(Type.Enum(["accept", "reply"])) },
  storage: { milliseconds: Type.Number({ minimum: 0, maximum: 1000 }), failure: Type.Union([Type.String(), Type.Null()]) },
} as const;
export const RequestSchema = Type.Unsafe({
  $defs: definitions,
  anyOf: Object.entries(Methods).map(([method, properties]) => object({ method: Type.Literal(method), ...properties })),
});
