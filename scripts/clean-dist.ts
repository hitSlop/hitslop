import { rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const packageRoot = resolve(process.cwd());
const target = resolve(packageRoot, "dist");

if (basename(target) !== "dist" || dirname(target) !== packageRoot) {
  throw new Error(`Refusing to clean unexpected output path: ${target}`);
}

await rm(target, { recursive: true, force: true });
