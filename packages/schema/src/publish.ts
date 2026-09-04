import { z } from "zod";

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const PublishEnvelopeSchema = z.object({
  format: z.literal("hitslop-publish/3"),
  requestId: z.string().uuid(),
  publisherKeyId: z.string().min(16).max(64),
  publicKey: z.string().min(40).max(100),
  artifactSha256: Sha256Schema,
  artifactBytes: z.number().int().positive().max(25 * 1024 * 1024),
  timestamp: z.number().int().positive(),
}).strict();

export type PublishEnvelope = z.infer<typeof PublishEnvelopeSchema>;

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
};

export const canonicalPublishEnvelope = (envelope: PublishEnvelope): Uint8Array =>
  new TextEncoder().encode(canonicalize(PublishEnvelopeSchema.parse(envelope)));
