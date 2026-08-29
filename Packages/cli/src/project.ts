import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { userInfo } from "node:os";
import { zipSync, strToU8, type Zippable } from "fflate";
import { build as viteBuild } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { parseManifest, type SlopManifest } from "@hitslop/schema";

export const manifestPath = (root: string): string => join(root, "manifest.json");
export async function loadManifest(root: string): Promise<SlopManifest> {
  return parseManifest(JSON.parse(await readFile(manifestPath(root), "utf8")));
}

const exists = async (path: string): Promise<boolean> => { try { await stat(path); return true; } catch { return false; } };
export const sha256 = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

export type ScaffoldOptions = {
  template?: string;
  title?: string;
  description?: string;
  author?: string;
  categories?: string[];
};

export async function scaffold(destination: string, options: ScaffoldOptions = {}): Promise<void> {
  const template = options.template ?? "svelte-counter";
  if (!new Set(["svelte", "svelte-counter"]).has(template)) throw new Error(`Unknown authoring template: ${template}`);
  if (await exists(destination) && (await readdir(destination)).length) throw new Error(`Destination is not empty: ${destination}`);
  const slug = basename(destination).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-slop";
  const defaultTitle = slug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
  await mkdir(join(destination, "src"), { recursive: true });
  await writeFile(join(destination, "package.json"), JSON.stringify({
    name: slug, private: true, type: "module", scripts: { dev: "slop dev", build: "slop build", publish: "slop publish" },
    dependencies: { "@hitslop/runtime": "latest", "@hitslop/svelte": "latest", "svelte": "^5.0.0" },
    devDependencies: { "@hitslop/cli": "latest", "@sveltejs/vite-plugin-svelte": "latest", "vite": "latest" },
  }, null, 2) + "\n");
  await writeFile(join(destination, "manifest.json"), JSON.stringify({
    $schema: "https://hitslop.app/schemas/manifest.schema.json", format: "hitslop/1", runtime: "web", slug,
    title: options.title || defaultTitle,
    description: options.description || "A small, lovable hitSlop app.", author: { name: options.author || userInfo().username }, categories: options.categories?.length ? options.categories : ["Widgets"],
    stores: [{ id: "state", kind: "json", path: "data.json" }], window: { width: 560, height: 420, resizable: true },
  }, null, 2) + "\n");
  await writeFile(join(destination, "data.json"), "{\n  \"count\": 0\n}\n");
  await writeFile(join(destination, "index.html"), "<div id=\"app\"></div><script type=\"module\" src=\"/src/main.ts\"></script>\n");
  await writeFile(join(destination, "src/main.ts"), "import { mount } from 'svelte';\nimport App from './App.svelte';\nmount(App, { target: document.getElementById('app')! });\n");
  await writeFile(join(destination, "src/App.svelte"), `<script lang="ts">\n  import { jsonStore } from '@hitslop/svelte';\n  const state = jsonStore('state', { count: 0 });\n</script>\n\n<main>\n  <h1>${slug}</h1>\n  <button onclick={() => state.update(value => { value.count += 1; })}>\n    Count {state.current.count}\n  </button>\n</main>\n`);
  await writeFile(join(destination, "style.css"), ":root { color-scheme: light dark; font-family: ui-rounded, system-ui, sans-serif; }\nbody { margin: 0; }\nmain { min-height: 100vh; display: grid; place-content: center; gap: 1rem; text-align: center; }\nbutton { padding: .8rem 1.2rem; border-radius: 999px; }\n");
  await writeFile(join(destination, "vite.config.ts"), "import { defineConfig } from 'vite';\nimport { svelte } from '@sveltejs/vite-plugin-svelte';\nexport default defineConfig({ plugins: [svelte()] });\n");
  await writeFile(join(destination, "AGENTS.md"), "# hitSlop authoring\n\nRead `manifest.json` first. Run `bunx @hitslop/cli dev` to preview with isolated stores, then `build` and `publish`. Source stays in this project and is never copied into the runtime `.slop`.\n");
}

export async function buildSlop(root: string): Promise<{ directory: string; manifest: SlopManifest }> {
  const manifest = await loadManifest(root);
  const distRoot = join(root, "dist"); const output = join(distRoot, `${manifest.slug}.slop`); const viteOut = join(root, ".hitslop", "vite-build");
  await rm(output, { recursive: true, force: true }); await rm(viteOut, { recursive: true, force: true });
  await mkdir(join(output, "build"), { recursive: true });
  await viteBuild({ root, plugins: [viteSingleFile()], build: { outDir: viteOut, emptyOutDir: true } });
  const html = join(viteOut, "index.html"); if (!await exists(html)) throw new Error("Vite did not produce index.html");
  await cp(html, join(output, "build/index.html"));
  await cp(manifestPath(root), join(output, "manifest.json"));
  for (const store of manifest.stores) { const source = join(root, store.path); if (!await exists(source)) throw new Error(`Missing declared store: ${store.path}`); await mkdir(dirname(join(output, store.path)), { recursive: true }); await cp(source, join(output, store.path)); }
  for (const name of ["style.css", "assets"]) { const source = join(root, name); if (await exists(source)) await cp(source, join(output, name), { recursive: true }); }
  await writeFile(join(output, "AGENTS.md"), `# ${manifest.title}\n\nThis is a runtime hitSlop document. Read \`manifest.json\` first. Edit only \`style.css\`, files under \`assets/\`, or stores declared in \`stores\`. JSON stores must be replaced atomically. Do not add source, package manifests, dependencies, or build caches. \`build/index.html\` is generated.\n`);
  await rm(viteOut, { recursive: true, force: true }); return { directory: output, manifest };
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
  const files: Zippable = {}; const epoch = new Date("1980-01-01T00:00:00Z");
  for (const path of await walk(directory)) files[path] = [new Uint8Array(await Bun.file(join(directory, path)).arrayBuffer()), { mtime: epoch, level: 9 }];
  const bytes = zipSync(files, { level: 9 }); return { bytes, sha256: sha256(bytes) };
}

export async function writePackedSlop(directory: string): Promise<string> {
  const packed = await packSlop(directory); const output = `${directory}.zip`; await Bun.write(output, packed.bytes); return output;
}
