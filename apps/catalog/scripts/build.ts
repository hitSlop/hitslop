import { readFile, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "vite";

export const generatedDevVarsPath = (catalogRoot = resolve(import.meta.dir, "..")): string =>
  join(catalogRoot, "dist/server/.dev.vars");

export async function removeGeneratedSecrets(catalogRoot?: string): Promise<void> {
  await rm(generatedDevVarsPath(catalogRoot), { force: true });
}

async function filesBelow(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? filesBelow(path) : Promise.resolve(entry.isFile() ? [path] : []);
    }));
    return nested.flat();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

const secretValues = async (path: string): Promise<Array<{ key: string; value: string }>> => {
  try {
    const text = await readFile(path, "utf8");
    return text.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match || !/(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)/.test(match[1]!) || match[2]!.length < 8) return [];
      return [{ key: match[1]!, value: match[2]! }];
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
};

export async function assertNoConfiguredSecrets(catalogRoot = resolve(import.meta.dir, "..")): Promise<void> {
  const outputRoot = join(catalogRoot, "dist");
  const outputFiles = await filesBelow(outputRoot);
  for (const secret of await secretValues(join(catalogRoot, ".dev.vars"))) {
    for (const file of outputFiles) {
      if ((await stat(file)).size > 8 * 1024 * 1024) continue;
      if ((await readFile(file)).includes(Buffer.from(secret.value))) {
        throw new Error(`Catalog build contains configured ${secret.key} in ${file}`);
      }
    }
  }
}

if (import.meta.main) {
  let completed = false;
  try {
    await build();
    completed = true;
  } finally {
    await removeGeneratedSecrets();
  }
  if (completed) await assertNoConfiguredSecrets();
}
