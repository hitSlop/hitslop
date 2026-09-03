import { cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { zipSync, type Zippable } from "fflate";
import { decode as decodePng } from "fast-png";
import { build as viteBuild } from "vite";
import * as z from "zod";
import { manifestSchemaURL, parseManifest, type SlopCategory, type SlopManifest } from "@hitslop/schema";
import cliPackage from "../package.json" with { type: "json" };
import { emitDocumentSkill, readDocumentGuideSource } from "./document-skill.ts";
import { readThemeContract, validateThemeReferences } from "./theme.ts";
import { hitSlopBuildPlugin } from "./vite-build-plugin.ts";

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
  try {
    png = decodePng(await readFile(path), { checkCrc: true });
  } catch {
    throw new Error("The window skin must be a valid PNG image.");
  }
  if (png.width !== manifest.presentation.width || png.height !== manifest.presentation.height) {
    throw new Error(`The window skin must be exactly ${manifest.presentation.width}x${manifest.presentation.height} pixels; received ${png.width}x${png.height}.`);
  }
  if (png.channels !== 4) throw new Error("The window skin must be an RGBA PNG image.");
}

export type ScaffoldOptions = {
  template?: string;
  title?: string;
  description?: string;
  categories?: SlopCategory[];
};

export async function scaffold(destination: string, options: ScaffoldOptions = {}): Promise<void> {
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
      validate: "slop validate",
      build: "slop build",
      register: "slop register",
      publish: "slop publish",
    },
    dependencies: { "@hitslop/runtime": "^0.1.2", "@hitslop/svelte": "^0.1.2", "bits-ui": "^2.19.0", "svelte": "^5.0.0", "zod": "^4.5.2" },
    devDependencies: { "@hitslop/cli": `^${cliPackage.version}`, "@sveltejs/vite-plugin-svelte": "^7.0.0", "@vanilla-extract/css": "^1.17.4", "@vanilla-extract/vite-plugin": "^5.1.1", "vite": "^8.0.0" },
  }, null, 2) + "\n");
  await writeFile(join(destination, "manifest.json"), JSON.stringify({
    $schema: manifestSchemaURL, slug,
    title,
    description: options.description || "A small, lovable hitSlop app.", categories: options.categories?.length ? options.categories : ["utilities"],
    presentation: { width: 560, height: 420 },
  }, null, 2) + "\n");
  const appPath = join(destination, "src/App.svelte");
  await writeFile(appPath, (await readFile(appPath, "utf8")).replace("__SLOP_TITLE_LITERAL__", JSON.stringify(title)));
}

export async function buildSlop(root: string): Promise<{ directory: string; manifest: SlopManifest }> {
  const manifest = await loadManifest(root);
  const dataSchema = await generateDataSchema(root);
  await readDocumentGuideSource(root);
  const distRoot = join(root, "dist"); const output = join(distRoot, `${manifest.slug}.slop`); const viteOut = join(root, ".hitslop", "vite-build");
  const themeContract = await readThemeContract(root);
  const hasTheme = themeContract !== undefined;
  await rm(output, { recursive: true, force: true }); await rm(viteOut, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await viteBuild({ root, plugins: [hitSlopBuildPlugin({ hasTheme })], build: { outDir: viteOut, emptyOutDir: true } });
  const html = join(viteOut, "index.html"); if (!await exists(html)) throw new Error("Vite did not produce index.html");
  validateThemeReferences(await readFile(html, "utf8"), themeContract, "generated app.html");
  await cp(html, join(output, "app.html"));
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const name of ["assets"]) {
    const source = join(root, name);
    if (await exists(source)) await copyRuntimeTree(source, join(output, name));
  }
  if (dataSchema) await writeFile(join(output, "data.schema.json"), `${JSON.stringify(dataSchema, null, 2)}\n`);
  await emitDocumentSkill(root, output);
  await rm(viteOut, { recursive: true, force: true }); return { directory: output, manifest };
}

type JSONSchema = Record<string, unknown>;

async function generateDataSchema(root: string): Promise<JSONSchema | undefined> {
  const source = join(root, "schema.ts");
  if (!await exists(source)) return undefined;
  const imported = await import(`${pathToFileURL(source).href}?hitslop=${Date.now()}`) as { default?: unknown };
  if (!imported.default) throw new Error("schema.ts must default-export a Zod 4 schema");
  let schema: JSONSchema;
  try {
    schema = z.toJSONSchema(imported.default as Parameters<typeof z.toJSONSchema>[0], { target: "draft-2020-12", io: "input" }) as JSONSchema;
  } catch (error) {
    throw new Error(`Could not generate data.schema.json from schema.ts: ${error instanceof Error ? error.message : String(error)}`);
  }
  return schema;
}

export async function validateAuthoringProject(root: string): Promise<SlopManifest> {
  const manifest = await loadManifest(root);
  await readThemeContract(root);
  await generateDataSchema(root);
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
  await cp(source, destination);
}
