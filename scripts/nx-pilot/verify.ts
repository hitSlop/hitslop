import { join } from "node:path";
import { catalog, verifyCurrentRuntime, verifyReleasedIdentities } from "../v1/runtime-artifacts";
import { validateTemplate } from "../v1/template-cache";
import { output, verifySeal, slugArgument, executed } from "./common";
const started = performance.now();
const slug = slugArgument();
const runtime = await catalog(join(output, "runtime"));
verifyCurrentRuntime(runtime);
await verifyReleasedIdentities(runtime);
await verifySeal(join(output, "portable", slug));
if (!process.argv.includes("--portable")) {
  await verifySeal(join(output, "rendered", slug));
  await validateTemplate(join(output, "rendered", slug, "package.slop"), slug);
}
await executed(`verify:${slug}`, started);
console.log(`Verified ${slug} and sealed runtime bytes`);
