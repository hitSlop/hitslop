import { expect, test } from "bun:test";
import { combineRuntimeRequirements, runtimeVersionParts, selectRuntime } from "../src/document-runtime.ts";
import { parseManifest, parseAuthoringManifest, manifestSchemaURL, authoringManifestSchemaURL } from "../src/manifest.ts";

test("runtime selection stays within a compatible major and compares numerically", () => {
  expect(selectRuntime("1.2.0", ["1.1.0", "2.0.0", "1.3.1", "1.12.0"])).toBe("1.12.0");
  expect(selectRuntime("1.2.0", ["1.2.0"])).toBe("1.2.0");
  expect(selectRuntime("1.2.0", ["1.1.9", "2.0.0"])).toBeUndefined();
  expect(selectRuntime("3.0.0", [])).toBeUndefined();
  expect(combineRuntimeRequirements(["1.0.0", "1.3.1"])).toBe("1.3.1");
  expect(() => combineRuntimeRequirements(["1.0.0", "2.0.0"])).toThrow("incompatible");
  for (const value of ["0.1.0", "1", "1.2", "01.0.0", "1.0.0-beta", "1.0.0+build", "^1.0.0", "1.9999999999.0", "1.0.0\n"]) expect(() => runtimeVersionParts(value)).toThrow();
});

test("authoring and built manifests have distinct required fields", () => {
  const source = { $schema: authoringManifestSchemaURL, slug: "counter", title: "Counter", description: "Count things", author: { name: "Tests" }, categories: ["utilities" as const], presentation: { width: 320, height: 240 } };
  expect(parseAuthoringManifest(source)).toEqual(source);
  expect(() => parseAuthoringManifest({ ...source, runtime: "1.0.0" })).toThrow();
  const built = { ...source, $schema: manifestSchemaURL, runtime: "1.0.0" };
  expect(parseManifest(built)).toEqual(built);
  expect(() => parseManifest({ ...built, runtime: undefined })).toThrow();
  expect(parseManifest({ ...built, runtime: "99.0.0" }).runtime).toBe("99.0.0");
});
