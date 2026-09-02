import { decode as decodePng } from "fast-png";

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

export function validatePackagePath(name: string): void {
  const path = name.replace(/\/$/, "");
  if (["manifest.json", "app.html", "assets", "QuickLook"].includes(path)) return;
  if (path.startsWith("assets/") || path === "QuickLook/Preview.png" || path === "QuickLook/Icon.png") return;
  throw new Error(`Template packages cannot contain ${name}`);
}

export function validateStaticImages(files: Record<string, Uint8Array>): { preview: Uint8Array; icon: Uint8Array } {
  const preview = files["QuickLook/Preview.png"];
  const icon = files["QuickLook/Icon.png"];
  if (!preview || !icon) throw new Error("Artifact must contain QuickLook/Preview.png and QuickLook/Icon.png");
  validatePng(preview, "QuickLook/Preview.png");
  const decodedIcon = validatePng(icon, "QuickLook/Icon.png");
  if (decodedIcon.width !== 512 || decodedIcon.height !== 512) throw new Error("QuickLook/Icon.png must be exactly 512x512 pixels");
  return { preview, icon };
}

function validatePng(bytes: Uint8Array, label: string): ReturnType<typeof decodePng> {
  if (bytes.byteLength > MAX_PREVIEW_BYTES) throw new Error(`${label} exceeds 5 MiB`);
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image`); }
}
