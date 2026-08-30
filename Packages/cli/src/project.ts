import { cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { userInfo } from "node:os";
import { Database } from "bun:sqlite";
import { zipSync, type Zippable } from "fflate";
import { decode as decodePng } from "fast-png";
import { build as viteBuild } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { parseManifest, storePath, type SlopManifest } from "@hitslop/schema";
import cliPackage from "../package.json" with { type: "json" };

export const manifestPath = (root: string): string => join(root, "manifest.json");
export async function loadManifest(root: string): Promise<SlopManifest> {
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath(root), "utf8")));
  await validateWindowShape(root, manifest);
  await validateStores(root, manifest);
  return manifest;
}

const exists = async (path: string): Promise<boolean> => { try { await stat(path); return true; } catch { return false; } };
export const sha256 = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

async function validateWindowShape(root: string, manifest: SlopManifest): Promise<void> {
  if (manifest.window.shape.kind !== "imageMask") return;
  const path = join(root, manifest.window.shape.path);
  if (!await exists(path)) throw new Error(`Missing window image mask: ${manifest.window.shape.path}`);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("The window image mask must be a regular file, not a symlink.");
  let png: ReturnType<typeof decodePng>;
  try {
    png = decodePng(await readFile(path), { checkCrc: true });
  } catch {
    throw new Error("The window image mask must be a valid PNG image.");
  }
  if (png.width !== manifest.window.width || png.height !== manifest.window.height) {
    throw new Error(`The window image mask must be exactly ${manifest.window.width}x${manifest.window.height} pixels; received ${png.width}x${png.height}.`);
  }
  if (png.channels !== 2 && png.channels !== 4) throw new Error("The window image mask PNG must contain an explicit alpha channel.");
}

