import { buildSkills } from "../../packages/cli/src/skills-build";
import { generateContracts } from "./generate";
import { buildRuntime } from "./runtime";
import { resolve } from "node:path";
const repository = resolve(import.meta.dir, "../..");
import { join } from "node:path";
const started = performance.now();
console.log("Building contracts, runtime, skills, and native helper");
await generateContracts();
await buildRuntime();
await buildSkills();
const build = Bun.spawn(
  [
    "swift",
    "build",
    "--package-path",
    join(repository, "apps/apple/Packages/HitSlopApple"),
    "--product",
    "hitslop-native",
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (await build.exited) throw new Error("Native build failed");
console.log(
  `Built native development resources in ${((performance.now() - started) / 1000).toFixed(1)}s`,
);
