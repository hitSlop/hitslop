import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Run from the repository root. Every run creates new disposable documents.
const output = resolve(".hitslop/sqlite-lab", `run-${Date.now()}`);
mkdirSync(output, { recursive: true });
async function run(command: string[]) {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error(`Failed: ${command.join(" ")}`);
}
const packagePath = "apps/apple/Packages/HitSlopApple";
const executable = `${packagePath}/.build/debug/hitslop-sqlite-spike`;
await run(["bun", "scripts/native-loro/prepare.ts"]);
await run(["swift", "test", "--package-path", packagePath, "--filter", "SQLiteSpikeTests"]);
await run(["swift", "build", "--package-path", packagePath, "--product", "hitslop-sqlite-spike"]);
const document = `${output}/Checklist.slopsql`;
await run([executable, "pack", ".hitslop/native-loro/native.slop", document]);
await run([executable, "verify", document, `${output}/results`]);
await run(["python3", "scripts/sqlite-lab/crash.py", document]);
console.log(`\nSQLite proof: ${output}\nFinder extensions: see docs/sqlite-document-spike.md`);
