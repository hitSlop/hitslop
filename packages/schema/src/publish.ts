import * as Type from "typebox";
import { validate } from "./validation.js";

export const Sha256Schema = Type.String({ pattern: "^[a-f0-9]{64}$" });
export const PublishEnvelopeSchema = Type.Object({
  format: Type.Literal("hitslop-publish/3"),
  requestId: Type.String({ format: "uuid" }),
  publisherKeyId: Type.String({ minLength: 16, maxLength: 64 }),
  publicKey: Type.String({ minLength: 40, maxLength: 100 }),
  artifactSha256: Sha256Schema,
  artifactBytes: Type.Integer({ minimum: 1, maximum: 25 * 1024 * 1024 }),
  timestamp: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });
export type PublishEnvelope = Type.Static<typeof PublishEnvelopeSchema>;
export const parsePublishEnvelope = (input: unknown): PublishEnvelope => validate(PublishEnvelopeSchema, input);

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
};

export const canonicalPublishEnvelope = (envelope: PublishEnvelope): Uint8Array =>
  new TextEncoder().encode(canonicalize(parsePublishEnvelope(envelope)));
