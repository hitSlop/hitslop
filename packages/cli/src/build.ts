import { build as esbuild, type Plugin } from "esbuild";
import { sveltePlugin } from "./svelte-plugin";
import { cp, mkdir, readFile, writeFile, rm, rename, stat } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { parseManifest } from "@hitslop/schema";
import { fromDescriptor, validate } from "@hitslop/document";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import identity from "@hitslop/document/identity";
export const cliRoot = fileURLToPath(new URL("../", import.meta.url));
export const runtimeDirectory = join(cliRoot, "runtimes", String(identity.runtimeContract));
// Bootstrap/view adapters stay in the app; shared stateful services come from the host.
const hostedModules = new Set(["document.ts", "handles.ts", "bind-text.ts", "bind-value.ts", "capture.ts", "attachments.ts"]);
export const runtimePlugin: Plugin = {
  name: "host-runtime",
  setup(b) {
    b.onResolve({ filter: /^(loro-crdt|@hitslop\/document\/runtime)(\/.*)?$/ }, (args) => {
      throw new Error(`App code cannot import engine ${args.path}; use the document SDK`);
    });
    b.onResolve({ filter: /^(\.\/|@hitslop\/document\/(capture|attachments))/ }, (args) => {
      if (["@hitslop/document/capture", "@hitslop/document/attachments"].includes(args.path))
        return { path: "/__runtime__/index.js", external: true };
      if (
        /\/(?:packages\/document|@hitslop\/document)\/src\//.test(args.importer) &&
        hostedModules.has(args.path.replace("./", "").replace(/(?<!\.ts)$/, ".ts"))
      )
        return { path: "/__runtime__/index.js", external: true };
    });
  },
};
export async function buildProject(source: string, destination?: string) {
  source = resolve(source);
  const output = destination
    ? resolve(destination)
    : join(
        source,
        "dist",
        parseManifest(JSON.parse(await readFile(join(source, "manifest.json"), "utf8"))).slug +
          ".slop",
      );
  const child = Bun.spawn(
    [process.execPath, join(cliRoot, "src/build-worker.ts"), source, output],
    { cwd: cliRoot, stdout: "inherit", stderr: "pipe" },
  );
  const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited]);
  if (code) throw new Error(stderr || "Authoring build failed");
  return output;
}
export async function buildProjectInBun(source: string, destination?: string) {
  source = resolve(source);
  const manifest = parseManifest(JSON.parse(await readFile(join(source, "manifest.json"), "utf8")));
  const out = destination ? resolve(destination) : join(source, "dist", manifest.slug + ".slop");
  if (out === source || !out.endsWith(".slop"))
    throw new Error("Build output must be a separate .slop directory");
  const installedIdentity = JSON.parse(
    await readFile(
      createRequire(join(source, "package.json")).resolve("@hitslop/document/identity"),
      "utf8",
    ),
  );
  if (Object.entries(identity).some(([key, value]) => installedIdentity[key] !== value))
    throw new Error(
      `Project SDK does not match CLI ${identity.sdkVersion}. Install matching @hitslop/document and @hitslop/cli versions.`,
    );
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
      loader: { ".ttf": "file", ".otf": "file", ".woff": "file", ".woff2": "file" },
      minify: process.env.HITSLOP_DEBUG_BUILD !== "1",
      conditions: ["browser", "default", "import", "svelte"],
      define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" },
      metafile: true,
      plugins: [
        runtimePlugin,
        {
          name: "copied-fonts",
          setup(b) {
            b.onResolve({ filter: /\.(ttf|otf|woff2?)([?#].*)?$/ }, async (args) => {
              if (args.pluginData?.resolvingFont) return;
              // Absolute browser URLs already refer to the copied assets directory.
              if (args.path.startsWith("/assets/")) return args.kind === "url-token"
                ? { path: args.path, external: true }
                : { path: args.path, namespace: "copied-font" };
              if (/^(https?:|data:)/.test(args.path)) return;
              const resolved = await b.resolve(args.path, {
                kind: args.kind, resolveDir: args.resolveDir,
                pluginData: { resolvingFont: true },
              });
              if (resolved.errors.length || resolved.external) return resolved;
              const path = relative(join(source, "assets"), resolved.path);
              if (isAbsolute(path) || path === ".." || path.startsWith("../")) return;
              const url = "/assets/" + path.split("/").map(encodeURIComponent).join("/") + resolved.suffix;
              if (args.kind === "url-token") return { path: url, external: true };
              return { path: url, namespace: "copied-font" };
            });
            b.onLoad({ filter: /.*/, namespace: "copied-font" }, ({ path }) => ({
              contents: `export default ${JSON.stringify(path)}`, loader: "js",
            }));
          },
        },
        sveltePlugin(cliRoot),
      ],
    });
    for (const input of Object.keys(result.metafile!.inputs))
      if (/loro-crdt|document\/src\/(document|operations|session|runtime-entry)\.ts/.test(input))
        throw new Error(`Embedded engine rejected: ${input}`);
    await writeFile(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(join(stage, "state.schema.json"), JSON.stringify(descriptor, null, 2));
    await writeFile(join(stage, "initial.json"), JSON.stringify(initial, null, 2));
    await writeFile(join(stage, "assets/theme.json"), JSON.stringify(theme.defaults));
    await writeFile(
      join(stage, "assets/runtime.json"),
      JSON.stringify({
        runtimeContract: identity.runtimeContract,
        minRuntimeRevision: identity.runtimeRevision,
        sdkVersion: identity.sdkVersion,
        loroVersion: identity.loroVersion,
        protocolVersion: identity.protocolVersion,
      }),
    );
    await writeFile(
      join(stage, "app.html"),
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>hitSlop</title><link rel="stylesheet" href="/assets/main.css"></head><body><script type="module" src="/assets/main.js"></script></body></html>',
    );
    await mkdir(join(stage, ".agents/skills/hitslop-document"), { recursive: true });
    await cp(
      join(cliRoot, "skills/hitslop-document/SKILL.md"),
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
