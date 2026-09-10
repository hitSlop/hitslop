import { discoverSlops } from "./dev-gallery.ts";
import { installTemplate } from "../../packages/cli/src/install.ts";
import { buildSlop, validateAuthoringProject } from "../../packages/cli/src/project.ts";
import { fileURLToPath } from "node:url";

const action = process.argv[2];
if (action !== "build" && action !== "validate" && action !== "register") {
  throw new Error("Expected build, validate, or register");
}

const failures: string[] = [];
for (const slop of await discoverSlops()) {
  const root = fileURLToPath(new URL(slop.directory + "/", import.meta.url));
  if (action === "build") {
    await buildSlop(root);
    console.log(`${action}\t${slop.slug}`);
    continue;
  }
  if (action === "validate") {
    await validateAuthoringProject(root);
    console.log(`${action}\t${slop.slug}`);
    continue;
  }
  try {
    const result = await installTemplate(root, { force: true });
    console.log(`${action}\t${slop.slug}\t${result.replaced ? "updated" : "installed"}\t${result.directory}`);
  } catch (error) {
    failures.push(slop.slug);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${action}\t${slop.slug}\tFAILED\t${message}`);
  }
}

if (failures.length > 0) {
  console.error(`Failed register for ${failures.length} slop(s): ${failures.join(", ")}`);
  process.exit(1);
}
