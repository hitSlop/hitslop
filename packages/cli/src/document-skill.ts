import { lstat, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  documentGuidePath,
  documentGuideSource,
  documentSkillContent,
  documentSkillPath,
  isCanonicalDocumentSkill,
  maxDocumentGuideBytes,
} from "@hitslop/schema";

const decoder = new TextDecoder("utf-8", { fatal: true });
const exists = async (path: string): Promise<boolean> => stat(path).then(() => true).catch(() => false);

export async function emitDocumentSkill(sourceRoot: string, outputRoot: string): Promise<void> {
  const skill = join(outputRoot, documentSkillPath);
  await mkdir(dirname(skill), { recursive: true });
  await writeFile(skill, documentSkillContent);
  const guide = await readDocumentGuideSource(sourceRoot);
  if (!guide) return;
  const destination = join(outputRoot, documentGuidePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, guide);
}

export async function readDocumentGuideSource(sourceRoot: string): Promise<Buffer | undefined> {
  const guideSource = join(sourceRoot, documentGuideSource);
  if (!await exists(guideSource)) return undefined;
  const info = await lstat(guideSource);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${documentGuideSource} must be a regular UTF-8 Markdown file.`);
  const guide = await readFile(guideSource);
  if (guide.byteLength > maxDocumentGuideBytes) throw new Error(`${documentGuideSource} cannot exceed 32 KiB.`);
  try { decoder.decode(guide); }
  catch { throw new Error(`${documentGuideSource} must be UTF-8.`); }
  return guide;
}

export async function validateDocumentSkill(root: string): Promise<void> {
  const agents = join(root, ".agents");
  if (!await exists(agents)) {
    throw new Error(`Runtime package is missing ${documentSkillPath}.`);
  }
  await requireDirectory(agents, ".agents");
  await requireOnly(agents, new Set(["skills"]), ".agents");
  const skills = join(agents, "skills");
  await requireDirectory(skills, ".agents/skills");
  await requireOnly(skills, new Set(["hitslop-document"]), ".agents/skills");
  const folder = join(skills, "hitslop-document");
  await requireDirectory(folder, ".agents/skills/hitslop-document");
  await requireOnly(folder, new Set(["SKILL.md", "references"]), ".agents/skills/hitslop-document", true);

  const skillPath = join(root, documentSkillPath);
  const skillInfo = await lstat(skillPath).catch(() => undefined);
  if (!skillInfo?.isFile() || skillInfo.isSymbolicLink()) throw new Error(`${documentSkillPath} must be a regular file.`);
  let canonical = false;
  try { canonical = isCanonicalDocumentSkill(await readFile(skillPath)); }
  catch { throw new Error(`${documentSkillPath} must be UTF-8.`); }
  if (!canonical) throw new Error(`${documentSkillPath} is not a recognized canonical hitSlop document skill.`);

  const references = join(folder, "references");
  if (!await exists(references)) return;
  await requireDirectory(references, ".agents/skills/hitslop-document/references");
  await requireOnly(references, new Set(["app-guide.md"]), ".agents/skills/hitslop-document/references");
  const guide = join(root, documentGuidePath);
  const guideInfo = await lstat(guide);
  if (!guideInfo.isFile() || guideInfo.isSymbolicLink()) throw new Error(`${documentGuidePath} must be a regular file.`);
  const contents = await readFile(guide);
  if (contents.byteLength > maxDocumentGuideBytes) throw new Error(`${documentGuidePath} cannot exceed 32 KiB.`);
  try { decoder.decode(contents); }
  catch { throw new Error(`${documentGuidePath} must be UTF-8.`); }
}

async function requireDirectory(path: string, label: string): Promise<void> {
  const info = await lstat(path).catch(() => undefined);
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be a directory, not a symlink.`);
}

async function requireOnly(directory: string, allowed: Set<string>, label: string, optionalReferences = false): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`${label} cannot contain symlinks.`);
    if (!allowed.has(entry.name) || (optionalReferences && entry.name === "references" && !entry.isDirectory())) {
      throw new Error(`${label} cannot contain ${entry.name}.`);
    }
  }
}
