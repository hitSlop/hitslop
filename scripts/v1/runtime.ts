import { build as esbuild } from "esbuild";
import { mkdir, cp, writeFile, mkdtemp, rm, readdir, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import identity from "../../packages/document/src/runtime-identity.json";
import {
  repository,
  runtimeDestinations,
  verifyProvenance,
  catalog,
  verifyReleasedIdentities,
} from "./runtime-artifacts";

export async function buildRuntime(destinations = runtimeDestinations) {
  await verifyProvenance();
  const stage = await mkdtemp(join(tmpdir(), "hitslop-runtimes-"));
  try {
    const runtimeDirectory = join(stage, String(identity.runtimeContract));
    await mkdir(runtimeDirectory);
    for (const entry of ["boot.js", "headless.js"])
      await cp(join(repository, "packages/document/src", entry), join(runtimeDirectory, entry));
    await esbuild({
      entryPoints: [join(repository, "packages/document/src/runtime-entry.ts")],
      outfile: join(runtimeDirectory, "index.js"),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "safari17",
      minify: true,
      plugins: [
        {
          name: "loro-external",
          setup(b) {
            b.onResolve({ filter: /^loro-crdt$/ }, () => ({
              path: "./loro/index.js",
              external: true,
            }));
          },
        },
      ],
    });
    const loro = dirname(Bun.resolveSync("loro-crdt/package.json", repository));
    await mkdir(join(runtimeDirectory, "loro"));
    for (const entry of await readdir(join(loro, "web"))) {
      if (entry.endsWith(".js") || entry.endsWith(".wasm") || entry === "snippets")
        await cp(join(loro, "web", entry), join(runtimeDirectory, "loro", entry), {
          recursive: true,
        });
    }
    await writeFile(join(runtimeDirectory, "identity.json"), JSON.stringify(identity));
    await verifyReleasedIdentities(await catalog(stage));
    for (const destination of destinations) {
      await mkdir(dirname(destination), { recursive: true });
      const ready = destination + ".building";
      await rm(ready, { recursive: true, force: true });
      await cp(stage, ready, { recursive: true });
      await rm(destination, { recursive: true, force: true });
      await rename(ready, destination);
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
if (import.meta.main) await buildRuntime();
