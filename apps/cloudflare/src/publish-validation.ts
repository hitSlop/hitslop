import type { SlopManifest } from "@hitslop/schema";
import { checkPngDimensions, inspectZip as inspectBoundedZip } from "@hitslop/schema";
export { safeArchivePath } from "@hitslop/schema";
import { decode as decodePng } from "fast-png";
import { validatePackagePath } from "./publish-package.ts";

export function inspectZip(bytes: Uint8Array): void {
  inspectBoundedZip(bytes, validatePackagePath);
}

function validatePng(bytes: Uint8Array, label: string): ReturnType<typeof decodePng> {
  try {
    return decodePng(bytes, { checkCrc: true });
  } catch {
    throw new Error(`${label} must be a valid PNG image`);
  }
}

export function validateSkin(files: Record<string, Uint8Array>, manifest: SlopManifest): void {
  if (!("skin" in manifest.presentation)) return;
  const skin = files[manifest.presentation.skin];
  if (!skin) throw new Error(`Artifact is missing ${manifest.presentation.skin}`);
  checkPngDimensions(skin, "Window skin", manifest.presentation);
  const png = validatePng(skin, "Window skin");
  if (png.channels !== 4) throw new Error("Window skin must be an RGBA PNG image");
}
