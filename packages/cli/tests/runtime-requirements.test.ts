import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authoringManifestSchemaURL } from "@hitslop/schema";
import { buildSlop } from "../src/project.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture(requirements: string[]) {
  const root = await mkdtemp(join(tmpdir(), "runtime-stamp-")); roots.push(root);
  await writeFile(join(root, "manifest.json"), JSON.stringify({ $schema: authoringManifestSchemaURL, slug: "stamp-test", title: "Stamp", description: "Runtime requirement test", author: { name: "Tests" }, categories: ["utilities"], presentation: { width: 320, height: 240 } }));
  const imports: string[] = [];
  for (const [index, runtime] of requirements.entries()) {
    const directory = join(root, `sdk-${index}`); await mkdir(directory);
    await writeFile(join(directory, "package.json"), JSON.stringify({ name: `@hitslop/test-${index}`, hitslop: { runtime } }));
    await writeFile(join(directory, "index.js"), `console.log(${JSON.stringify(runtime)});`);
    imports.push(`import './sdk-${index}/index.js';`);
  }
  await writeFile(join(root, "main.js"), imports.join("\n"));
  await writeFile(join(root, "index.html"), '<script type="module" src="/main.js"></script>');
  return root;
}
test("build stamps the highest SDK requirement in the target graph without editing source", async () => {
  const root = await fixture(["1.2.0", "1.12.0"]);
  const before = await readFile(join(root, "manifest.json"), "utf8");
  const built = await buildSlop(root);
  expect(built.manifest.runtime).toBe("1.12.0");
  expect(JSON.parse(await readFile(join(built.directory, "manifest.json"), "utf8")).runtime).toBe("1.12.0");
  expect(await readFile(join(root, "manifest.json"), "utf8")).toBe(before);
});
test("build rejects SDKs requiring different runtime majors", async () => {
  await expect(buildSlop(await fixture(["1.0.0", "2.0.0"]))).rejects.toThrow("incompatible runtime majors");
});
test("SDK-free apps get the builder baseline", async () => {
  expect((await buildSlop(await fixture([]))).manifest.runtime).toBe("1.0.0");
});

test.each(["@hitslop/sync", "loro-crdt"])("build rejects bundled %s even through a renamed local directory", async name => {
  const root = await fixture(["1.0.0"]);
  await writeFile(join(root, "sdk-0/package.json"), JSON.stringify({ name }));
  await expect(buildSlop(root)).rejects.toThrow("Document bundles must use the host runtime");
});
