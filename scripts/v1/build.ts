import { buildSkills } from "../../packages/cli/src/skills-build";
import "./generate";
import { repository } from "../../packages/cli/src/build";
import { prepareRenderer, buildTemplate } from "../../packages/cli/src/template";
import { join } from "node:path";
await buildSkills();
const renderer = await prepareRenderer();
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
