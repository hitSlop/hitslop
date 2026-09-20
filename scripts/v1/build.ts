import { buildSkills } from "../../packages/cli/src/skills-build";
import "./generate";
import "./runtime";
import { resolve } from "node:path";
const repository = resolve(import.meta.dir, "../..");
import { buildTemplate } from "../../packages/cli/src/template";
import { join } from "node:path";
await buildSkills();
const build = Bun.spawn(["swift", "build", "--package-path", join(repository,"apps/apple/Packages/HitSlopApple"), "--product", "hitslop-native"], {stdout:"inherit",stderr:"inherit"});
if (await build.exited) throw new Error("Native build failed");
const renderer = join(repository,"apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
for (const [source, name] of [
  ["quick-checklist", "Checklist"],
  ["small-expenses", "Expenses"],
])
  await buildTemplate(
    join(repository, "examples/slops", source!),
    renderer,
    join(repository, "generated/v1/templates", name + ".slop"),
  );
console.log("Built v1 runtime and both native templates");
