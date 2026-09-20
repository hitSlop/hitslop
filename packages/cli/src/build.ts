import { build as esbuild, transform, type Plugin } from "esbuild";
import { vanillaExtractPlugin } from "@vanilla-extract/esbuild-plugin";
import { compile, compileModule } from "svelte/compiler";
import { cp, mkdir, readFile, writeFile, rm, rename, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { parseManifest } from "@hitslop/schema";
import { fromDescriptor, validate } from "@hitslop/document";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
export const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const runtimeDirectory = resolve(repository, "generated/v1/runtime");
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
const adapters = new Set(["document.ts", "handles.ts", "bind-text.ts", "capture.ts"]);
export const runtimePlugin: Plugin = {
  name: "host-runtime",
  setup(b) {
    b.onResolve({ filter: /^(loro-crdt|@hitslop\/document\/runtime)(\/.*)?$/ }, (args) => {
      throw new Error(`App code cannot import engine ${args.path}; use the document SDK`);
    });
    b.onResolve({ filter: /^(\.\/|@hitslop\/document\/capture)/ }, (args) => {
      if (args.path === "@hitslop/document/capture")
        return { path: "/__runtime__/index.js", external: true };
      if (
        args.importer.includes("/packages/document/src/") &&
        adapters.has(args.path.replace("./", "").replace(/(?<!\.ts)$/, ".ts"))
      )
        return { path: "/__runtime__/index.js", external: true };
    });
  },
};
export async function buildProject(source: string, destination?: string) {
  const { stdout } = await promisify(execFile)(
    process.env.HITSLOP_NODE ?? "node",
    [
      "--import",
      "tsx",
      join(repository, "packages/cli/src/build-worker.ts"),
      resolve(source),
      ...(destination ? [resolve(destination)] : []),
    ],
    { cwd: repository, maxBuffer: 8 * 1024 * 1024 },
  );
  return stdout.trim().split("\n").at(-1)!;
}
export async function buildProjectInNode(source: string, destination?: string) {
  source = resolve(source);
  const manifest = parseManifest(JSON.parse(await readFile(join(source, "manifest.json"), "utf8")));
  const out = destination ? resolve(destination) : join(source, "dist", manifest.slug + ".slop");
  if (out === source || !out.endsWith(".slop"))
    throw new Error("Build output must be a separate .slop directory");
  const schemaModule = await import(join(source, "schema.ts"));
  const definition = Object.values(schemaModule).find((v: any) => v?.descriptor) as any;
  if (!definition) throw new Error("schema.ts must export a document definition");
  const descriptor = fromDescriptor(definition.descriptor).descriptor;
  const { default: initial } = await import(join(source, "initial.ts"));
  validate(descriptor.root, initial);
  const { default: theme } = await import(join(source, "theme.ts"));
  const stage = out + ".building-" + crypto.randomUUID();
  await mkdir(join(stage, "assets"), { recursive: true });
  if (
    await stat(join(source, "assets")).then(
      () => true,
      () => false,
    )
  )
    await cp(join(source, "assets"), join(stage, "assets"), { recursive: true });
  try {
    const result = await esbuild({
      entryPoints: [join(source, "main.ts")],
      bundle: true,
      outdir: join(stage, "assets"),
      format: "esm",
      platform: "browser",
      target: "safari17",
      minify: process.env.HITSLOP_DEBUG_BUILD !== "1",
      conditions: ["browser"],
      metafile: true,
      plugins: [
        runtimePlugin,
        {
          name: "svelte",
          setup(b) {
            // Libraries with their own peer installation must share the app's
            // Svelte runtime; two copies split effect/context and DOM state.
            b.onResolve({ filter: /^svelte(?:\/.*)?$/ }, (args) => {
              if (args.pluginData?.svelteRoot) return;
              return b.resolve(args.path, {
                kind: args.kind,
                resolveDir: repository,
                pluginData: { svelteRoot: true },
              });
            });
            b.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
              contents: compile(await readFile(path, "utf8"), {
                filename: path,
                generate: "client",
                css: "injected",
                dev: false,
              }).js.code,
              loader: "js",
              resolveDir: dirname(path),
            }));
            b.onLoad({ filter: /\.svelte\.(ts|js)$/ }, async ({ path }) => ({
              contents: compileModule(
                (await transform(await readFile(path, "utf8"), { loader: "ts" })).code,
                { filename: path, generate: "client", dev: false },
              ).js.code,
              loader: "js",
              resolveDir: dirname(path),
            }));
          },
        },
        vanillaExtractPlugin(),
      ],
    });
    for (const input of Object.keys(result.metafile!.inputs))
      if (/loro-crdt|document\/src\/(document|operations|session|runtime-entry)\.ts/.test(input))
        throw new Error(`Embedded engine rejected: ${input}`);
    await writeFile(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(join(stage, "state.schema.json"), JSON.stringify(descriptor, null, 2));
    await writeFile(join(stage, "initial.json"), JSON.stringify(initial, null, 2));
    await writeFile(join(stage, "assets/theme.css"), theme.css);
    await writeFile(
      join(stage, "app.html"),
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>hitSlop</title><link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="/assets/main.css"></head><body><script type="module" src="/assets/main.js"></script></body></html>',
    );
    await mkdir(join(stage, ".agents/skills/hitslop-document"), { recursive: true });
    await cp(
      join(repository, "packages/cli/skills/hitslop-document/SKILL.md"),
      join(stage, ".agents/skills/hitslop-document/SKILL.md"),
    );
    if (
      await stat(out).then(
        () => true,
        () => false,
      )
    ) {
      // Build outputs are disposable only; never overwrite a writable document.
      if (
        await stat(join(out, "state")).then(
          () => true,
          () => false,
        )
      )
        throw new Error("Refusing to overwrite a writable document");
      await rm(out, { recursive: true });
    }
    await rename(stage, out);
    return out;
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}
