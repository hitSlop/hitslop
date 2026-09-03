import { decode as decodePng } from "fast-png";
import * as z from "zod";
import { documentGuidePath, documentSkillPath, isCanonicalDocumentSkill, maxDocumentGuideBytes } from "@hitslop/schema";

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

export function validatePackagePath(name: string): void {
  const path = name.replace(/\/$/, "");
  if (["manifest.json", "app.html", "data.schema.json", "assets", "QuickLook", ".agents", ".agents/skills", ".agents/skills/hitslop-document", ".agents/skills/hitslop-document/references", documentSkillPath, documentGuidePath].includes(path)) return;
  if (path.startsWith("assets/") || path === "QuickLook/Preview.png" || path === "QuickLook/Icon.png") return;
  throw new Error(`Template packages cannot contain ${name}`);
}

export function validatePackageMetadata(files: Record<string, Uint8Array>): void {
  const schema = files["data.schema.json"];
  if (schema) {
    try {
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(schema));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("schema root must be an object");
      z.fromJSONSchema(value);
    } catch (error) {
      throw new Error(`Artifact data schema must be valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const skill = files[documentSkillPath];
  if (!skill) throw new Error(`Artifact must contain ${documentSkillPath}`);
  try {
    if (!isCanonicalDocumentSkill(skill)) throw new Error("mismatch");
  } catch {
    throw new Error(`${documentSkillPath} is not a recognized canonical hitSlop document skill`);
  }
  const guide = files[documentGuidePath];
  if (guide) {
    if (guide.byteLength > maxDocumentGuideBytes) throw new Error(`${documentGuidePath} exceeds 32 KiB`);
    try { new TextDecoder("utf-8", { fatal: true }).decode(guide); }
    catch { throw new Error(`${documentGuidePath} must be UTF-8`); }
  }
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
