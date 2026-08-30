import { describe, expect, test } from "bun:test";
import { parseLocalTemplateInstall, parseManifest, storePath } from "../src/index.ts";

const valid = {
  slug: "counter", title: "Counter", description: "A small counter.",
  author: { name: "Longtail Labs" }, categories: ["Widgets"],
  stores: { state: { kind: "json" as const } },
  window: { width: 480, height: 360, shape: { kind: "roundedRect" as const, radius: 22 } },
};

describe("SlopManifest", () => {
  test("parses a valid authoring manifest", () => expect(parseManifest(valid).slug).toBe("counter"));
  test("parses host-owned document identity and lineage", () => expect(parseManifest({
    ...valid,
    document: { id: crypto.randomUUID(), template: { publisherKeyId: "1234567890abcdef", release: 4, artifactSha256: "a".repeat(64) } },
  }).document?.template?.release).toBe(4));
  test("treats omitted resizable as valid", () => expect(parseManifest(valid).window.resizable).toBeUndefined());
  test("requires an explicit window shape", () => expect(() => parseManifest({ ...valid, window: { width: 480, height: 360 } })).toThrow());
  test("requires circles to be square", () => expect(() => parseManifest({ ...valid, window: { width: 480, height: 360, shape: { kind: "circle" } } })).toThrow("circle windows must have equal width and height"));
  test("accepts a fixed image mask", () => expect(parseManifest({ ...valid, window: { width: 480, height: 360, resizable: false, shape: { kind: "imageMask", path: "assets/window-mask.png" } } }).window.shape.kind).toBe("imageMask"));
  test("requires image masks to be fixed size", () => expect(() => parseManifest({ ...valid, window: { width: 480, height: 360, resizable: true, shape: { kind: "imageMask", path: "assets/window-mask.png" } } })).toThrow("image-masked windows must set resizable to false"));
  test("requires image masks under assets", () => expect(() => parseManifest({ ...valid, window: { width: 480, height: 360, resizable: false, shape: { kind: "imageMask", path: "window-mask.png" } } })).toThrow("must be under assets"));
  test("requires PNG image masks", () => expect(() => parseManifest({ ...valid, window: { width: 480, height: 360, resizable: false, shape: { kind: "imageMask", path: "assets/window-mask.jpg" } } })).toThrow("must be a PNG image"));
  test("rejects invalid store ids", () => expect(() => parseManifest({ ...valid, stores: { "Not Safe": { kind: "json" } } })).toThrow());
  test("rejects more than 16 stores", () => expect(() => parseManifest({ ...valid, stores: Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`s${index}`, { kind: "json" }])) })).toThrow("at most 16 stores"));
  test("derives canonical store paths", () => { expect(storePath("state", "json")).toBe("stores/state.json"); expect(storePath("library", "sqlite")).toBe("stores/library.sqlite"); });
  test("rejects duplicate categories", () => expect(() => parseManifest({ ...valid, categories: ["Widgets", "Widgets"] })).toThrow("categories must be unique"));
  test("rejects duplicate tags", () => expect(() => parseManifest({ ...valid, tags: ["one", "one"] })).toThrow("tags must be unique"));
  test("rejects legacy format and runtime fields", () => expect(() => parseManifest({ ...valid, format: "hitslop/1", runtime: "web" })).toThrow());
  test("rejects legacy array stores", () => expect(() => parseManifest({ ...valid, stores: [{ id: "state", kind: "json", path: "data.json" }] })).toThrow());
});

describe("LocalTemplateInstall", () => {
  const validInstall = { artifactSha256: "a".repeat(64), installedAt: "2026-08-29T18:00:00.000Z" };
  test("parses the local install marker", () => expect(parseLocalTemplateInstall(validInstall).artifactSha256).toHaveLength(64));
  test("rejects legacy preview metadata", () => expect(() => parseLocalTemplateInstall({ ...validInstall, preview: "cover.png" })).toThrow());
  test("rejects legacy format and package fields", () => expect(() => parseLocalTemplateInstall({ ...validInstall, format: "hitslop-template-install/1", package: "template.slop" })).toThrow());
});
