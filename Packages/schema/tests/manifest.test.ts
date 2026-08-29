import { describe, expect, test } from "bun:test";
import { parseManifest } from "../src/index.ts";

const valid = {
  format: "hitslop/1", runtime: "web", slug: "counter", title: "Counter",
  description: "A small counter.", author: { name: "Longtail Labs" }, categories: ["Widgets"],
  stores: [{ id: "state", kind: "json", path: "data.json" }],
  window: { width: 480, height: 360 },
};

describe("SlopManifest", () => {
  test("parses a valid manifest", () => expect(parseManifest(valid).slug).toBe("counter"));
  test("rejects duplicate store ids", () => expect(() => parseManifest({ ...valid, stores: [valid.stores[0], valid.stores[0]] })).toThrow("duplicate store id"));
  test("rejects traversal", () => expect(() => parseManifest({ ...valid, stores: [{ ...valid.stores[0], path: "../data.json" }] })).toThrow());
});
