import { describe, expect, test } from "bun:test";
import { parseLocalTemplateInstall, parseManifest } from "../src/index.ts";

const valid = {
  format: "hitslop/1", runtime: "web", slug: "counter", title: "Counter",
  description: "A small counter.", author: { name: "Longtail Labs" }, categories: ["Widgets"],
  stores: [{ id: "state", kind: "json", path: "data.json" }],
  window: { width: 480, height: 360 },
};

describe("SlopManifest", () => {
  test("parses a valid manifest", () => expect(parseManifest(valid).slug).toBe("counter"));
  test("treats omitted resizable as valid", () => expect(parseManifest(valid).window.resizable).toBeUndefined());
  test("rejects duplicate store ids", () => expect(() => parseManifest({ ...valid, stores: [valid.stores[0], valid.stores[0]] })).toThrow("duplicate store id"));
  test("rejects duplicate categories", () => expect(() => parseManifest({ ...valid, categories: ["Widgets", "Widgets"] })).toThrow("categories must be unique"));
  test("rejects duplicate tags", () => expect(() => parseManifest({ ...valid, tags: ["one", "one"] })).toThrow("tags must be unique"));
  test("rejects traversal", () => expect(() => parseManifest({ ...valid, stores: [{ ...valid.stores[0], path: "../data.json" }] })).toThrow());
  test("rejects absolute store paths", () => expect(() => parseManifest({ ...valid, stores: [{ ...valid.stores[0], path: "/tmp/data.json" }] })).toThrow());
  test("rejects reserved store paths", () => expect(() => parseManifest({ ...valid, stores: [{ ...valid.stores[0], path: "manifest.json" }] })).toThrow());
  test("rejects stores under build/", () => expect(() => parseManifest({ ...valid, stores: [{ ...valid.stores[0], path: "build/index.html" }] })).toThrow());
});

describe("LocalTemplateInstall", () => {
  const validInstall = {
    format: "hitslop-template-install/1",
    package: "template.slop",
    preview: "cover.png",
    artifactSha256: "a".repeat(64),
    installedAt: "2026-08-29T18:00:00.000Z",
  };
  test("parses the local install marker", () => expect(parseLocalTemplateInstall(validInstall).package).toBe("template.slop"));
  test("rejects an unsafe package location", () => expect(() => parseLocalTemplateInstall({ ...validInstall, package: "../template.slop" })).toThrow());
});
