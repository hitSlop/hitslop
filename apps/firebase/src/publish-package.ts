import { decode as decodePng } from "fast-png";
import { checkPngDimensions, compileDataSchema, documentGuidePath, documentSkillPath, maxDocumentGuideBytes } from "@hitslop/schema";
export { validateTemplatePath as validatePackagePath } from "@hitslop/schema";

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

export function validatePackageMetadata(files: Record<string, Uint8Array>): void {
  const schema = files["data.schema.json"];
  if (schema) {
    try {
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(schema));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("schema root must be an object");
      compileDataSchema(value);
    } catch (error) {
      throw new Error(`Artifact data schema must be valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const skill = files[documentSkillPath];
  if (skill) new TextDecoder("utf-8", { fatal: true }).decode(skill);
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
  checkPngDimensions(icon, "QuickLook/Icon.png", { width: 512, height: 512 });
  validatePng(icon, "QuickLook/Icon.png");
  return { preview, icon };
}

function validatePng(bytes: Uint8Array, label: string): ReturnType<typeof decodePng> {
  if (bytes.byteLength > MAX_PREVIEW_BYTES) throw new Error(`${label} exceeds 5 MiB`);
  checkPngDimensions(bytes, label);
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image`); }
}
