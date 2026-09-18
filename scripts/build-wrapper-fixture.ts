import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compile, compileModule } from "../packages/svelte/node_modules/svelte/compiler";
import { loadDataSchema } from "../packages/cli/src/data-schema.ts";
import { initial } from "../packages/svelte/tests/fixtures/wrapper-schema.ts";

/** Real compiled Svelte boundary/context coverage in WebKit, outside the gallery. */
export async function buildWrapperFixture() {
  const fixture = resolve(import.meta.dir, "../packages/svelte/tests/fixtures");
  const bundle = await Bun.build({
    entrypoints: [join(fixture, "wrapper-main.ts")],
    target: "browser",
    format: "iife",
    conditions: ["browser"],
    plugins: [
      {
        name: "svelte-fixture",
        setup(build) {
          build.onLoad({ filter: /\.svelte\.js$/ }, async ({ path }) => ({
            contents: compileModule(await Bun.file(path).text(), {
              filename: path,
              generate: "client",
            }).js.code,
            loader: "js",
          }));
          build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
            contents: compile(await Bun.file(path).text(), { filename: path, generate: "client" })
              .js.code,
            loader: "js",
          }));
        },
      },
    ],
  });
  if (!bundle.success) throw new AggregateError(bundle.logs, "Could not build Slop fixture");
  const parent = await mkdtemp(join(tmpdir(), "hitslop-wrapper-"));
  const directory = join(parent, "wrapper.slop");
  await mkdir(join(directory, "assets"), { recursive: true });
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify({
      $schema: "https://api.hitslop.com/schemas/v1/manifest.schema.json",
      slug: "wrapper-test",
      title: "Wrapper test",
      description: "Native wrapper test fixture",
      categories: ["productivity"],
      author: { name: "hitSlop" },
      presentation: { width: 480, height: 620 },
    }),
  );
  await writeFile(
    join(directory, "app.html"),
    '<!doctype html><html><head><script src="/assets/app.js" defer></script></head><body></body></html>',
  );
  await writeFile(join(directory, "assets/app.js"), await bundle.outputs[0]!.text());
  await writeFile(
    join(directory, "data.schema.json"),
    JSON.stringify(await loadDataSchema(join(fixture, "wrapper-schema.ts"))),
  );
  await writeFile(join(directory, "assets/initial.json"), JSON.stringify(initial));
  return { parent, directory };
}
