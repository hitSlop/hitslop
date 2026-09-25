import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { output } from "./common";
const file = "examples/slops/daily-planner/manifest.json";
const original = await readFile(file, "utf8");
// Production cache stores one revision per slug. Restore its baseline entry before upload.
const baseline = join(output, "legacy-daily-baseline");
const entry = join(output, "legacy-cache/daily-planner");
await cp(entry, baseline, { recursive: true });
async function run(args: string[]) {
  const child = Bun.spawn([process.execPath, ...args], { stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error(`Benchmark failed: ${args.join(" ")}`);
}
try {
  const manifest = JSON.parse(original);
  // Each attempt measures a previously unseen edit, not reuse of the previous attempt's edit.
  manifest.description += ` Nx corpus benchmark ${process.env.GITHUB_RUN_ID ?? "local"}/${process.env.GITHUB_RUN_ATTEMPT ?? "1"}.`;
  await writeFile(file, JSON.stringify(manifest));
  await run(["scripts/nx-pilot/measure.ts", "legacy-edit", process.execPath, "scripts/nx-pilot/legacy.ts"]);
  await cp(".hitslop/v1-evidence/template-cache-templates.json", ".hitslop/v1-evidence/nx-pilot/legacy-edit-cache.json");
  await run(["scripts/nx-pilot/clean.ts", "--cache"]);
  await run(["scripts/nx-pilot/measure.ts", "nx-edit", process.execPath, "scripts/nx-pilot/run.ts"]);
} finally {
  await writeFile(file, original);
  await rm(entry, { recursive: true, force: true });
  await cp(baseline, entry, { recursive: true });
  await rm(baseline, { recursive: true, force: true });
}
