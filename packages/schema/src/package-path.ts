import { documentGuidePath, documentSkillPath } from "./document-skill.js";

export const forbiddenPackageNames = new Set(["package.json", "bun.lock", "bun.lockb", "node_modules", "source", "src", "build", "document.json", ".build", ".hitslop", "style.css"]);

export function safeArchivePath(name: string): boolean {
  return Boolean(name) && name.length <= 240 && !name.startsWith("/") && !name.includes("\\") && !name.includes("\0") &&
    name.replace(/\/$/, "").split("/").every(part => Boolean(part) && part !== "." && part !== "..");
}

/** Immutable template entries; directory entries may have a trailing slash. */
export function validateTemplatePath(name: string): void {
  const path = name.replace(/\/$/, "");
  if (!safeArchivePath(name) || path.split("/").some(part => forbiddenPackageNames.has(part.toLowerCase()))) {
    throw new Error(`Template packages cannot contain ${name}`);
  }
  if (["manifest.json", "app.html", "data.schema.json", "assets", "QuickLook", ".agents", ".agents/skills", ".agents/skills/hitslop-document", ".agents/skills/hitslop-document/references", documentSkillPath, documentGuidePath].includes(path)) return;
  if (path.startsWith("assets/") || path === "QuickLook/Preview.png" || path === "QuickLook/Icon.png") return;
  throw new Error(`Template packages cannot contain ${name}`);
}
