import { buildTemplate } from "../../packages/cli/src/template";
import { join, resolve, relative } from "node:path";
import { mkdir, writeFile, rm, rename } from "node:fs/promises";
import { repository, discoverTemplates, templateInventory } from "./templates";
import { sharedTemplateFingerprint, TemplateCache } from "./template-cache";

export async function buildTemplates(
  output = join(repository, "generated/v1/templates"),
  slugs?: string[],
) {
  const renderer = join(repository, "apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
  const discovered = await discoverTemplates();
  const templates = slugs
    ? slugs.map((slug) => {
        const template = discovered.find((template) => template.slug === slug);
        if (!template) throw new Error(`Unknown template fixture: ${slug}`);
        return template;
      })
    : discovered;
  const cache = new TemplateCache(
    resolve(process.env.HITSLOP_TEMPLATE_CACHE_DIR ?? join(repository, ".hitslop/template-cache")),
    await sharedTemplateFingerprint(
      repository,
      discovered.map((template) => relative(repository, template.source)),
    ),
  );
  const started = performance.now();
  let hits = 0;
  const stage = output + ".building-" + crypto.randomUUID();
  await mkdir(stage, { recursive: true });
  try {
    for (const [index, template] of templates.entries()) {
      const start = performance.now();
      const destination = join(stage, template.slug + ".slop");
      const build = () => buildTemplate(template.source, renderer, destination);
      console.log(`Preparing template ${index + 1}/${templates.length}: ${template.slug}`);
      const status = await cache.build(template.source, template.slug, destination, build);
      if (status === "hit") hits++;
      console.log(
        `Template ${index + 1}/${templates.length}: ${template.slug} — ${status} (${((performance.now() - start) / 1000).toFixed(1)}s)`,
      );
    }
    if (!slugs)
      await writeFile(
        join(stage, "inventory.json"),
        JSON.stringify(templateInventory(templates), null, 2) + "\n",
      );
    await rm(output, { recursive: true, force: true });
    await rename(stage, output);
    if (!slugs) await cache.prune(templates.map((template) => template.slug));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  console.log(
    `Templates: ${hits} cache hits, ${templates.length - hits} built in ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );
}

if (import.meta.main) await buildTemplates();
