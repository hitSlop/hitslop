import { chmod, cp, lstat, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import type { SlopManifest } from "@hitslop/schema";
import { runNative } from "./dev.ts";
import { buildSlop, loadManifest } from "./project.ts";
import { validateIconPng, validateStaticPng, writeDefaultIcon } from "./static-preview.ts";

export type InstallOptions = {
  force?: boolean;
  preview?: string;
  icon?: string;
  templatesRoot?: string;
  confirmOverwrite?: (target: string) => Promise<boolean>;
  capturePreview?: (packageDirectory: string, output: string) => Promise<void>;
  captureIcon?: (packageDirectory: string, output: string) => Promise<boolean>;
};

export type InstallResult = { directory: string; manifest: SlopManifest; replaced: boolean };
const exists = async (path: string): Promise<boolean> => stat(path).then(() => true).catch(() => false);

export async function installTemplate(input: string, options: InstallOptions = {}): Promise<InstallResult> {
  const source = resolve(input);
  const runtime = await isRuntimePackage(source) ? source : (await buildSlop(source)).directory;
  const manifest = await loadManifest(runtime);
  await validateTemplatePackage(runtime);

  const templatesRoot = resolve(options.templatesRoot ?? process.env.HITSLOP_TEMPLATES_ROOT ?? join(homedir(), ".hitslop", "templates"));
  const target = join(templatesRoot, `${manifest.slug}.slop`);
  const replaced = await exists(target);
  if (replaced && !options.force) {
    if (!options.confirmOverwrite) throw new Error(`Template ${manifest.slug} is already installed. Pass --force to replace it.`);
    if (!await options.confirmOverwrite(target)) throw new Error("Install cancelled.");
  }

  await mkdir(templatesRoot, { recursive: true });
  const staging = join(templatesRoot, `.${manifest.slug}.${randomUUID()}.installing.slop`);
  const backup = join(templatesRoot, `.${manifest.slug}.${randomUUID()}.backup.slop`);
  try {
    await cp(runtime, staging, { recursive: true, errorOnExist: true });
    const quickLook = join(staging, "QuickLook");
    const preview = join(quickLook, "Preview.png");
    await mkdir(quickLook, { recursive: true });
    if (options.preview) await cp(resolve(options.preview), preview);
    else {
      const capture = options.capturePreview ?? ((packageDirectory: string, output: string) => runNative(["screenshot", packageDirectory, "--output", output]));
      await capture(staging, preview);
    }
    await validatePreview(preview);
    const icon = join(quickLook, "Icon.png");
    if (options.icon) await cp(resolve(options.icon), icon);
    else {
      await rm(icon, { force: true });
      const captured = options.captureIcon
        ? await options.captureIcon(staging, icon)
        : await captureOptionalIcon(staging, icon);
      if (!captured || !await exists(icon)) await writeDefaultIcon(preview, icon);
    }
    validateIconPng(await readFile(icon));
    // Rendering can initialize lazy stores. An installed template must remain
    // pristine so every document creates its own first-run state.
    await rm(join(staging, "stores"), { recursive: true, force: true });
    await validateQuickLook(staging, true);
    if (replaced) {
      await makePackageWritable(target);
      await rename(target, backup);
    }
    try { await rename(staging, target); }
    catch (error) { if (replaced && await exists(backup)) await rename(backup, target); throw error; }
    await makePackageImmutable(target);
    await rm(backup, { recursive: true, force: true });
    return { directory: target, manifest, replaced };
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (await exists(backup) && !await exists(target)) {
      await rename(backup, target);
      await makePackageImmutable(target).catch(() => {});
    } else await rm(backup, { recursive: true, force: true });
  }
}

async function captureOptionalIcon(packageDirectory: string, output: string): Promise<boolean> {
  await runNative(["screenshot", packageDirectory, "--target", "icon", "--if-present", "--output", output]);
  return await exists(output);
}

async function validatePreview(path: string): Promise<void> {
  validateStaticPng(await readFile(path), "The template preview");
}

async function isRuntimePackage(path: string): Promise<boolean> {
  return await exists(join(path, "manifest.json")) && await exists(join(path, "app.html"));
}

export async function validateTemplatePackage(path: string, options: { requirePreview?: boolean } = {}): Promise<void> {
  if (basename(path).startsWith(".")) throw new Error("Runtime package path is not valid for installation.");
  await rejectForbiddenRuntimeEntries(path);
  const allowed = new Set(["manifest.json", "app.html", "assets", "QuickLook"]);
  for (const entry of await readdir(path)) if (!allowed.has(entry)) throw new Error(`Template packages cannot contain ${entry}.`);
  await validateQuickLook(path, options.requirePreview ?? false);
}

async function validateQuickLook(path: string, requirePreview: boolean): Promise<void> {
  const directory = join(path, "QuickLook");
  if (!await exists(directory)) {
    if (requirePreview) throw new Error("Template packages must contain QuickLook/Preview.png and QuickLook/Icon.png.");
    return;
  }
  const allowed = new Set(["Preview.png", "Icon.png"]);
  for (const entry of await readdir(directory)) if (!allowed.has(entry)) throw new Error(`Template packages cannot contain QuickLook/${entry}.`);
  const preview = join(directory, "Preview.png");
  const icon = join(directory, "Icon.png");
  if (!await exists(preview) || !await exists(icon)) {
    if (requirePreview) throw new Error("Template packages must contain QuickLook/Preview.png and QuickLook/Icon.png.");
    return;
  }
  await validatePreview(preview);
  validateIconPng(await readFile(icon));
}

async function rejectForbiddenRuntimeEntries(directory: string): Promise<void> {
  // "icon\r" (lowercased "Icon\r") is macOS Finder's custom-icon metadata file;
  // the host derives it locally after install, so packages must not ship one.
  const forbidden = new Set(["package.json", "bun.lock", "bun.lockb", "node_modules", "source", "src", "build", "document.json", ".build", ".hitslop", "style.css", "stores", "icon\r"]);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Runtime packages cannot contain symlinks: ${entry.name}.`);
    if (forbidden.has(entry.name.toLowerCase())) throw new Error(`Runtime packages cannot contain ${entry.name}.`);
    if (entry.isDirectory()) await rejectForbiddenRuntimeEntries(join(directory, entry.name));
  }
}

export async function makePackageWritable(root: string): Promise<void> {
  const walk = async (path: string) => {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Runtime packages cannot contain symlinks: ${path}`);
    const mode = info.mode & 0o777;
    await chmod(path, mode | (info.isDirectory() ? 0o700 : 0o600));
    if (info.isDirectory()) for (const entry of await readdir(path)) await walk(join(path, entry));
  };
  await walk(root);
}

export async function makePackageImmutable(root: string): Promise<void> {
  const walk = async (path: string) => {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Runtime packages cannot contain symlinks: ${path}`);
    if (info.isDirectory()) for (const entry of await readdir(path)) await walk(join(path, entry));
    await chmod(path, (info.mode & 0o777) & ~0o222);
  };
  await walk(root);
}