async function validateStores(root: string, manifest: SlopManifest): Promise<void> {
  for (const [id, store] of Object.entries(manifest.stores)) {
    const path = storePath(id, store.kind);
    const absolute = join(root, path);
    if (!await exists(absolute)) throw new Error(`Missing declared store: ${path}`);
    const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Store must be a regular file: ${path}`);
    if (store.kind === "json") {
      const bytes = await readFile(absolute);
      if (store.maxBytes && bytes.byteLength > store.maxBytes) throw new Error(`Store exceeds maxBytes: ${path}`);
      try { JSON.parse(bytes.toString("utf8")); } catch { throw new Error(`Store must contain valid UTF-8 JSON: ${path}`); }
      continue;
    }
    const database = new Database(absolute, { readonly: true });
    try {
      const result = database.query("PRAGMA quick_check").values();
      if (result.length !== 1 || result[0]?.[0] !== "ok") throw new Error(`SQLite quick_check failed: ${path}`);
      if (store.maxBytes && database.serialize().byteLength > store.maxBytes) throw new Error(`Store exceeds maxBytes: ${path}`);
    } finally { database.close(); }
  }
}

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
  await mkdir(join(destination, "stores"), { recursive: true });
  await writeFile(join(destination, "package.json"), JSON.stringify({
    name: slug, private: true, type: "module", scripts: { dev: "slop dev", build: "slop build", publish: "slop publish" },
    dependencies: { "@hitslop/runtime": `^${cliPackage.version}`, "@hitslop/svelte": `^${cliPackage.version}`, "svelte": "^5.0.0" },
    devDependencies: { "@hitslop/cli": `^${cliPackage.version}`, "@sveltejs/vite-plugin-svelte": "^7.0.0", "vite": "^8.0.0" },
  }, null, 2) + "\n");
  await writeFile(join(destination, "manifest.json"), JSON.stringify({
    $schema: "https://hitslop.app/schemas/manifest.schema.json", slug,
    title: options.title || defaultTitle,
    description: options.description || "A small, lovable hitSlop app.", author: { name: options.author || userInfo().username }, categories: options.categories?.length ? options.categories : ["Widgets"],
    stores: { state: { kind: "json" } }, window: { width: 560, height: 420, resizable: true, shape: { kind: "roundedRect", radius: 22 } },
  }, null, 2) + "\n");
  await writeFile(join(destination, "stores/state.json"), "{\n  \"count\": 0\n}\n");
  await writeFile(join(destination, "index.html"), "<div id=\"app\"></div><script type=\"module\" src=\"/src/main.ts\"></script>\n");
  await writeFile(join(destination, "src/main.ts"), "import { mount } from 'svelte';\nimport { ready } from '@hitslop/runtime';\nimport App from './App.svelte';\nmount(App, { target: document.getElementById('app')! });\nready();\n");
  await writeFile(join(destination, "src/App.svelte"), `<script lang="ts">\n  import { jsonStore } from '@hitslop/svelte';\n  const state = jsonStore('state', { count: 0 });\n</script>\n\n<main>\n  <h1>${slug}</h1>\n  <button onclick={() => state.update(value => { value.count += 1; })}>\n    Count {state.current.count}\n  </button>\n</main>\n`);
  await writeFile(join(destination, "style.css"), ":root { color-scheme: light; font-family: ui-rounded, system-ui, sans-serif; background: #f6f7fb; color: #20222a; }\nhtml, body { margin: 0; background: #f6f7fb; }\nmain { min-height: 100vh; display: grid; place-content: center; gap: 1rem; text-align: center; }\nbutton { padding: .8rem 1.2rem; border: 1px solid #d8dbe5; border-radius: 999px; background: white; color: inherit; }\n");
  await writeFile(join(destination, "vite.config.ts"), "import { defineConfig } from 'vite';\nimport { svelte } from '@sveltejs/vite-plugin-svelte';\nexport default defineConfig({ plugins: [svelte()] });\n");
  await writeFile(join(destination, "AGENTS.md"), "# hitSlop authoring\n\nRead `manifest.json` first. Run `bunx @hitslop/cli dev` to preview with isolated stores, then `build` and `publish`. Source stays in this project and is never copied into the runtime `.slop`.\n");
}

export async function buildSlop(root: string): Promise<{ directory: string; manifest: SlopManifest }> {
  const manifest = await loadManifest(root);
  if (manifest.document) throw new Error("Authoring manifests cannot contain host-owned document metadata.");
  const distRoot = join(root, "dist"); const output = join(distRoot, `${manifest.slug}.slop`); const viteOut = join(root, ".hitslop", "vite-build");
  await rm(output, { recursive: true, force: true }); await rm(viteOut, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await viteBuild({ root, plugins: [viteSingleFile()], build: { outDir: viteOut, emptyOutDir: true } });
  const html = join(viteOut, "index.html"); if (!await exists(html)) throw new Error("Vite did not produce index.html");
  await cp(html, join(output, "app.html"));
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [id, store] of Object.entries(manifest.stores)) {
    const path = storePath(id, store.kind);
    const source = join(root, path);
    if (!await exists(source)) throw new Error(`Missing declared store: ${path}`);
    if ((await lstat(source)).isSymbolicLink()) throw new Error(`Symlinks are not allowed in artifacts: ${path}`);
    await mkdir(dirname(join(output, path)), { recursive: true });
    if (store.kind === "sqlite") {
      const database = new Database(source, { readonly: true });
      try {
        // VACUUM INTO includes committed WAL frames without checkpointing the
        // authoring database and emits a standalone rollback-journal database.
        // A raw serialize() preserves the WAL header, which makes the copied
        // file impossible to reopen read-only without its discarded sidecars.
        database.query("VACUUM INTO ?").run(join(output, path));
      } finally { database.close(); }
    } else {
      await cp(source, join(output, path));
    }
  }
  for (const name of ["style.css", "assets"]) {
    const source = join(root, name);
    if (await exists(source)) await copyRuntimeTree(source, join(output, name));
  }
  await writeFile(join(output, "AGENTS.md"), `# ${manifest.title}\n\nThis is a runtime hitSlop document. Read \`manifest.json\` first. Edit only \`style.css\`, files under \`assets/\`, or files under \`stores/\` declared by the manifest. JSON stores must be replaced atomically. Do not add source, package manifests, dependencies, or build caches. \`app.html\`, \`manifest.json\`, and \`QuickLook/\` are host-owned.\n`);
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
