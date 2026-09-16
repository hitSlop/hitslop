import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const repository = resolve(import.meta.dir, "../..");
const packagePath = join(repository, "apps/apple/Packages/HitSlopApple");
const output = join(repository, ".hitslop/native-loro");
const results = join(output, "results-v2");
const args = process.argv.slice(2);
if (args.includes("--incremental")) {
  const child = Bun.spawn(["bun", "scripts/native-loro/incremental.ts", ...args.filter(a => a !== "--incremental")], {cwd: repository, stdout: "inherit", stderr: "inherit"});
  process.exit(await child.exited);
}
async function run(command: string[], log?: string, allowGateFailure = false) {
  console.log(`Running ${command.join(" ")}`);
  const process = Bun.spawn(command, { cwd: repository, stdout: log ? Bun.file(log) : "inherit", stderr: "inherit", env: {
    ...Bun.env, HITSLOP_SPIKE_EXECUTABLE: join(packagePath, ".build/release/hitslop-loro-spike"),
  } });
  const status = await process.exited;
  if (status !== 0 && !(allowGateFailure && status === 2)) throw new Error(`${command[0]} exited ${status}`);
  return status;
}
if (args.includes("--bridge-compare")) {
  const child = Bun.spawn(["bun", "scripts/native-loro/compare.ts", ...args.filter(a => a !== "--bridge-compare")], {cwd: repository, stdout: "inherit", stderr: "inherit"});
  process.exit(await child.exited);
}
await mkdir(results, { recursive: true });
await run(["bun", "scripts/native-loro/prepare.ts"]);
await run(["swift", "build", "--package-path", packagePath, "-c", "release", "--product", "hitslop-loro-spike"]);
const executable = join(packagePath, ".build/release/hitslop-loro-spike");
async function localNetwork(interactive: boolean) {
  const relay = Bun.spawn(["bun", "scripts/native-loro/relay-local.ts"], { cwd: repository, stdout: Bun.file(join(results, "relay-server.log")), stderr: "inherit" });
  const stop = () => { relay.kill(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const deadline = Date.now() + 30000;
    let available = false;
    while (Date.now() < deadline) {
      if (relay.exitCode !== null) throw new Error("Local relay exited before readiness");
      try { available = (await fetch("http://127.0.0.1:8791/health")).status === 404; } catch {}
      if (available) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!available) throw new Error("Local relay did not start");
    if (!interactive) await run(["bun", "Prototypes/native-loro-relay/tests/relay.ts"], join(results, "relay-checks.log"));
    await run(["bun", "scripts/native-loro/e2e.ts", ...(interactive ? ["--open-pair"] : [])], join(results, "e2e.log"));
  } finally { relay.kill(); await relay.exited; process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
if (args.includes("--open-pair")) {
  if (args.includes("--hosted")) await run(["bun", "scripts/native-loro/hosted.ts", "--open-pair"]);
  else await localNetwork(true);
} else if (args.includes("--open")) {
  const engine = args.includes("--js") ? "js" : "native";
  await run([executable, "--engine", engine, "--mode", "open", "--package", join(output, `${engine}.slop`), ...args.filter((a, i) => ["--confirmation", "--text-policy"].includes(a) || ["--confirmation", "--text-policy"].includes(args[i - 1]!))]);
} else {
  let failedGate = false;
  await run(["swift", "test", "--package-path", packagePath, "--filter", "HitSlopLoroSpikeTests", "--no-parallel"], join(results, "swift-tests.log"));
  for (const engine of ["native", "js"]) {
    const status = await run([executable, "--engine", engine, "--mode", "verify", "--package", join(output, `${engine}.slop`), "--output", join(results, `${engine}-verify.json`)], join(results, `${engine}-verify.log`), true);
    if (status === 2) failedGate = true;
  }
  if (args.includes("--e2e")) {
    await localNetwork(false);
    if (args.includes("--hosted")) await run(["bun", "scripts/native-loro/hosted.ts"], join(results, "hosted.log"));
  }
  if (!args.includes("--verify-only")) {
    const samples: unknown[] = [];
    for (let runIndex = 1; runIndex <= 3; runIndex++) {
      for (const count of [1, 5, 10]) {
        for (const engine of runIndex % 2 ? ["native", "js"] : ["js", "native"]) {
          const file = join(results, `${engine}-${count}-${runIndex}.json`);
          await run([executable, "--engine", engine, "--mode", "benchmark", "--count", String(count), "--package", join(output, `${engine}.slop`), "--output", file], join(results, `${engine}-${count}-${runIndex}.log`));
          samples.push(JSON.parse(await readFile(file, "utf8")));
        }
      }
    }
    await writeFile(join(results, "benchmarks.json"), JSON.stringify(samples, null, 2) + "\n");
  }
  console.log(`Results: ${results}`);
  if (failedGate) { console.error("Native migration gate failed; see the recorded verification results. Benchmarks still completed."); process.exitCode = 1; }
}
