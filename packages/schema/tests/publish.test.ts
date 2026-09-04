import { describe, expect, test } from "bun:test";
import { PublishEnvelopeSchema } from "../src/publish.ts";

const valid = {
  format: "hitslop-publish/3",
  requestId: "11111111-1111-4111-8111-111111111111",
  publisherKeyId: "0123456789abcdef0123456789abcdef",
  publicKey: "a".repeat(43),
  artifactSha256: "b".repeat(64),
  artifactBytes: 1_024,
  timestamp: Date.now(),
} as const;

describe("publish envelope v3", () => {
  test("accepts the key-only publisher envelope", () => expect(PublishEnvelopeSchema.parse(valid)).toEqual(valid));
  test("rejects the prelaunch v2 envelope", () => expect(() => PublishEnvelopeSchema.parse({ ...valid, format: "hitslop-publish/2" })).toThrow());
  test("rejects publisher display metadata", () => expect(() => PublishEnvelopeSchema.parse({ ...valid, displayName: "Jordan" })).toThrow());
});
