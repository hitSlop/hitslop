import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { documentSkillContent } from "@hitslop/schema";
import { bundledSkillsRoot, managedSkillNames, syncAgentSkills } from "../src/skills.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("syncAgentSkills", () => {
  test("writes the machine cache and discovery links without touching other skills", async () => {
    const root = await mkdtemp(join(tmpdir(), "hitslop-skills-")); roots.push(root);
    const cacheRoot = join(root, "cache");
    const agents = join(root, "agents");
    const claude = join(root, "claude");
    await mkdir(join(agents, "other-skill"), { recursive: true });
    await writeFile(join(agents, "other-skill", "SKILL.md"), "keep me\n");

    const first = await syncAgentSkills({ cacheRoot, discoveryRoots: [agents, claude] });
    expect(first.installed).toBe(true);
    expect(first.cache).toBe(cacheRoot);
    for (const name of managedSkillNames) {
      expect(await readFile(join(cacheRoot, name, "SKILL.md"), "utf8")).toContain("name: " + name);
      expect((await lstat(join(agents, name))).isSymbolicLink()).toBe(true);
      expect(await readlink(join(agents, name))).toBe(join(cacheRoot, name));
      expect(await readlink(join(claude, name))).toBe(join(cacheRoot, name));
    }
    expect(await readFile(join(cacheRoot, "hitslop-document", "SKILL.md"), "utf8")).toBe(documentSkillContent);
    expect(await readFile(join(agents, "other-skill", "SKILL.md"), "utf8")).toBe("keep me\n");

    const second = await syncAgentSkills({ cacheRoot, discoveryRoots: [agents, claude], missingOnly: true });
    expect(second.installed).toBe(false);
    expect(await readFile(join(agents, "other-skill", "SKILL.md"), "utf8")).toBe("keep me\n");
  });

  test("preserves existing directories and unrelated links, repairing only managed links", async () => {
    const root = await mkdtemp(join(tmpdir(), "hitslop-skills-")); roots.push(root);
    const cacheRoot = join(root, "cache");
    const agents = join(root, "agents");
    await mkdir(join(agents, "hitslop-authoring"), { recursive: true });
    await writeFile(join(agents, "hitslop-authoring", "SKILL.md"), "stale\n");
    await symlink(join(root, "unrelated"), join(agents, "hitslop-design"));
    await symlink(join(cacheRoot, "old-document"), join(agents, "hitslop-document"));
    const result = await syncAgentSkills({ cacheRoot, discoveryRoots: [agents] });
    expect(result.conflicts).toEqual([join(agents, "hitslop-authoring"), join(agents, "hitslop-design")]);
    expect(await readFile(join(agents, "hitslop-authoring", "SKILL.md"), "utf8")).toBe("stale\n");
    expect(await readlink(join(agents, "hitslop-design"))).toBe(join(root, "unrelated"));
    expect(await readlink(join(agents, "hitslop-document"))).toBe(join(cacheRoot, "hitslop-document"));
  });
});

test("packaged CLI skills stay in sync with canonical guidance", async () => {
  const bundled = bundledSkillsRoot();
  const source = new URL("../../../.agents/skills/", import.meta.url).pathname;
  for (const skill of ["hitslop-authoring", "hitslop-design"] as const) {
    const walk = async (relative: string): Promise<void> => {
      for (const entry of await readdir(join(source, relative), { withFileTypes: true })) {
        const path = join(relative, entry.name);
        if (entry.isDirectory()) await walk(path);
        else expect(await readFile(join(bundled, path), "utf8")).toBe(await readFile(join(source, path), "utf8"));
      }
    };
    await walk(skill);
  }
  expect(await readFile(join(bundled, "hitslop-document", "SKILL.md"), "utf8")).toBe(documentSkillContent);
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "hitslop-skills-")); roots.push(root);
  return { root, cacheRoot: join(root, "cache"), discoveryRoots: [] as string[] };
}

