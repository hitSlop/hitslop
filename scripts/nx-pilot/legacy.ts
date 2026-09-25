// Benchmark the production builder unchanged, using a distinct cache and output tree.
import { join } from "node:path";
import { buildTemplates } from "../v1/build-templates";
import { catalog, verifyCurrentRuntime, verifyReleasedIdentities } from "../v1/runtime-artifacts";
import { validateTemplate } from "../v1/template-cache";
import { output, slugs } from "./common";
process.env.HITSLOP_TEMPLATE_CACHE_DIR = join(output, "legacy-cache");
await buildTemplates(join(output, "legacy-templates"));
const runtime = await catalog("packages/cli/runtimes");
verifyCurrentRuntime(runtime);
await verifyReleasedIdentities(runtime);
for (const slug of slugs) await validateTemplate(join(output, "legacy-templates", `${slug}.slop`), slug);
