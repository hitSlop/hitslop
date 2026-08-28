import { statSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";
import { slopViteConfig } from "./config.mjs";
import { withGuestWorkspace } from "./workspace.mjs";

export function resolveSlop(path) {
  const root = resolve(path);
  if (!root.endsWith(".slop")) throw new Error(`Expected a .slop package, got ${path}`);
  return root;
}

export async function buildSlop(path) {
  const slopRoot = resolveSlop(path);
  return withGuestWorkspace(slopRoot, async (workspace, manifest) => {
    await build({ ...slopViteConfig({ slopRoot, workspace }), configFile: false });
    const entry = resolve(slopRoot, "build/index.html");
    return { slopRoot, entry, bytes: statSync(entry).size, title: manifest.title };
  });
}
