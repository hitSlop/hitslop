import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseLocalTemplateInstall, storePath, type LocalTemplateInstall, type SlopManifest } from "@hitslop/schema";
import { runNative } from "./dev.ts";
import { buildSlop, loadManifest, packSlop } from "./project.ts";

export type InstallOptions = {
  force?: boolean;
  screenshot?: string;
  templatesRoot?: string;
  confirmOverwrite?: (target: string) => Promise<boolean>;
  captureScreenshot?: (packageDirectory: string, output: string) => Promise<void>;
  now?: () => Date;
};

export type InstallResult = {
  directory: string;
  manifest: SlopManifest;
  replaced: boolean;
};

const exists = async (path: string): Promise<boolean> => stat(path).then(() => true).catch(() => false);

export async function installTemplate(input: string, options: InstallOptions = {}): Promise<InstallResult> {
  const source = resolve(input);
  const runtime = await isRuntimePackage(source) ? source : (await buildSlop(source)).directory;
  const manifest = await loadManifest(runtime);
  await validateRuntimePackage(runtime, manifest);

  const templatesRoot = resolve(options.templatesRoot ?? process.env.HITSLOP_TEMPLATES_ROOT ?? join(homedir(), ".hitslop", "templates"));
  const target = join(templatesRoot, manifest.slug);
  const replaced = await exists(target);
  if (replaced && !options.force) {
    if (!options.confirmOverwrite) throw new Error(`Template ${manifest.slug} is already installed. Pass --force to replace it.`);
    if (!await options.confirmOverwrite(target)) throw new Error("Install cancelled.");
  }

  await mkdir(templatesRoot, { recursive: true });
  const staging = join(templatesRoot, `.${manifest.slug}.${randomUUID()}.installing`);
  const backup = join(templatesRoot, `.${manifest.slug}.${randomUUID()}.backup`);
  try {
    await mkdir(staging, { recursive: true });
    const templatePackage = join(staging, "template.slop");
    await cp(runtime, templatePackage, { recursive: true, errorOnExist: true });
    const quickLook = join(templatePackage, "QuickLook");
    const preview = join(quickLook, "Preview.png");
    await mkdir(quickLook, { recursive: true });
    if (options.screenshot) {
      await cp(resolve(options.screenshot), preview);
    } else {
      const capture = options.captureScreenshot ?? ((packageDirectory: string, output: string) => runNative(["screenshot", packageDirectory, "--output", output]));
      await capture(templatePackage, preview);
    }
    const previewBytes = await readFile(preview);
    if (previewBytes.byteLength === 0) throw new Error("The template preview is empty.");
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!pngSignature.every((byte, index) => previewBytes[index] === byte)) throw new Error("The template preview must be a PNG image.");
    await cp(preview, join(quickLook, "Thumbnail.png"));
    const { sha256 } = await packSlop(templatePackage);

    const install = parseLocalTemplateInstall({
      artifactSha256: sha256,
      installedAt: (options.now?.() ?? new Date()).toISOString(),
    } satisfies LocalTemplateInstall);
    await writeFile(join(staging, "install.json"), `${JSON.stringify(install, null, 2)}\n`);

    if (replaced) await rename(target, backup);
    try {
      await rename(staging, target);
    } catch (error) {
      if (replaced && await exists(backup)) await rename(backup, target);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
    return { directory: target, manifest, replaced };
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (await exists(backup) && !await exists(target)) await rename(backup, target);
    else await rm(backup, { recursive: true, force: true });
  }
}

async function isRuntimePackage(path: string): Promise<boolean> {
  return await exists(join(path, "manifest.json")) && await exists(join(path, "app.html"));
}

async function validateRuntimePackage(path: string, manifest: SlopManifest): Promise<void> {
  await rejectForbiddenRuntimeEntries(path);
  if (basename(path).startsWith(".")) throw new Error("Runtime package path is not valid for installation.");
  const allowed = new Set(["manifest.json", "app.html", "style.css", "assets", "stores", "QuickLook", "AGENTS.md", "Icon\r"]);
  for (const entry of await readdir(path)) {
    if (!allowed.has(entry)) throw new Error(`Runtime packages cannot contain ${entry}.`);
  }
  for (const [id, store] of Object.entries(manifest.stores)) {
    const relative = storePath(id, store.kind);
    if (!await exists(join(path, relative))) throw new Error(`Missing declared store: ${relative}`);
  }
}

async function rejectForbiddenRuntimeEntries(directory: string): Promise<void> {
  const forbidden = new Set(["package.json", "bun.lock", "bun.lockb", "node_modules", "source", "src", "build", "document.json", ".build", ".hitslop"]);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (forbidden.has(entry.name.toLowerCase())) throw new Error(`Runtime packages cannot contain ${entry.name}.`);
    if (entry.isDirectory()) await rejectForbiddenRuntimeEntries(join(directory, entry.name));
  }
}
