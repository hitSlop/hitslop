import { expect, test } from "bun:test";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildSlop } from "../../../packages/cli/src/project.ts";

test("Quick Checklist stays below 500 KB without embedding the platform engine", async () => {
  const { directory, manifest } = await buildSlop(resolve(import.meta.dir, "../quick-checklist"));
  let bytes = 0;
  const walk = async (root: string): Promise<void> => {
    for (const name of await readdir(root)) {
      if (name === "QuickLook") continue;
      const path = join(root, name), info = await stat(path);
      if (info.isDirectory()) { await walk(path); continue; }
      bytes += info.size;
      if (name.endsWith(".js")) {
        const source = await readFile(path, "utf8");
        expect(source).not.toContain("WebAssembly");
        expect(source).not.toContain("__hitslopDocumentRuntime");
      }
    }
  };
  await walk(directory);
  expect(manifest.runtime).toBe("1.0.0");
  expect(bytes).toBeLessThan(500_000);
}, 30_000);
