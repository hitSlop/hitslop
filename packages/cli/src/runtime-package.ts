import { Database } from "bun:sqlite";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { unzipSync } from "fflate";
import { decode as decodePng } from "fast-png";
import { compileDataSchema, type SlopManifest } from "@hitslop/schema";
import { validateDocumentSkill } from "./document-skill.ts";
import { loadManifest } from "./project.ts";
import { validateIconPng, validateStaticPng } from "./static-preview.ts";
import { readThemeContract, validateThemeOverride, validateThemeReferences } from "./theme.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });
const exists = async (path: string): Promise<boolean> => stat(path).then(() => true).catch(() => false);
const MiB = 1024 * 1024;

export type RuntimeValidationOptions = {
  template?: boolean;
  requirePreview?: boolean;
};

export async function validateRuntimePackage(root: string, options: RuntimeValidationOptions = {}): Promise<SlopManifest> {
  if (basename(root).startsWith(".")) throw new Error("Runtime package path is not valid.");
  const rootInfo = await lstat(root).catch(() => undefined);
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("A runtime .slop must be a directory, not a symlink.");
  const manifest = await loadManifest(root);
  await requireUTF8File(join(root, "app.html"), "app.html");
  await rejectSymlinks(root);

  const allowed = new Set(["manifest.json", "app.html", "data.schema.json", "assets", "stores", "QuickLook", ".agents", "Icon\r"]);
  for (const entry of await readdir(root)) if (!allowed.has(entry)) throw new Error(`Runtime packages cannot contain ${entry}.`);
  const forbidden = new Set(["package.json", "bun.lock", "bun.lockb", "node_modules", "source", "src", "build", "document.json", ".build", ".hitslop", "style.css"]);
  for (const path of await walk(root)) {
    if (forbidden.has(basename(path).toLowerCase())) throw new Error(`Runtime packages cannot contain ${relative(root, path)}.`);
  }

  if (options.template && await exists(join(root, "stores"))) throw new Error("Template packages cannot contain stores.");
  if (options.template && await exists(join(root, "Icon\r"))) throw new Error("Template packages cannot contain Finder metadata Icon\\r.");

  const schema = await readDataSchema(root);
  const contract = await readThemeContract(root);
  const appHTML = await readFile(join(root, "app.html"), "utf8");
  validateThemeReferences(appHTML, contract, "app.html");
  await validateStores(root, schema, contract);
  await validateQuickLook(root, options.requirePreview ?? false);
  await validateDocumentSkill(root);
  return manifest;
}

async function readDataSchema(root: string): Promise<Record<string, unknown> | undefined> {
  const current = join(root, "data.schema.json");
  if (!await exists(current)) return undefined;
  await requireUTF8File(current, "data.schema.json");
  try {
    const value = JSON.parse(await readFile(current, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("schema root must be an object");
    compileDataSchema(value);
    return value as Record<string, unknown>;
  } catch (error) {
    throw new Error(`data.schema.json must contain valid JSON Schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateStores(root: string, schema: Record<string, unknown> | undefined, contract: Set<string> | undefined): Promise<void> {
  const stores = join(root, "stores");
  if (!await exists(stores)) return;
  const info = await lstat(stores);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("stores must be a directory.");
  const allowed = new Set(["data.json", "data.sqlite", "data.sqlite-wal", "data.sqlite-shm", "media", "theme.css"]);
  for (const entry of await readdir(stores, { withFileTypes: true })) {
    if (!allowed.has(entry.name)) throw new Error(`Unexpected store entry stores/${entry.name}.`);
    if (entry.name === "media" ? !entry.isDirectory() : !entry.isFile()) throw new Error(`Invalid store entry stores/${entry.name}.`);
  }
  const json = join(stores, "data.json");
  if (await exists(json)) {
    let value: unknown;
    try { value = JSON.parse(decoder.decode(await readFile(json))); }
    catch (error) { throw new Error(`stores/data.json must be valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}`); }
    if (schema) {
      let validator: ReturnType<typeof compileDataSchema>;
      try { validator = compileDataSchema(schema); }
      catch (error) { throw new Error(`The data schema is not supported: ${error instanceof Error ? error.message : String(error)}`); }
      validator(value);
    }
  }
  const sqlite = join(stores, "data.sqlite");
  for (const sidecar of ["data.sqlite-wal", "data.sqlite-shm"]) {
    if (await exists(join(stores, sidecar)) && !await exists(sqlite)) throw new Error(`stores/${sidecar} requires stores/data.sqlite.`);
  }
  if (await exists(sqlite)) validateSQLite(sqlite);
  const media = join(stores, "media");
  if (await exists(media)) await validateMedia(media);
  await validateThemeOverride(root, contract);
}

function validateSQLite(path: string): void {
  let database: Database | undefined;
  try {
    database = new Database(path, { readonly: true, strict: true });
    const rows = database.query("PRAGMA quick_check").all() as Record<string, unknown>[];
    if (rows.length !== 1 || Object.values(rows[0] ?? {})[0] !== "ok") throw new Error("PRAGMA quick_check did not return ok");
  } catch (error) {
    throw new Error(`stores/data.sqlite failed its integrity check: ${error instanceof Error ? error.message : String(error)}`);
  } finally { database?.close(); }
}

async function validateMedia(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Named media must be regular files: stores/media/${entry.name}.`);
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(entry.name)) throw new Error(`Invalid named media key: ${entry.name}.`);
    const bytes = await readFile(join(directory, entry.name));
    if (!isImage(bytes) && !isBoundedZip(bytes)) throw new Error(`Unsupported named media content: ${entry.name}.`);
  }
}

