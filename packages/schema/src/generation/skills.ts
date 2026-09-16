import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { documentSkillContent } from "../document-skill.ts";

export async function generateSkills(
  repositoryRoot: string,
  sourceRoot: string,
  generated: string,
) {
  const swiftDocumentSkill = resolve(
    repositoryRoot,
    "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/hitslop-document.SKILL.md",
  );
  await mkdir(resolve(swiftDocumentSkill, ".."), { recursive: true });
  await writeFile(swiftDocumentSkill, documentSkillContent);

  const packagedSkillRoots = [
    resolve(repositoryRoot, "packages/cli/skills"),
    resolve(
      repositoryRoot,
      "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/skills",
    ),
  ];
  for (const name of ["hitslop-authoring", "hitslop-design"] as const) {
    const source = resolve(sourceRoot, ".agents/skills", name);
    for (const root of packagedSkillRoots) {
      const destination = join(root, name);
      await rm(destination, { recursive: true, force: true });
      await mkdir(root, { recursive: true });
      await cp(source, destination, { recursive: true });
    }
  }
  for (const root of packagedSkillRoots) {
    const skill = join(root, "hitslop-document", "SKILL.md");
    await mkdir(dirname(skill), { recursive: true });
    await writeFile(skill, documentSkillContent);
  }
}
