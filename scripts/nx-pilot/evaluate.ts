// Observable contract: task reuse follows real source boundaries, and restored packages
// remain intact. The execution journal and built bytes are independent oracles; existing
// TemplateCache tests do not exercise Nx. All mutations happen in a disposable clone.
import { strict as assert } from "node:assert";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, chmod, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { repository, digest } from "../v1/runtime-artifacts";
import { slugs as discovered } from "./common";
const portable = process.argv.includes("--portable");
const subset = process.argv.find(arg => arg.startsWith("--slugs="))?.slice(8).split(",");
const slugs = subset ?? discovered;
if (slugs.some(slug => !discovered.includes(slug))) throw new Error("Unknown evaluation slug");

const scratch = await mkdtemp(join(tmpdir(), "hitslop-nx-evaluation-"));
const root = join(scratch, "repo");
const evidence = join(repository, ".hitslop/v1-evidence/nx-pilot");
await mkdir(evidence, { recursive: true });
const env = { ...process.env, NX_DAEMON: "false", NX_ISOLATE_PLUGINS: "false", NX_NO_CLOUD: "true", NX_TUI: "false" };
async function command(args: string[], cwd = root, extra = {}, allowFailure = false) {
  const child = Bun.spawn(args, { cwd, env: { ...env, ...extra }, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code && !allowFailure) throw new Error(`${args.join(" ")}\n${stdout}\n${stderr}`);
  return { stdout, stderr, code };
}
const records: unknown[] = [];
const verify = slugs.map(s => `verify:${s}`).sort();
const compile = slugs.map(s => `compile:${s}`).sort();
const artwork = portable ? [] : slugs.map(s => `artwork:${s}`).sort();
const all = ["runtime", ...compile, ...artwork, ...verify].sort();
const nx = [process.execPath, "scripts/nx-pilot/run.ts", ...slugs, ...(portable ? ["--portable"] : [])];
const generated = join(root, "generated/nx-pilot");
async function run(label: string, expected: string[], args = nx, extra = {}) {
  await mkdir(generated, { recursive: true });
  await writeFile(join(generated, "executions.jsonl"), "");
  const started = performance.now();
  const result = await command(args, root, extra);
  const milliseconds = performance.now() - started;
  await writeFile(join(evidence, `${label}.log`), result.stdout + result.stderr);
  const executions = (await readFile(join(generated, "executions.jsonl"), "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  assert.deepEqual(executions.map(e => e.task).sort(), [...expected].sort(), label);
  records.push({ label, milliseconds, executions });
  console.log(`${label}: ${(milliseconds / 1000).toFixed(2)}s; executed ${executions.map(e => e.task).join(", ")}`);
}
async function mutate(path: string, transform: (value: string) => string, test: () => Promise<void>) {
  const file = join(root, path), original = await readFile(file, "utf8");
  try { await writeFile(file, transform(original)); await test(); }
  finally { await writeFile(file, original); }
}
try {
  const setup = performance.now();
  await command(["git", "clone", "--quiet", "--local", repository, root], repository);
  // Overlay tracked/staged work and tracked deletions only; never sweep untracked user files.
  const files = (await command(["git", "ls-files", "-z", "--cached"], repository)).stdout.split("\0").filter(Boolean);
  for (const file of files) {
    if (!await access(join(repository, file)).then(() => true, () => false)) { await rm(join(root, file), { force: true }); continue; }
    await mkdir(dirname(join(root, file)), { recursive: true });
    await cp(join(repository, file), join(root, file));
  }
  await command([process.execPath, "install", "--frozen-lockfile"]);
  records.push({ label: "disposable-checkout-and-install", milliseconds: performance.now() - setup });
  await run("direct", all, [process.execPath, "scripts/nx-pilot/direct.ts", ...slugs, ...(portable ? ["--portable"] : [])]);
  const directBytes = await Promise.all(slugs.map(s => digest(join(generated, "portable", s))));
  await command([process.execPath, "scripts/nx-pilot/clean.ts", "--cache"]);
  await run("cold", all);
  assert.deepEqual(await Promise.all(slugs.map(s => digest(join(generated, "portable", s)))), directBytes, "Nx and direct compilation bytes");
  await run("warm", verify);
  await mutate("examples/slops/daily-planner/manifest.json", text => {
    const manifest = JSON.parse(text); manifest.description += " Nx pilot edit."; return JSON.stringify(manifest);
  }, async () => {
    await run("one-template", ["compile:daily-planner", ...(portable ? [] : ["artwork:daily-planner"]), ...verify]);
    assert.match(await readFile(join(generated, `${portable ? "portable" : "rendered"}/daily-planner/package.slop/manifest.json`), "utf8"), /Nx pilot edit/);
  });
  await run("restore-template", verify);
  await mutate("packages/cli/src/cli.ts", text => text + "\n// CLI help-only pilot edit\n", () => run("cli-help", verify));
  await mutate("packages/cli/skills/hitslop-document/SKILL.md", text => text + "\nNx pilot guidance.\n", async () => {
    await run("copied-skill", [...compile, ...artwork, ...verify]);
    for (const slug of slugs) assert.match(await readFile(join(generated, portable ? "portable" : "rendered", slug, "package.slop/.agents/skills/hitslop-document/SKILL.md"), "utf8"), /Nx pilot guidance/);
  });
  await run("restore-skill", verify);
  await mutate("tsconfig.v1.json", text => {
    const config = JSON.parse(text); config.compilerOptions.useDefineForClassFields = false; return JSON.stringify(config);
  }, () => run("root-config", all));
  await run("restore-config", verify);
  if (!portable) {
  await mutate("scripts/nx-pilot/artwork.ts", text => text + "\n// Renderer-only pilot edit\n", () => run("renderer-source", [...artwork, ...verify]));
  await run("restore-renderer", verify);
  // Change the reported OS build without changing input files: proves runtime input hashing.
  const bin = join(scratch, "bin"); await mkdir(bin);
  await writeFile(join(bin, "sw_vers"), '#!/bin/sh\n/usr/bin/sw_vers "$@"\nprintf "\\npilot-toolchain\\n"\n');
  await chmod(join(bin, "sw_vers"), 0o755);
  await run("renderer-toolchain", [...artwork, ...verify], nx, { PATH: `${bin}:${process.env.PATH}` });
  await run("restore-toolchain", verify);
  }
  await command([process.execPath, "scripts/nx-pilot/clean.ts"]);
  await run("missing-outputs", verify);
  const packagePath = join(generated, `${portable ? "portable" : "rendered"}/daily-planner/package.slop`);
  await writeFile(join(packagePath, "assets/main.js"), "corrupt cached output");
  const rejected = await command([process.execPath, "scripts/nx-pilot/verify.ts", "daily-planner", ...(portable ? ["--portable"] : [])], root, {}, true);
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /checksum mismatch/);
  records.push({ label: "corruption-rejected", passed: true });
  await rm(join(generated, portable ? "portable" : "rendered"), { recursive: true });
  await run("restore-after-corruption", verify);
  const projectNames = async (allowFailure = false) => command(["node", "node_modules/nx/dist/bin/nx.js", "show", "projects", "--with-target=compile", "--json"], root, {}, allowFailure);
  assert.equal(JSON.parse((await projectNames()).stdout).length, discovered.length);
  const added = join(root, "examples/slops/nx-discovery-specimen");
  await cp(join(root, "examples/slops/daily-planner"), added, { recursive: true });
  const manifest = JSON.parse(await readFile(join(added, "manifest.json"), "utf8"));
  manifest.slug = "nx-discovery-specimen";
  await writeFile(join(added, "manifest.json"), JSON.stringify(manifest));
  assert.ok(JSON.parse((await projectNames()).stdout).includes("pilot-nx-discovery-specimen"));
  manifest.runtime = "legacy";
  await writeFile(join(added, "manifest.json"), JSON.stringify(manifest));
  const invalid = await projectNames(true);
  assert.notEqual(invalid.code, 0, "invalid discovered manifest must fail graph creation");
  await rm(added, { recursive: true });
  assert.ok(!JSON.parse((await projectNames()).stdout).includes("pilot-nx-discovery-specimen"));
  await mutate("examples/slops/bundled.json", text => JSON.stringify(JSON.parse(text).filter((s: string) => s !== "daily-planner")), async () => {
    await run("selection-only", verify);
    if (!portable && !subset) {
      const inventory = JSON.parse(await readFile(join(generated, "templates/inventory.json"), "utf8"));
      assert.equal(inventory.templates.find((t: {slug: string}) => t.slug === "daily-planner").bundled, false);
    }
  });
  await mutate("examples/slops/bundled.json", text => JSON.stringify([...JSON.parse(text), "missing-specimen"]), async () => {
    assert.notEqual((await projectNames(true)).code, 0, "unknown bundled slug must fail graph creation");
  });
  const affected = await command(["node", "node_modules/nx/dist/bin/nx.js", "show", "projects", "--affected", "--files=examples/slops/daily-planner/initial.ts", "--with-target=compile", "--json"]);
  assert.deepEqual(JSON.parse(affected.stdout), ["pilot-daily-planner"]);
  records.push({ label: "discovery-selection-and-affected", passed: true });
  await run("cloud-disabled-rebuild", all, nx, { NX_SKIP_NX_CACHE: "true" });
  await writeFile(join(evidence, `local-evaluation-${portable ? "portable" : "native"}.json`), JSON.stringify({ passed: true, node: (await command(["node", "--version"])).stdout.trim(), bun: Bun.version, records }, null, 2) + "\n");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
