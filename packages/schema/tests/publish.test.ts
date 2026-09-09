import { parsePublishEnvelope } from "../src/publish.ts";
import { describe, expect, test } from "bun:test";

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
  test("accepts the key-only publisher envelope", () => expect(parsePublishEnvelope(valid)).toEqual(valid));
  test("rejects the prelaunch v2 envelope", () => expect(() => parsePublishEnvelope({ ...valid, format: "hitslop-publish/2" })).toThrow());
  test("rejects publisher display metadata", () => expect(() => parsePublishEnvelope({ ...valid, displayName: "Jordan" })).toThrow());
});
