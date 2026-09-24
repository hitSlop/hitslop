import { transform, type Plugin } from "esbuild";
import { compile, compileModule } from "svelte/compiler";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Keep Svelte compilation and its single runtime resolution in one place. */
export function sveltePlugin(cliRoot: string): Plugin {
  return {
    name: "svelte",
    setup(b) {
      // Libraries with their own peer installation must share the app's
      // Svelte runtime; two copies split effect/context and DOM state.
      b.onResolve({ filter: /^svelte(?:\/.*)?$/ }, (args) => {
        if (args.pluginData?.svelteRoot) return;
        return b.resolve(args.path, {
          kind: args.kind,
          resolveDir: cliRoot,
          pluginData: { svelteRoot: true },
        });
      });
      b.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
        contents: compile(await readFile(path, "utf8"), {
          filename: path,
          generate: "client",
          css: "injected",
          dev: false,
        }).js.code,
        loader: "js",
        resolveDir: dirname(path),
      }));
      b.onLoad({ filter: /\.svelte\.(ts|js)$/ }, async ({ path }) => ({
        contents: compileModule(
          (await transform(await readFile(path, "utf8"), { loader: "ts" })).code,
          { filename: path, generate: "client", dev: false },
        ).js.code,
        loader: "js",
        resolveDir: dirname(path),
      }));
    },
  };
}