test("bootstrap fills missing skills while explicit sync replaces the bundle", async () => {
  const options = await fixture();
  await syncAgentSkills(options);
  const skill = join(options.cacheRoot, "hitslop-authoring", "SKILL.md");
  await writeFile(skill, "newer guidance");
  await rm(join(options.cacheRoot, "hitslop-design"), { recursive: true });
  await syncAgentSkills({ ...options, missingOnly: true });
  expect(await readFile(skill, "utf8")).toBe("newer guidance");
  expect(await readFile(join(options.cacheRoot, "hitslop-design", "SKILL.md"), "utf8")).toContain("name: hitslop-design");
  await syncAgentSkills(options);
  expect(await readFile(skill, "utf8")).toContain("name: hitslop-authoring");
});

test("failed staging preserves the complete previous bundle", async () => {
  const options = await fixture();
  await syncAgentSkills(options);
  const bundledRoot = join(options.root, "incomplete");
  await mkdir(join(bundledRoot, "hitslop-authoring"), { recursive: true });
  await writeFile(join(bundledRoot, "hitslop-authoring", "SKILL.md"), "replacement");
  await expect(syncAgentSkills({ ...options, bundledRoot })).rejects.toThrow();
  for (const name of managedSkillNames) {
    expect(await readFile(join(options.cacheRoot, name, "SKILL.md"), "utf8")).toContain(`name: ${name}`);
  }
});

test("activation failure rolls back and a later sync can retry", async () => {
  const options = await fixture();
  await syncAgentSkills(options);
  const skill = join(options.cacheRoot, "hitslop-authoring", "SKILL.md");
  await writeFile(skill, "previous guidance");
  const original = fs.rename;
  const failingRename = spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(from).includes(".staging-") && to === options.cacheRoot) throw new Error("activation failed");
    return original(from, to);
  });
  try { await expect(syncAgentSkills(options)).rejects.toThrow("activation failed"); }
  finally { failingRename.mockRestore(); }
  expect(await readFile(skill, "utf8")).toBe("previous guidance");
  await syncAgentSkills(options);
  expect(await readFile(skill, "utf8")).toContain("name: hitslop-authoring");
});

test("bootstrap recovers the previous tree after an interrupted activation", async () => {
  const options = await fixture();
  await syncAgentSkills(options);
  await writeFile(join(options.cacheRoot, "hitslop-authoring", "SKILL.md"), "previous guidance");
  await rename(options.cacheRoot, `${options.cacheRoot}.previous`);
  await syncAgentSkills({ ...options, missingOnly: true });
  expect(await readFile(join(options.cacheRoot, "hitslop-authoring", "SKILL.md"), "utf8")).toBe("previous guidance");
});

test("competing processes install complete bundles and release their locks", async () => {
  const options = await fixture();
  const modulePath = new URL("../src/skills.ts", import.meta.url).pathname;
  const bundles = await Promise.all(["a", "b", "c"].map(async (value) => {
    const bundle = join(options.root, value);
    await cp(bundledSkillsRoot(), bundle, { recursive: true });
    for (const name of managedSkillNames) await writeFile(join(bundle, name, "SKILL.md"), value);
    return bundle;
  }));
  const children = bundles.map((bundledRoot) => Bun.spawn([process.execPath, "-e",
    `import { syncAgentSkills } from ${JSON.stringify(modulePath)}; await syncAgentSkills(${JSON.stringify({ ...options, bundledRoot })});`,
  ], { stdout: "pipe", stderr: "pipe" }));
  for (const child of children) {
    const error = await new Response(child.stderr).text();
    expect({ code: await child.exited, error }).toEqual({ code: 0, error: "" });
  }
  const contents = await Promise.all(managedSkillNames.map((name) => readFile(join(options.cacheRoot, name, "SKILL.md"), "utf8")));
  expect(new Set(contents).size).toBe(1);
  await syncAgentSkills(options);
});
