import { chmod, cp, lstat, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { SlopManifest } from "@hitslop/schema";
import { buildSlop, loadManifest } from "./project.ts";
import { validateRuntimePackage } from "./runtime-package.ts";
import { prepareTemplateCaptures, type TemplateCaptureOptions } from "./template-capture.ts";

export type InstallOptions = TemplateCaptureOptions & {
  force?: boolean;
  templatesRoot?: string;
  confirmOverwrite?: (target: string) => Promise<boolean>;
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
  const stagingRoot = join(templatesRoot, `.${manifest.slug}.${randomUUID()}.installing`);
  const staging = join(stagingRoot, `${manifest.slug}.slop`);
  const backup = join(templatesRoot, `.${manifest.slug}.${randomUUID()}.backup.slop`);
  try {
    await mkdir(stagingRoot);
    await cp(runtime, staging, { recursive: true, errorOnExist: true });
    await prepareTemplateCaptures(staging, options);
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
    await rm(stagingRoot, { recursive: true, force: true });
    if (await exists(backup) && !await exists(target)) {
      await rename(backup, target);
      await makePackageImmutable(target).catch(() => {});
    } else await rm(backup, { recursive: true, force: true });
  }
}

async function isRuntimePackage(path: string): Promise<boolean> {
  return await exists(join(path, "manifest.json")) && await exists(join(path, "app.html"));
}

export async function validateTemplatePackage(path: string, options: { requirePreview?: boolean } = {}): Promise<void> {
  await validateRuntimePackage(path, { template: true, requirePreview: options.requirePreview ?? false });
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
