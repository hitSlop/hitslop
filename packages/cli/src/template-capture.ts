import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runNative } from "./native.ts";
import { validateIconPng, validateStaticPng, writeDefaultIcon } from "./static-preview.ts";
import { validateRuntimePackage } from "./runtime-package.ts";

export type TemplateCaptureOptions = {
  preview?: string;
  icon?: string;
  capturePreview?: (directory: string, output: string) => Promise<void>;
  captureIcon?: (directory: string, output: string) => Promise<boolean>;
};

/** Only call on a build or staging copy, never a user's writable document. */
export async function prepareTemplateCaptures(directory: string, options: TemplateCaptureOptions = {}): Promise<void> {
  const quickLook = join(directory, "QuickLook");
  await mkdir(quickLook, { recursive: true });
  const preview = join(quickLook, "Preview.png");
  const icon = join(quickLook, "Icon.png");
  try {
    if (options.preview) await cp(resolve(options.preview), preview);
    else await (options.capturePreview ?? ((path, output) => runNative(["screenshot", path, "--output", output])))(directory, preview);
    validateStaticPng(await readFile(preview), "The template preview");
    if (options.icon) await cp(resolve(options.icon), icon);
    else {
      await rm(icon, { force: true });
      const captured = options.captureIcon
        ? await options.captureIcon(directory, icon)
        : await runNative(["screenshot", directory, "--target", "icon", "--if-present", "--output", icon]).then(() => Bun.file(icon).exists());
      if (!captured || !await Bun.file(icon).exists()) await writeDefaultIcon(preview, icon);
    }
    validateIconPng(await readFile(icon));
  } finally {
    // Captures may initialize lazy state. Masters must always remain store-free.
    await rm(join(directory, "stores"), { recursive: true, force: true });
  }
  await validateRuntimePackage(directory, { template: true, requirePreview: true });
}
