import { z } from "zod";

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const PublishEnvelopeSchema = z.object({
  format: z.literal("hitslop-publish/1"),
  requestId: z.string().uuid(),
  publisherKeyId: z.string().min(16).max(64),
  publicKey: z.string().min(40).max(100),
  displayName: z.string().min(1).max(80),
  slug: z.string().min(2).max(64),
  manifestSha256: Sha256Schema,
  artifactSha256: Sha256Schema,
  artifactBytes: z.number().int().positive().max(25 * 1024 * 1024),
  screenshots: z.array(z.object({
    sha256: Sha256Schema,
    bytes: z.number().int().positive().max(5 * 1024 * 1024),
    contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  }).strict()).min(1).max(3),
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
