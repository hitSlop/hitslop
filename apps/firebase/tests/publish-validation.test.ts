import { expect, test } from "bun:test";
import { encode } from "fast-png";
import { zipSync } from "fflate";
import { documentSkillContent, documentSkillPath, manifestSchemaURL, parseManifest } from "@hitslop/schema";
import { inspectZip, safeArchivePath, validateSkin } from "../src/publish-validation";

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

test("archive path validation rejects traversal and platform-specific escapes", () => {
  expect(safeArchivePath("assets/icon.png")).toBe(true);
  for (const path of ["../secret", "assets/../secret", "/absolute", "assets\\secret", "assets//secret", ""]) {
    expect(safeArchivePath(path)).toBe(false);
  }
});

test("ZIP inspection accepts runtime paths and rejects unsafe or source paths", () => {
  expect(() => inspectZip(zipSync({ "manifest.json": bytes("{}"), "app.html": bytes("ok"), "data.schema.json": bytes("{}"), [documentSkillPath]: bytes(documentSkillContent), "assets/icon.txt": bytes("ok") }))).not.toThrow();
  expect(() => inspectZip(zipSync({ "../secret": bytes("no") }))).toThrow("Unsafe archive entry");
  expect(() => inspectZip(zipSync({ "source/App.svelte": bytes("no") }))).toThrow("Template packages cannot contain");
  expect(() => inspectZip(bytes("not a zip"))).toThrow("valid ZIP");
});

test("skin validation requires the exact RGBA artifact", () => {
  const manifest = parseManifest({
    $schema: manifestSchemaURL,
    slug: "skin-test",
    title: "Skin Test",
    description: "Validates a catalog skin.",
    categories: ["utilities"],
    presentation: { width: 240, height: 180, skin: "assets/skin.png" },
  });
  const rgba = encode({ width: 240, height: 180, channels: 4, data: new Uint8Array(240 * 180 * 4).fill(255) });
  expect(() => validateSkin({ "assets/skin.png": rgba }, manifest)).not.toThrow();
  expect(() => validateSkin({}, manifest)).toThrow("Artifact is missing");
  const wrongSize = encode({ width: 241, height: 180, channels: 4, data: new Uint8Array(241 * 180 * 4).fill(255) });
  expect(() => validateSkin({ "assets/skin.png": wrongSize }, manifest)).toThrow("exactly 240x180");
});
