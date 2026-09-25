import { join } from "node:path";
import { buildProject } from "../../packages/cli/src/build";
import { output, seal, executed, slugArgument, templates } from "./common";
const slug = slugArgument();
const started = performance.now();
const destination = join(output, "portable", slug);
await buildProject(templates.find(template => template.slug === slug)!.source, join(destination, "package.slop"));
await seal(destination);
await executed(`compile:${slug}`, started);
