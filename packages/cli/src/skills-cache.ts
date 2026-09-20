import { cp, mkdir, readlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { loadPackagedSkills, getSkillStatus, installSkill } from "@crustjs/skills";
import { packagedSkillsDirectory } from "./skills-build";
import metadata from "../package.json";
/** Explicit skills commands may install durable sources; ordinary commands never do. */
export async function stabilizeSkillLinks() {
  const cache = join(homedir(), ".hitslop/cli", metadata.version, "skills");
  const skills = loadPackagedSkills(packagedSkillsDirectory);
  for (const skill of skills)
    for (const scope of ["project", "global"] as const) {
      const status = await getSkillStatus({ name: skill.name, sourceDir: skill.sourceDir, scope });
      for (const agent of status.agents) {
        const target = await readlink(agent.outputDir).catch(() => undefined);
        if (!target || resolve(dirname(agent.outputDir), target) !== resolve(skill.sourceDir))
          continue;
        await mkdir(cache, { recursive: true });
        const sourceDir = join(cache, skill.name);
        await cp(skill.sourceDir, sourceDir, { recursive: true });
        await installSkill({ sourceDir, scope, agents: [agent.agent] });
      }
    }
}
