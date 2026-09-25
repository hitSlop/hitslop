/** Black-box package coverage: no template selectors, actions, or business logic. */
import { strict as assert } from "node:assert";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { builtTemplates } from "./templates";
import { digest } from "./runtime-artifacts";

const helper = resolve("apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
const evidence = resolve(".hitslop/v1-evidence/render");
const parent = await mkdtemp(join(tmpdir(), "hitslop-native-smoke-"));
const packages = (await builtTemplates()).templates
  .filter((t) => t.bundled)
  .map((t) => ({
    name: `bundled-${t.slug}`,
    source: resolve("generated/v1/templates", `${t.slug}.slop`),
  }));
for (const name of (await readdir("tests/compatibility")).sort()) {
  if (await Bun.file(`tests/compatibility/${name}/fixture.json`).exists())
    packages.push({
      name: `preserved-${name}`,
      source: resolve("tests/compatibility", name, "document"),
    });
}
async function run(args: string[]) {
  const started = performance.now();
  const child = Bun.spawn([helper, ...args], { stdout: "pipe", stderr: "pipe" });
  const timeout = setTimeout(() => child.kill(), 60_000);
  try {
    const [out, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    assert.equal(code, 0, `${args.join(" ")} (${((performance.now() - started) / 1000).toFixed(1)}s): ${error}`);
    return out;
  } finally {
    clearTimeout(timeout);
  }
}
const results: { name: string; sha256: string }[] = [];
let failure: string | undefined;
try {
  await mkdir(evidence, { recursive: true });
  for (const { name, source } of packages) {
    const started = performance.now();
    console.log(`Checking ${name}`);
    const root = join(parent, `${name}.slop`);
    const before = await digest(source);
    await cp(source, root, { recursive: true });
    const state = JSON.parse(await run(["get", root]));
    for (const format of ["png", "pdf"]) {
      const output = join(evidence, `${name}.${format}`);
      await run(["export", root, "--format", format, "--output", output]);
      const bytes = await Bun.file(output).bytes();
      assert(bytes.length > 100, `Empty ${format}: ${name}`);
      assert.equal(
        Buffer.from(bytes.subarray(0, format === "png" ? 8 : 4)).toString("hex"),
        format === "png" ? "89504e470d0a1a0a" : "25504446",
      );
    }
    assert.deepEqual(JSON.parse(await run(["get", root])), state);
    assert.equal(await digest(source), before, `Master changed: ${name}`);
    results.push({ name, sha256: before });
    console.log(`PASS ${name}: headless open, authored render, PNG/PDF, reopen (${((performance.now() - started) / 1000).toFixed(1)}s)`);
  }
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(
    join(evidence, "results.json"),
    JSON.stringify({ passed: !failure, results, error: failure }, null, 2) + "\n",
  );
  await rm(parent, { recursive: true, force: true });
}
