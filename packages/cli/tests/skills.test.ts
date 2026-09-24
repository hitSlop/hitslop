import { test, expect } from "bun:test";
import {
  mkdtemp,
  rm,
  readFile,
  mkdir,
  symlink,
  readlink,
  writeFile,
  access,
  realpath,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { buildSkills } from "../src/skills-build";

test("skills are deterministic, self-contained and describe the active commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "hsl-skills-"));
  try {
    const first = join(root, "first/skills"),
      second = join(root, "second/skills");
    const files = await buildSkills(first);
    expect(await buildSkills(second)).toEqual(files);
    for (const file of files) {
      const content = await readFile(join(first, file), "utf8");
      expect(content).toBe(await readFile(join(second, file), "utf8"));
      expect(content).not.toContain(process.cwd());
      for (const match of content.matchAll(/\]\((references\/[^)#]+)(?:#[^)]*)?\)/g))
        await access(join(first, file, "..", match[1]!));
    }
    for (const command of [
      "init",
      "dev",
      "build",
      "register",
      "schema",
      "get",
      "apply",
      "batch",
      "compact",
      "export",
      "skills",
    ])
      expect(files).toContain(`hitslop-cli/commands/${command}.md`);
    for (const name of [
      "hitslop",
      "hitslop-authoring",
      "hitslop-design",
      "hitslop-document",
      "hitslop-cli",
    ])
      expect(await readFile(join(first, name, "SKILL.md"), "utf8")).toContain(`name: ${name}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Crust installs and repairs links without replacing conflicting directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "hsl-skill-links-"));
  try {
    const home = join(root, "home"),
      project = join(root, "project"),
      skills = join(root, "bundle/skills");
    await mkdir(home);
    await mkdir(project);
    await buildSkills(skills);
    // Run in a separate process so homedir and scope resolution cannot touch the real user.
    const module = resolve("packages/cli/node_modules/@crustjs/skills/dist/index.js");
    const script = `import { installSkill, getSkillStatus, uninstallSkill } from ${JSON.stringify(module)};
      import {readlink} from "node:fs/promises";
      const sourceDir = ${JSON.stringify(join(skills, "hitslop-cli"))};
      const options = { sourceDir, agents: ["codex"], scope: "project" };
      await installSkill(options);
      if ((await readlink(".agents/skills/hitslop-cli")).startsWith("/")) throw new Error("Expected relative project link");
      console.log((await getSkillStatus({name:"hitslop-cli", ...options})).agents.find(a=>a.agent==="codex").status);
      await uninstallSkill({name:"hitslop-cli",agents:["codex"],scope:"project"});
      await installSkill({...options,scope:"global"});`;
    const run = async (code: string) => {
      const child = Bun.spawn([process.execPath, "-e", code], {
        cwd: project,
        env: { ...process.env, HOME: home },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, err, status] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect(err).toBe("");
      expect(status).toBe(0);
      return out;
    };
    expect(await run(script)).toContain("linked");
    const globalLink = join(home, ".agents/skills/hitslop-cli");
    expect(await readlink(globalLink)).toBe(join(skills, "hitslop-cli"));
    await rm(globalLink);
    await symlink(join(home, ".hitslop/skills/hitslop-cli"), globalLink);
    await run(script); // Repair an old native-style dangling link.
    expect(await readlink(globalLink)).toBe(join(skills, "hitslop-cli"));
    await rm(globalLink);
    await mkdir(globalLink);
    await run(`import { installSkill } from ${JSON.stringify(module)};
      try { await installSkill({sourceDir:${JSON.stringify(join(skills, "hitslop-cli"))},agents:["codex"],scope:"global"}); throw new Error("Expected conflict"); }
      catch(e) { if(e.name !== "SkillConflictError") throw e; }`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("public skills commands install all guides and update existing links only", async () => {
  const root = await mkdtemp(join(tmpdir(), "hsl-skill-cli-"));
  try {
    const home = join(root, "home"),
      project = join(root, "project");
    await mkdir(home);
    await mkdir(project);
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await writeFile(
      join(root, "cli.ts"),
      `import { app } from ${JSON.stringify(resolve("packages/cli/src/app.ts"))}; await app.execute();`,
    );
    const skills = join(root, ".crust/root/skills");
    await buildSkills(skills);
    const run = async (...args: string[]) => {
      const child = Bun.spawn([process.execPath, join(root, "cli.ts"), ...args], {
        cwd: project,
        env: { ...process.env, HOME: home, PATH: "/usr/bin:/bin" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, err, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect(code).toBe(0);
      expect(err).not.toContain("Error");
      return out;
    };
    await run("skills", "update", "--scope", "global");
    expect(await Bun.file(join(home, ".agents/skills/hitslop-cli/SKILL.md")).exists()).toBe(false);
    await run("skills", "--all", "--scope", "project");
    for (const name of [
      "hitslop",
      "hitslop-authoring",
      "hitslop-design",
      "hitslop-document",
      "hitslop-cli",
    ])
      expect(await readlink(join(project, ".agents/skills", name))).not.toStartWith("/");
    await run("skill", "--all", "--scope", "global");
    const link = join(home, ".agents/skills/hitslop-cli");
    await rm(link);
    await symlink(join(home, ".hitslop/skills/hitslop-cli"), link);
    await run("skills", "update", "--scope", "global");
    expect(await realpath(link)).toBe(await realpath(join(skills, "hitslop-cli")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
