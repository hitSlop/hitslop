import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { combineRuntimeRequirements, minimumRuntimeVersion } from "@hitslop/schema/document-runtime";
import type { Plugin } from "vite";

const engineImportError = "Document bundles must use the host runtime; remove imports of Loro or the @hitslop/sync engine.";

/** Read metadata from the packages in this build's graph, not the CLI's SDK copy. */
export function runtimeRequirementsPlugin(record: (version: string) => void): Plugin {
  const packages = new Map<string, Promise<{ name?: string; hitslop?: { runtime?: string } } | null>>();
  const packageAt = (directory: string) => {
    let promise = packages.get(directory);
    if (!promise) {
      promise = readFile(join(directory, "package.json"), "utf8").then(text => JSON.parse(text), error => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      });
      packages.set(directory, promise);
    }
    return promise;
  };
  return {
    name: "hitslop:runtime-requirements",
    async generateBundle(_options, bundle) {
      const requirements = new Set<string>();
      const ids = new Set(Object.values(bundle).flatMap(output => output.type === "chunk" ? Object.keys(output.modules) : []));
      for (const id of ids) {
        if (id.includes("/loro-crdt/") || /\/packages\/sync\/(?:src|dist|generated)\//.test(id) || /\/@hitslop\/sync\//.test(id)) {
          throw new Error(engineImportError);
        }
        if (!id.startsWith("/")) continue;
        let directory = dirname(id.split("?")[0]!);
        while (true) {
          const metadata = await packageAt(directory);
          if (metadata) {
            if (metadata.name === "@hitslop/sync" || metadata.name === "loro-crdt") throw new Error(engineImportError);
            if (metadata.name?.startsWith("@hitslop/") && metadata.hitslop?.runtime) requirements.add(metadata.hitslop.runtime);
            break;
          }
          const parent = resolve(directory, "..");
          if (parent === directory) break;
          directory = parent;
        }
      }
      record(combineRuntimeRequirements(requirements.size ? [...requirements] : [minimumRuntimeVersion]));
    },
  };
}
