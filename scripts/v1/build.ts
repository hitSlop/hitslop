import { buildSkills } from "../../packages/cli/src/skills-build";
import { generateContracts } from "./generate";
import { buildRuntime } from "./runtime";
import { resolve, relative } from "node:path";
const repository = resolve(import.meta.dir, "../..");
import { buildTemplate } from "../../packages/cli/src/template";
import { join } from "node:path";
import { mkdir, writeFile, rm, rename } from "node:fs/promises";
import { discoverTemplates, templateInventory } from "./templates";
import { sharedTemplateFingerprint, TemplateCache } from "./template-cache";
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
const cacheDirectory = process.env.HITSLOP_TEMPLATE_CACHE_DIR;
const cache = cacheDirectory
  ? new TemplateCache(
      resolve(cacheDirectory),
      await sharedTemplateFingerprint(
        repository,
        templates.map((template) => relative(repository, template.source)),
      ),
    )
  : undefined;
const started = performance.now();
let hits = 0;
const output = join(repository, "generated/v1/templates");
const stage = output + ".building-" + crypto.randomUUID();
await mkdir(stage, { recursive: true });
try {
  for (const [index, template] of templates.entries()) {
    const start = performance.now();
    const destination = join(stage, template.slug + ".slop");
    const build = () => buildTemplate(template.source, renderer, destination);
    const status = cache
      ? await cache.build(template.source, template.slug, destination, build)
      : (await build(), "built");
    if (status === "hit") hits++;
    console.log(
      `Template ${index + 1}/${templates.length}: ${template.slug} — ${status} (${((performance.now() - start) / 1000).toFixed(1)}s)`,
    );
  }
  await writeFile(
    join(stage, "inventory.json"),
    JSON.stringify(templateInventory(templates), null, 2) + "\n",
  );
  await rm(output, { recursive: true, force: true });
  await rename(stage, output);
  await cache?.prune(templates.map((template) => template.slug));
} finally {
  await rm(stage, { recursive: true, force: true });
}
console.log(
  `Built v1 runtime; templates: ${hits} cache hits, ${templates.length - hits} built in ${((performance.now() - started) / 1000).toFixed(1)}s`,
);
