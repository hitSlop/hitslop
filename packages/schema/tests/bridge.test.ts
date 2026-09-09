import { expect, test } from "bun:test";
import { BridgeRequestSchema, BridgeReplySchema } from "../src/bridge.ts";
import { dataSchemaFromJSON, compileDataSchema } from "../src/data.ts";
import { validate } from "../src/validation.ts";

test("bridge requests retain nested JSON without defaults", () => {
  const packaged = compileDataSchema(dataSchemaFromJSON(BridgeRequestSchema));
  for (const value of [
    { method: "json.write", value: { list: [null, true, 3, { future: "keep" }] } },
    { method: "media.open", name: "hero-image" },
  ]) {
    const before = JSON.stringify(value);
    expect(Object.is(validate(BridgeRequestSchema, value), value)).toBe(true);
    packaged(value);
    expect(JSON.stringify(value)).toBe(before);
  }
  for (const value of [
    { method: "unknown" },
    { method: "json.write" },
    { method: "host.info", extra: true },
    { method: "window.resize", width: 1, height: 300 },
  ]) {
    expect(() => validate(BridgeRequestSchema, value)).toThrow();
    expect(() => packaged(value)).toThrow();
  }
});

test("bridge replies validate recursive JSON and error codes", () => {
  expect(() => validate(BridgeReplySchema, { ok: true, value: { nested: [[null, 1]] } })).not.toThrow();
  expect(() => validate(BridgeReplySchema, { ok: false, error: { code: "validation_failed", message: "Invalid" } })).not.toThrow();
  expect(() => validate(BridgeReplySchema, { ok: false, error: { code: "unknown", message: "Invalid" } })).toThrow();
});
