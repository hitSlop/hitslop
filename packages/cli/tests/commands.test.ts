import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function run(args: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn([process.execPath, "packages/cli/src/cli.ts", ...args], {
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
  for (const args of [
    [],
    ["--help"],
    ["--version"],
    ["build", "--help"],
    ["apply", "--help"],
    ["skills", "--help"],
  ]) {
    const result = await run(args, { HITSLOP_NATIVE_CLI: "/nonexistent" });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("slop");
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
