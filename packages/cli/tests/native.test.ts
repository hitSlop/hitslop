import { test, expect } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("explicit native helper overrides fail without falling back or retrying", async () => {
  const root = await mkdtemp(join(tmpdir(), "hsl-native-discovery-"));
  const run = async (helper: string) => {
    const child = Bun.spawn([process.execPath, "packages/cli/src/cli.ts", "get", "example.slop"], {
      env: { ...process.env, HITSLOP_NATIVE_CLI: helper, HITSLOP_TEST_BUN_ENGINE: "0" },
      stdout: "pipe", stderr: "pipe",
    });
    return { code: await child.exited, error: await new Response(child.stderr).text() };
  };
  try {
    if (process.platform !== "darwin") return;
    const missing = await run(join(root, "missing"));
    expect(missing.code).not.toBe(0);
    expect(missing.error).toContain("HITSLOP_NATIVE_CLI is not executable");
    const helper = join(root, "helper");
    await writeFile(helper, '#!/bin/sh\necho "selected helper failed" >&2\nexit 23\n', { mode: 0o755 });
    const selected = await run(helper);
    expect(selected.code).toBe(23);
    expect(selected.error).toContain("selected helper failed");
  } finally { await rm(root, { recursive: true, force: true }); }
});
