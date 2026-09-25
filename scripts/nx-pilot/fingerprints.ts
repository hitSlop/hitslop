// Compare portable bytes across independent builders/platforms; artwork is a snapshot.
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { output, slugs } from "./common";
const [label, ...comparisons] = process.argv.slice(2);
if (!label || !/^[a-z-]+$/.test(label)) throw new Error("Expected evidence label");
const result: Record<string, string> = {};
for (const slug of slugs) {
  const root = label.startsWith("legacy") ? join(output, "legacy-templates", `${slug}.slop`) : join(output, "portable", slug, "package.slop");
  const hash = createHash("sha256");
  async function visit(prefix = "") {
    for (const entry of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!prefix && entry.name === "QuickLook") continue;
      const path = join(prefix, entry.name);
      hash.update(JSON.stringify([path, entry.isDirectory() ? "directory" : "file"]));
      if (entry.isDirectory()) await visit(path);
      else hash.update(await readFile(join(root, path)));
    }
  }
  await visit();
  result[slug] = hash.digest("hex");
}
const evidence = ".hitslop/v1-evidence/nx-pilot";
await mkdir(evidence, { recursive: true });
for (const comparison of comparisons) assert.deepEqual(result, JSON.parse(await readFile(comparison, "utf8")), `Portable bytes differ from ${comparison}`);
await writeFile(join(evidence, `${label}-bytes.json`), JSON.stringify(result, null, 2) + "\n");
console.log(`${slugs.length} portable package fingerprints verified`);
