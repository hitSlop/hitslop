import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertNoConfiguredSecrets, removeGeneratedSecrets } from "../scripts/build";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-catalog-build-"));
  roots.push(root);
  await mkdir(join(root, "dist/server"), { recursive: true });
  await writeFile(join(root, ".dev.vars"), "HITSLOP_INTERNAL_SECRET=not-a-real-secret-value\n");
  return root;
}

test("removes Cloudflare's generated .dev.vars from build output", async () => {
  const root = await fixture();
  await writeFile(join(root, "dist/server/.dev.vars"), "must disappear");
  await removeGeneratedSecrets(root);
  expect(await readFile(join(root, ".dev.vars"), "utf8")).toContain("not-a-real-secret-value");
  expect(await Bun.file(join(root, "dist/server/.dev.vars")).exists()).toBe(false);
});

test("rejects a configured secret embedded in another build file", async () => {
  const root = await fixture();
  await writeFile(join(root, "dist/server/index.js"), "const leaked = 'not-a-real-secret-value'");
  expect(assertNoConfiguredSecrets(root)).rejects.toThrow("HITSLOP_INTERNAL_SECRET");
});
