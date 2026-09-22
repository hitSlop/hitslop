import { buildSkills } from "../../packages/cli/src/skills-build";
import { generateContracts } from "./generate";
import { buildRuntime } from "./runtime";
import { resolve } from "node:path";
const repository = resolve(import.meta.dir, "../..");
import { buildTemplate } from "../../packages/cli/src/template";
import { join } from "node:path";
import { mkdir, writeFile, rm, rename } from "node:fs/promises";
import { discoverTemplates, templateInventory } from "./templates";
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
const renderer = join(repository, "apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
const templates = await discoverTemplates();
const output = join(repository, "generated/v1/templates");
const stage = output + ".building-" + crypto.randomUUID();
await mkdir(stage, { recursive: true });
try {
  for (const template of templates)
    await buildTemplate(template.source, renderer, join(stage, template.slug + ".slop"));
  await writeFile(
    join(stage, "inventory.json"),
    JSON.stringify(templateInventory(templates), null, 2) + "\n",
  );
  await rm(output, { recursive: true, force: true });
  await rename(stage, output);
} finally {
  await rm(stage, { recursive: true, force: true });
}
console.log(`Built v1 runtime and ${templates.length} native templates`);
