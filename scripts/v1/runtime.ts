import { build as esbuild } from "esbuild";
import { mkdir, cp, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import identity from "../../packages/document/src/runtime-identity.json";
const repository = resolve(import.meta.dir, "../..");
const runtimeDirectory = join(repository, "packages/cli/runtime");
export async function buildRuntime() {
  await mkdir(runtimeDirectory, { recursive: true });
  await cp(
    join(repository, "packages/document/src/headless.js"),
    join(runtimeDirectory, "headless.js"),
  );
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
  await cp(join(loro, "web"), join(runtimeDirectory, "loro"), { recursive: true });
}

await buildRuntime();
await writeFile(join(runtimeDirectory, "identity.json"), JSON.stringify(identity));
await cp(runtimeDirectory, join(repository, "generated/v1/runtime"), { recursive: true });
await cp(
  runtimeDirectory,
  join(repository, "apps/apple/Packages/HitSlopApple/Sources/HitSlopWasm/Resources/runtime"),
  { recursive: true },
);
