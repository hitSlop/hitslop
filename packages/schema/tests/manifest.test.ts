import { test, expect } from "bun:test";
import { parseManifest } from "../src/index";
import { readFile } from "node:fs/promises";
test("v1 manifest requires explicit runtime and attribution", async () => {
  const manifest = JSON.parse(
    await readFile("examples/slops/quick-checklist/manifest.json", "utf8"),
  );
  expect(parseManifest(manifest).runtime).toBe("hitslop-v1");
  for (const value of [
    { ...manifest, runtime: "hitslop-loro-v1" },
    { ...manifest, runtime: undefined },
    { ...manifest, author: { name: "" } },
    { ...manifest, presentation: { width: 1, height: 1 } },
  ])
    expect(() => parseManifest(value)).toThrow();
});
