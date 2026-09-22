import { checkCompatibility } from "./compatibility-check";
import {
  verifyProvenance,
  verifyCopies,
  verifyReleasedIdentities,
  verifyCurrentRuntime,
  runtimeDestinations,
} from "./runtime-artifacts";
import { discoverTemplates } from "./templates";
await verifyProvenance();
const runtimes = await verifyCopies(runtimeDestinations);
verifyCurrentRuntime(runtimes);
await verifyReleasedIdentities(runtimes);
await checkCompatibility();
const env = { ...process.env, PATH: "/opt/homebrew/bin:/usr/bin:/bin:" + process.env.PATH };
async function run(cmd: string[]) {
  const p = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit", env });
  if (await p.exited) process.exit(1);
}
await run([process.execPath, "scripts/v1/generate.ts", "--check"]);
await run([process.execPath, "scripts/v1/skills.ts", "--check"]);
await run([process.execPath, "node_modules/typescript/bin/tsc", "-p", "tsconfig.v1.json"]);
for (const { source } of await discoverTemplates())
  await run([
    process.execPath,
    "node_modules/svelte-check/bin/svelte-check",
    "--workspace",
    source,
    "--tsconfig",
    "tsconfig.json",
  ]);
