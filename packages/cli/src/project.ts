import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { zipSync, type Zippable } from "fflate";
import { decode as decodePng } from "fast-png";
import { build as viteBuild } from "vite";
import { checkPngDimensions, manifestSchemaURL, parseManifest, type SlopAuthor, type SlopCategory, type SlopManifest } from "@hitslop/schema";
import cliPackage from "../package.json" with { type: "json" };
import { emitDocumentSkill, readDocumentGuideSource } from "./document-skill.ts";
import { readThemeContract, readThemeCSS, themeContract, validateThemeReferences } from "./theme.ts";
import { hitSlopBuildPlugin } from "./vite-build-plugin.ts";
import { loadDataSchema } from "./data-schema.ts";

export const manifestPath = (root: string): string => join(root, "manifest.json");
export async function loadManifest(root: string): Promise<SlopManifest> {
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath(root), "utf8")));
  await validateSkin(root, manifest);
  return manifest;
}

const exists = async (path: string): Promise<boolean> => { try { await stat(path); return true; } catch { return false; } };
export const sha256 = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

async function validateSkin(root: string, manifest: SlopManifest): Promise<void> {
  if (!("skin" in manifest.presentation)) return;
  const path = join(root, manifest.presentation.skin);
  if (!await exists(path)) throw new Error(`Missing window skin: ${manifest.presentation.skin}`);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("The window skin must be a regular file, not a symlink.");
  let png: ReturnType<typeof decodePng>;
  const bytes = await readFile(path);
  checkPngDimensions(bytes, "The window skin", manifest.presentation);
  try {
    png = decodePng(bytes, { checkCrc: true });
  } catch {
    throw new Error("The window skin must be a valid PNG image.");
  }
  if (png.channels !== 4) throw new Error("The window skin must be an RGBA PNG image.");
}

export type ScaffoldOptions = {
  template?: string;
  title?: string;
  description?: string;
  categories?: SlopCategory[];
  author: SlopAuthor;
};

export async function scaffold(destination: string, options: ScaffoldOptions): Promise<void> {
  const template = options.template ?? "svelte-counter";
  if (!new Set(["svelte", "svelte-counter"]).has(template)) throw new Error(`Unknown authoring template: ${template}`);
  if (await exists(destination) && (await readdir(destination)).length) throw new Error(`Destination is not empty: ${destination}`);
  const slug = basename(destination).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-slop";
  const defaultTitle = slug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
  const title = options.title || defaultTitle;
  const templateRoot = fileURLToPath(new URL("../templates/svelte", import.meta.url));
  await cp(templateRoot, destination, { recursive: true });
  await writeFile(join(destination, "package.json"), JSON.stringify({
    name: slug, private: true, type: "module", scripts: {
      dev: "slop dev",
      check: "svelte-check --tsgo --tsconfig tsconfig.json",
      validate: "slop validate",
      build: "slop build",
      register: "slop register",
      publish: "slop publish",
    },
    dependencies: { "@hitslop/runtime": "^0.2.0", "@hitslop/svelte": "^0.2.0", "bits-ui": "^2.19.0", "svelte": "^5.57.0", "typebox": "^1.3.26" },
    devDependencies: { "@hitslop/cli": `^${cliPackage.version}`, "@sveltejs/vite-plugin-svelte": "^7.3.0", "@vanilla-extract/css": "^1.21.2", "@vanilla-extract/vite-plugin": "^5.2.6", "vite": "^8.2.2", "svelte-check": "^4.7.6", "@typescript/native": "npm:typescript@^7.0.2", "typescript": "^6.0.3" },
  }, null, 2) + "\n");
  const manifest = parseManifest({
    $schema: manifestSchemaURL, slug,
    author: options.author,
    title,
    description: options.description || "A small, lovable hitSlop app.", categories: options.categories?.length ? options.categories : ["utilities"],
    presentation: { width: 560, height: 420 },
  });
  await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const appPath = join(destination, "src/App.svelte");
  await writeFile(appPath, (await readFile(appPath, "utf8")).replace("__SLOP_TITLE_LITERAL__", JSON.stringify(title)));
}

