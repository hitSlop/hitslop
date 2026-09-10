import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function runInit(arguments_: string[], skillsRoot?: string) {
  const cache = skillsRoot ?? await mkdtemp(join(tmpdir(), "hitslop-init-skills-"));
  if (!skillsRoot) roots.push(cache);
  const child = Bun.spawn(["bun", resolve(import.meta.dir, "../src/cli.ts"), "init", ...arguments_], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HITSLOP_SKILLS_ROOT: join(cache, "skills"), HITSLOP_SKILL_LINKS: "" },
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

describe("slop init author metadata", () => {
  test("requires an author name for non-interactive init", async () => {
    const parent = await mkdtemp(join(tmpdir(), "hitslop-init-")); roots.push(parent);
    const result = await runInit([join(parent, "missing-author"), "--yes"]);
    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("--author-name is required");
  });

  test("writes validated author attribution into the scaffold manifest", async () => {
    const parent = await mkdtemp(join(tmpdir(), "hitslop-init-")); roots.push(parent);
    const destination = join(parent, "author-counter");
    const result = await runInit([
      destination,
      "--yes",
      "--author-name", "  Jordan Singer  ",
      "--author-url", "https://example.com/jordan",
    ]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(await readFile(join(destination, "manifest.json"), "utf8")).author)
      .toEqual({ name: "Jordan Singer", url: "https://example.com/jordan" });
  });
});


test("skill installation failure does not prevent project creation", async () => {
  const parent = await mkdtemp(join(tmpdir(), "hitslop-init-")); roots.push(parent);
  const unavailable = join(parent, "not-a-directory");
  await writeFile(unavailable, "occupied");
  const destination = join(parent, "counter");
  const result = await runInit([destination, "--yes", "--author-name", "Test Author"], unavailable);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toContain("Could not install coding-agent skills");
  expect(JSON.parse(await readFile(join(destination, "manifest.json"), "utf8")).author.name).toBe("Test Author");
});
