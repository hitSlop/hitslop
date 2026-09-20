import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineDocument, s } from "../src/schema";
const schema = defineDocument({ title: s.text() });
test("native CLI rejects old runtimes and malformed commands before mutation", async () => {
  if (process.platform !== "darwin") return;
  const parent = await mkdtemp(join(tmpdir(), "hsl-cli-v1-"));
  const root = join(parent, "Document.slop");
  await (await import("node:fs/promises")).mkdir(root);
  const cli = async (command: string, ...args: string[]) => {
    const p = Bun.spawn([process.execPath, "packages/cli/src/cli.ts", command, root, ...args], {
      env: { ...process.env, HITSLOP_NATIVE_CLI: new URL("../../../apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native", import.meta.url).pathname },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, error, code] = await Promise.all([
      new Response(p.stdout).text(),
      new Response(p.stderr).text(),
      p.exited,
    ]);
    return { out, error, code };
  };
  try {
    await writeFile(join(root, "manifest.json"), JSON.stringify({ runtime: "old-experiment" }));
    expect((await cli("get")).error).toContain("invalid v1 manifest");
    expect(await readdir(root)).toEqual(["manifest.json"]);
    const manifest = JSON.parse(
      await readFile("examples/slops/quick-checklist/manifest.json", "utf8"),
    );
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets/theme.json"), "{}");
    await writeFile(join(root, "app.html"), "<!doctype html><html></html>");
    await writeFile(join(root, "state.schema.json"), JSON.stringify(schema.descriptor));
    await writeFile(join(root, "initial.json"), JSON.stringify({ title: "Initial" }));
    expect((await cli("apply", "--op", '{"type":"text.replace","path":["title"],"value":"bad"}', "--id", "alone")).error).toContain("Unknown");
    expect((await cli("get", "--request-id", "old-name")).error).toContain("Unknown");
    expect(await readdir(root)).not.toContain("state");
    expect((await cli("get")).code).toBe(0);
    const before = await readFile(join(root, "state/document.sqlite"));
    expect((await cli("apply", "--op", "null")).code).not.toBe(0);
    expect((await cli("batch", "--ops", "null")).code).not.toBe(0);
    const changed = defineDocument({ title: s.text(), extra: s.string() });
    await writeFile(join(root, "state.schema.json"), JSON.stringify(changed.descriptor));
    expect((await cli("get")).error).toContain("Incompatible document schema");
    expect(await readFile(join(root, "state/document.sqlite"))).toEqual(before);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}, 30000);
