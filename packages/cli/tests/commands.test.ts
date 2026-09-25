import { test, expect } from "bun:test";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import metadata from "../package.json";

async function run(args: string[], env: Record<string, string> = {}, cli = "packages/cli/src/cli.ts") {
  const child = Bun.spawn([process.execPath, cli, ...args], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("help and version do not invoke native or authoring handlers", async () => {
  // A fresh checkout has sources and dependencies, but no generated skill bundle.
  const root = await mkdtemp(join(tmpdir(), "hsl-cli-help-"));
  try {
    await cp("packages/cli/src", join(root, "src"), { recursive: true });
    await cp("packages/cli/package.json", join(root, "package.json"));
    await symlink(resolve("packages/cli/node_modules"), join(root, "node_modules"));
    for (const args of [
      [],
      ["--help"],
      ["--version"],
      ["-v"],
      ["build", "--help"],
      ["apply", "--help"],
      ["skills", "--help"],
      ["skill", "-h"],
      ["skills", "update", "--help"],
    ]) {
      const result = await run(args, { HITSLOP_NATIVE_CLI: "/nonexistent" }, join(root, "src/cli.ts"));
      expect(result.stderr).toBe("");
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("slop");
      if (args[0] === "--version" || args[0] === "-v")
        expect(result.stdout.trim()).toBe(`slop v${metadata.version}`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid input fails before opening documents or building source", async () => {
  for (const args of [
    ["wat"],
    ["get"],
    ["get", "missing.slop", "--wat"],
    ["apply", "missing.slop"],
    ["compact", "missing.slop", "--id", "retry"],
    ["export", "missing.slop", "--format", "jpeg", "--output", "x"],
    ...["0", "65536", "1.5", "NaN"].map((port) => ["dev", "missing-source", "--port", port]),
  ]) {
    const result = await run(args, { HITSLOP_NATIVE_CLI: "/nonexistent" });
    expect(result.code).not.toBe(0);
    expect(result.stderr).not.toContain("HITSLOP_NATIVE_CLI");
  }
});
