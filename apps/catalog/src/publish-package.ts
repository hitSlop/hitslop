import { decode as decodePng } from "fast-png";

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

export function validatePackagePath(name: string): void {
  const path = name.replace(/\/$/, "");
  if (["manifest.json", "app.html", "assets", "QuickLook"].includes(path)) return;
  if (path.startsWith("assets/") || path === "QuickLook/Preview.png" || path === "QuickLook/Thumbnail.png") return;
  throw new Error(`Template packages cannot contain ${name}`);
}

export function validateStaticPreviews(files: Record<string, Uint8Array>): Uint8Array {
  const preview = files["QuickLook/Preview.png"];
  const thumbnail = files["QuickLook/Thumbnail.png"];
  if (!preview || !thumbnail) throw new Error("Artifact must contain QuickLook/Preview.png and QuickLook/Thumbnail.png");
  validatePng(preview, "QuickLook/Preview.png");
  validatePng(thumbnail, "QuickLook/Thumbnail.png");
  return preview;
}

function validatePng(bytes: Uint8Array, label: string): ReturnType<typeof decodePng> {
  if (bytes.byteLength > MAX_PREVIEW_BYTES) throw new Error(`${label} exceeds 5 MiB`);
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image`); }
}
