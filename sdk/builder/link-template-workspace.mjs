import { existsSync } from "node:fs";
import { rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sdkRoot } from "./config.mjs";

const templatesRoot = resolve(sdkRoot, "../Templates");
const link = join(templatesRoot, "node_modules");
const dependencies = join(sdkRoot, "node_modules");

if (existsSync(templatesRoot) && existsSync(dependencies)) {
  if (existsSync(link)) await rm(link, { recursive: true, force: true });
  await symlink(dependencies, link, "dir");
}
