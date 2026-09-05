import { discoverSlops } from "./dev-gallery.ts";
import { buildSlop, validateAuthoringProject } from "../../packages/cli/src/project.ts";
import { fileURLToPath } from "node:url";

const action = process.argv[2];
if (action !== "build" && action !== "validate") throw new Error("Expected build or validate");
for (const slop of await discoverSlops()) {
  const root = fileURLToPath(new URL(slop.directory + "/", import.meta.url));
  if (action === "build") await buildSlop(root);
  else await validateAuthoringProject(root);
  console.log(`${action}\t${slop.slug}`);
}
