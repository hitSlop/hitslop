import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

export const sdkRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function readManifest(slopRoot) {
  return JSON.parse(readFileSync(join(slopRoot, "manifest.json"), "utf8"));
}

export function guestEntry(slopRoot) {
  const sourceRoot = join(slopRoot, "source");
  for (const name of ["main.ts", "main.js"]) {
    const file = join(sourceRoot, name);
    if (existsSync(file)) return file.replaceAll("\\", "/");
  }
  throw new Error(`No guest entry in ${sourceRoot} (expected main.ts or main.js)`);
}

function sdkResolvePlugin() {
  // Guest source lives outside the Vite workspace, so bare imports
  // (bits-ui, etc.) must resolve from the SDK rather than the .slop.
  const parent = pathToFileURL(join(sdkRoot, "package.json")).href;
  return {
    name: "slop-sdk-resolve",
    resolveId(id) {
      if (!id || id.startsWith(".") || id.startsWith("/") || id.startsWith("\0") || id.startsWith("@slop/")) {
        return null;
      }
      try {
        return fileURLToPath(import.meta.resolve(id, parent));
      } catch {
        return null;
      }
    },
  };
}

function sourceBoundaryPlugin(slopRoot) {
  const packageRoot = realpathSync(resolve(slopRoot)).replaceAll("\\", "/") + "/";
  const sourceRoot = realpathSync(resolve(slopRoot, "source")).replaceAll("\\", "/") + "/";
  return {
    name: "slop-source-boundary",
    enforce: "pre",
    load(id) {
      const path = id.split("?")[0].replaceAll("\\", "/");
      if (path.startsWith(packageRoot) && !path.startsWith(sourceRoot)) {
        throw new Error(`Build inputs must live under source/: ${path.slice(packageRoot.length)}`);
      }
      return null;
    },
  };
}

export function slopViteConfig({ slopRoot, workspace }) {
  const manifest = readManifest(slopRoot);
  if (manifest.format !== "slop-web/1") {
    throw new Error(`Not a slop-web/1 document: ${manifest.format}`);
  }
  return {
    root: workspace,
    publicDir: false,
    envDir: sdkRoot,
    cacheDir: join(sdkRoot, "node_modules/.vite"),
    plugins: [
      sourceBoundaryPlugin(slopRoot),
      sdkResolvePlugin(),
      tailwindcss(),
      svelte({ configFile: false, preprocess: vitePreprocess() }),
      viteSingleFile({ removeViteModuleLoader: true }),
    ],
    resolve: {
      alias: [
        { find: "@slop/runtime", replacement: resolve(sdkRoot, "packages/runtime/src/index.ts") },
        { find: "@slop/svelte", replacement: resolve(sdkRoot, "packages/svelte/src/index.ts") },
      ],
    },
    server: {
      fs: { allow: [sdkRoot, join(slopRoot, "source"), workspace] },
    },
    build: {
      outDir: join(slopRoot, "build"),
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
    },
  };
}