function isImage(bytes: Uint8Array): boolean {
  if (bytes.byteLength > 25 * MiB) return false;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    try { decodePng(bytes, { checkCrc: true }); return true; } catch { return false; }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return true;
  if (String.fromCharCode(...bytes.subarray(0, 6)).match(/^GIF8[79]a$/)) return true;
  return String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
}

function isBoundedZip(bytes: Uint8Array): boolean {
  if (bytes.byteLength > 10 * MiB || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  try {
    const files = unzipSync(bytes);
    const names = Object.keys(files);
    if (!names.length || names.length > 256) return false;
    let total = 0;
    for (const [name, value] of Object.entries(files)) {
      if (!safeArchivePath(name) || value.byteLength > 25 * MiB) return false;
      total += value.byteLength;
      if (total > 50 * MiB) return false;
    }
    return true;
  } catch { return false; }
}

const safeArchivePath = (path: string): boolean => Boolean(path) && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") && path.replace(/\/$/, "").split("/").every((part) => part && part !== "." && part !== "..");

async function validateQuickLook(root: string, required: boolean): Promise<void> {
  const directory = join(root, "QuickLook");
  if (!await exists(directory)) {
    if (required) throw new Error("Template packages must contain QuickLook/Preview.png and QuickLook/Icon.png.");
    return;
  }
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("QuickLook must be a directory.");
  const allowed = new Set(["Preview.png", "Icon.png"]);
  for (const entry of await readdir(directory)) if (!allowed.has(entry)) throw new Error(`Unexpected QuickLook entry QuickLook/${entry}.`);
  const preview = join(directory, "Preview.png");
  const icon = join(directory, "Icon.png");
  if (required && (!await exists(preview) || !await exists(icon))) throw new Error("Template packages must contain QuickLook/Preview.png and QuickLook/Icon.png.");
  if (await exists(preview)) validateStaticPng(await readFile(preview), "QuickLook/Preview.png");
  if (await exists(icon)) validateIconPng(await readFile(icon));
}

async function requireUTF8File(path: string, label: string): Promise<void> {
  const info = await lstat(path).catch(() => undefined);
  if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular file.`);
  try { decoder.decode(await readFile(path)); }
  catch { throw new Error(`${label} must be UTF-8.`); }
}

async function rejectSymlinks(root: string): Promise<void> {
  for (const path of await walk(root)) if ((await lstat(path)).isSymbolicLink()) throw new Error(`Runtime packages cannot contain symlinks: ${relative(root, path)}.`);
}

async function walk(root: string, directory = root): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    result.push(path);
    if (entry.isDirectory() && !entry.isSymbolicLink()) result.push(...await walk(root, path));
  }
  return result.sort((left, right) => relative(root, left).split(sep).join("/").localeCompare(relative(root, right).split(sep).join("/")));
}