export async function buildSlop(root: string): Promise<{ directory: string; manifest: SlopManifest }> {
  const manifest = await loadManifest(root);
  const schemaPath = join(root, "schema.ts");
  const dataSchema = await exists(schemaPath) ? await loadDataSchema(schemaPath) : undefined;
  await readDocumentGuideSource(root);
  const distRoot = join(root, "dist");
  await mkdir(distRoot, { recursive: true });
  const staging = await mkdtemp(join(distRoot, ".build-"));
  const output = join(staging, `${manifest.slug}.slop`);
  const destination = join(distRoot, `${manifest.slug}.slop`);
  const viteOut = join(staging, "vite");
  try {
    const themeCSS = await readThemeCSS(root);
    const contract = themeContract(themeCSS);
    const hasTheme = contract !== undefined;
    await mkdir(output, { recursive: true });
    await viteBuild({ root, plugins: [hitSlopBuildPlugin({ hasTheme })], build: { outDir: viteOut, emptyOutDir: true } });
    const html = join(viteOut, "index.html"); if (!await exists(html)) throw new Error("Vite did not produce index.html");
    validateThemeReferences(await readFile(html, "utf8"), contract, "generated app.html");
    await cp(html, join(output, "app.html"));
    for (const entry of await readdir(viteOut)) {
      if (entry === "index.html") continue;
      if (entry !== "assets") throw new Error(`Unsupported Vite output ${entry}; emit runtime resources under assets/.`);
      await copyRuntimeTree(join(viteOut, entry), join(output, entry));
    }
    await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    for (const name of ["assets"]) {
      const source = join(root, name);
      if (await exists(source)) await copyRuntimeTree(source, join(output, name));
    }
    if (themeCSS !== undefined) {
      await mkdir(join(output, "assets"), { recursive: true });
      await writeFile(join(output, "assets/theme.css"), themeCSS);
    }
    if (dataSchema) await writeFile(join(output, "data.schema.json"), `${JSON.stringify(dataSchema, null, 2)}\n`);
    await emitDocumentSkill(root, output);
    const { validateRuntimePackage } = await import("./runtime-package.ts");
    await validateRuntimePackage(output, { template: true });
    const previous = join(staging, "previous.slop");
    if (await exists(destination)) await rename(destination, previous);
    try { await rename(output, destination); }
    catch (error) { if (await exists(previous)) await rename(previous, destination); throw error; }
    return { directory: destination, manifest };
  } finally { await rm(staging, { recursive: true, force: true }); }
}

export async function validateAuthoringProject(root: string): Promise<SlopManifest> {
  const manifest = await loadManifest(root);
  await readThemeContract(root);
  if (await exists(join(root, "schema.ts"))) await loadDataSchema(join(root, "schema.ts"));
  await readDocumentGuideSource(root);
  return manifest;
}

async function walk(root: string, directory = root): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name); const rel = relative(root, absolute).split(sep).join("/");
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in artifacts: ${rel}`);
    if (entry.isDirectory()) result.push(...await walk(root, absolute)); else if (entry.isFile()) result.push(rel);
  }
  return result.sort();
}

export async function packSlop(directory: string): Promise<{ bytes: Uint8Array; sha256: string }> {
  // ZIP stores calendar fields without a timezone. A UTC timestamp at the 1980
  // boundary becomes 1979 in western timezones and fflate correctly rejects it.
  // Local midnight keeps the encoded fields stable and comfortably in range.
  const files: Zippable = {}; const epoch = new Date(2000, 0, 1, 0, 0, 0);
  for (const path of await walk(directory)) files[path] = [new Uint8Array(await Bun.file(join(directory, path)).arrayBuffer()), { mtime: epoch, level: 9 }];
  const bytes = zipSync(files, { level: 9 }); return { bytes, sha256: sha256(bytes) };
}

export async function writePackedSlop(path: string): Promise<string> {
  const root = resolve(path);
  const runtime = await exists(join(root, "app.html")) && await exists(join(root, "manifest.json"));
  const directory = runtime ? root : (await buildSlop(root)).directory;
  const packed = await packSlop(directory);
  const output = `${directory}.zip`;
  await Bun.write(output, packed.bytes);
  return output;
}

async function copyRuntimeTree(source: string, destination: string): Promise<void> {
  if ((await lstat(source)).isSymbolicLink()) throw new Error(`Symlinks are not allowed in artifacts: ${source}`);
  const info = await stat(source);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source)) await copyRuntimeTree(join(source, entry), join(destination, entry));
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  if (await exists(destination)) {
    if (!(await readFile(source)).equals(await readFile(destination))) throw new Error(`Runtime asset collision: ${destination}`);
    return;
  }
  await cp(source, destination);
}
