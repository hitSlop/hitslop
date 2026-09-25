import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { catalog, verifyCurrentRuntime, verifyReleasedIdentities } from "../v1/runtime-artifacts";
import { templateInventory } from "../v1/templates";
import { validateTemplate } from "../v1/template-cache";
import { output, verifySeal, slugArgument, executed, templates, slugs } from "./common";

export async function verifySelected(selected: string[], portable = false) {
  const runtime = await catalog(join(output, "runtime"));
  verifyCurrentRuntime(runtime);
  await verifyReleasedIdentities(runtime);
  for (const slug of selected) {
    const started = performance.now();
    await verifySeal(join(output, "portable", slug));
    if (!portable) {
      await verifySeal(join(output, "rendered", slug));
      await validateTemplate(join(output, "rendered", slug, "package.slop"), slug);
    }
    await executed(`verify:${slug}`, started);
  }
  console.log(`Verified ${selected.length} packages and sealed runtime bytes`);
}

// Same public inventory/package layout as build:templates, confined to pilot outputs.
// Called only after every selected package has passed validation; never cached.
export async function assemble() {
  await mkdir(output, { recursive: true });
  const stage = await mkdtemp(join(output, ".assembly-"));
  try {
    for (const { slug } of templates)
      await cp(join(output, "rendered", slug, "package.slop"), join(stage, `${slug}.slop`), { recursive: true });
    await writeFile(join(stage, "inventory.json"), JSON.stringify(templateInventory(templates), null, 2) + "\n");
    await rm(join(output, "templates"), { recursive: true, force: true });
    await rename(stage, join(output, "templates"));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
if (import.meta.main) {
  const all = process.argv.includes("--all");
  const portable = process.argv.includes("--portable");
  await verifySelected(all ? slugs : [slugArgument()], portable);
  if (all && !portable) await assemble();
}
