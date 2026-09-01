import { describe, expect, test } from "bun:test";
import { manifestSchemaURL, parseManifest } from "../src/index.ts";

const valid = {
  $schema: manifestSchemaURL,
  slug: "counter",
  title: "Counter",
  description: "A small counter.",
  categories: ["utilities" as const],
  presentation: { width: 480, height: 360 },
};

describe("SlopManifest", () => {
  test("parses the minimal manifest", () => expect(parseManifest(valid).slug).toBe("counter"));
  test("supports two catalog categories", () => expect(parseManifest({ ...valid, categories: ["personal", "finance"] }).categories).toHaveLength(2));
  test("rejects unknown and duplicate categories", () => {
    expect(() => parseManifest({ ...valid, categories: ["widgets"] })).toThrow();
    expect(() => parseManifest({ ...valid, categories: ["utilities", "utilities"] })).toThrow("categories must be unique");
  });
  test("leaves presentation defaults to hosts", () => {
    const presentation = parseManifest(valid).presentation;
    expect("shape" in presentation ? presentation.shape : undefined).toBeUndefined();
    expect("resizable" in presentation ? presentation.resizable : undefined).toBeUndefined();
  });
  test("accepts built-in presentation shapes", () => expect(parseManifest({ ...valid, presentation: { width: 480, height: 360, shape: "ellipse", resizable: false } }).presentation).toMatchObject({ shape: "ellipse" }));
  test("accepts a transparent standard presentation", () => expect(parseManifest({ ...valid, presentation: { width: 480, height: 360, background: "transparent", resizable: false } }).presentation).toMatchObject({ background: "transparent" }));
  test("accepts a fixed PNG skin", () => expect(parseManifest({ ...valid, presentation: { width: 480, height: 360, skin: "assets/skin.png" } }).presentation).toMatchObject({ skin: "assets/skin.png" }));
  test("skins reject resizing, traversal, and non-PNG files", () => {
    expect(() => parseManifest({ ...valid, presentation: { width: 480, height: 360, skin: "assets/skin.png", resizable: false } })).toThrow();
    expect(() => parseManifest({ ...valid, presentation: { width: 480, height: 360, skin: "assets/skin.png", background: "transparent" } })).toThrow();
    expect(() => parseManifest({ ...valid, presentation: { width: 480, height: 360, skin: "../skin.png" } })).toThrow();
    expect(() => parseManifest({ ...valid, presentation: { width: 480, height: 360, skin: "assets/skin.jpg" } })).toThrow();
  });
  test("requires the versioned schema URL", () => expect(() => parseManifest({ ...valid, $schema: "https://hitslop.app/schemas/manifest.schema.json" })).toThrow());
  test("rejects removed manifest fields", () => {
    for (const extra of ["author", "stores", "window", "tags", "document"]) expect(() => parseManifest({ ...valid, [extra]: {} })).toThrow();
  });
});
