import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { minimumRuntimeVersion, selectRuntime } from "@hitslop/schema/document-runtime";
import type { Plugin } from "vite";

const catalogPath = fileURLToPath(import.meta.resolve("@hitslop/sync/runtime-catalog.json"));
const directory = dirname(catalogPath);
const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as { versions: string[] };
export const previewRuntimeVersion = selectRuntime(minimumRuntimeVersion, catalog.versions);
if (!previewRuntimeVersion) throw new Error(`The CLI needs a document runtime compatible with ${minimumRuntimeVersion}`);
const filename = `document-runtime-${previewRuntimeVersion}.js`;
export const runtimeResourcePath = `/__hitslop_runtime__/${filename}`;
const loader = readFileSync(join(directory, "preview-loader.js"), "utf8");
export const previewRuntimeScript = `<script>window.__hitslopRuntimeConfig=${JSON.stringify({ version: previewRuntimeVersion, scriptURL: runtimeResourcePath })};${loader.replaceAll("</script", "<\\/script")}</script>`;

export function previewRuntimePlugin(): Plugin {
  return {
    name: "hitslop:preview-runtime",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== runtimeResourcePath) return next();
        try {
          response.setHeader("Content-Type", "text/javascript");
          response.end(readFileSync(join(directory, filename)));
        } catch (error) { next(error as Error); }
      });
    },
  };
}
