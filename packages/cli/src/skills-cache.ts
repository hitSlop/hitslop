import { cp, mkdir, readlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { resolveArtifactDir } from "@crustjs/core";
import { loadPackagedSkills, getSkillStatus, installSkill, type Scope } from "@crustjs/skills";
import metadata from "../package.json";

async function links(scopes: readonly Scope[]) {
  const skills = loadPackagedSkills(resolveArtifactDir("skills"));
  const links = new Map<
    string,
    {
      skill: (typeof skills)[number];
      agent: Awaited<ReturnType<typeof getSkillStatus>>["agents"][number];
      target: string | undefined;
    }
  >();
  for (const skill of skills)
    for (const scope of scopes) {
      const status = await getSkillStatus({ name: skill.name, sourceDir: skill.sourceDir, scope });
      for (const agent of status.agents) {
        if (links.has(agent.outputDir)) continue;
        const target = await readlink(agent.outputDir).catch((error) => {
          if (error.code !== "ENOENT" && error.code !== "EINVAL") throw error;
          return undefined;
        });
        links.set(agent.outputDir, { skill, agent, target });
      }
    }
  return links;
}

/** Observe before the interactive installer chooses its scope/targets. */
export async function captureSkillLinks(scopes: readonly Scope[]) {
  const before = await links(scopes);
  return async () => {
    const copied = new Set<string>();
    const cache = join(homedir(), ".hitslop/cli", metadata.version, "skills");
    for (const [outputDir, { skill, agent, target }] of await links(scopes)) {
      if (
        !target ||
        target === before.get(outputDir)?.target ||
        resolve(dirname(outputDir), target) !== resolve(skill.sourceDir)
      )
        continue;
      const sourceDir = join(cache, skill.name);
      if (!copied.has(skill.name)) {
        await mkdir(cache, { recursive: true });
        await cp(skill.sourceDir, sourceDir, { recursive: true });
        copied.add(skill.name);
      }
      await installSkill({ sourceDir, scope: agent.scope, agents: [agent.agent] });
    }
  };
}
