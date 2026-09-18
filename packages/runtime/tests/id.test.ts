import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { newId } from "../src/index.js";

const bundle = await Bun.build({
  entrypoints: [new URL("../src/id.ts", import.meta.url).pathname],
  target: "browser",
  format: "cjs",
});
if (!bundle.success) throw new Error("Cannot build ID helper");
const source = await bundle.outputs[0]!.text();
function withCrypto(crypto: unknown): () => string {
  const module = { exports: {} as { newId: () => string } };
  runInNewContext(source, { module, crypto });
  return module.exports.newId;
}

test("public ID helper works without a host", () => {
  expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("UUID version and variant bits are set without randomUUID", () => {
  let calls = 0;
  const id = withCrypto({
    getRandomValues(bytes: Uint8Array) {
      expect(bytes.length).toBe(16);
      return bytes.fill(calls++ === 0 ? 0 : 255);
    },
  });
  expect(id()).toBe("00000000-0000-4000-8000-000000000000");
  expect(id()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  expect(calls).toBe(2);
});

test("missing secure randomness fails clearly", () => {
  for (const crypto of [undefined, {}]) {
    expect(withCrypto(crypto)).toThrow("Secure random number generation is unavailable");
  }
});
