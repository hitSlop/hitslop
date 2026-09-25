import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  sharedTemplatePaths,
  TemplateCache,
  validateTemplate,
} from "../../../scripts/v1/template-cache";

import identity from "../../document/src/runtime-identity.json";
import { defineDocument, s } from "../../document/src/schema";

// Cache behavior needs a valid package, not a native-generated template collection.
async function writePackage(output: string, slug = "quick-checklist") {
  await mkdir(join(output, "assets"), { recursive: true });
  await mkdir(join(output, "QuickLook"));
  const manifest = {
    $schema: "https://api.hitslop.com/schemas/v1/manifest.schema.json",
    runtime: "hitslop-v1",
    slug,
    title: "Cache fixture",
    description: "Cache contract",
    author: { name: "hitSlop" },
    categories: ["utilities"],
    presentation: { width: 320, height: 240 },
  };
  const files = {
    "manifest.json": manifest,
    "state.schema.json": defineDocument({ title: s.text() }).descriptor,
    "initial.json": { title: "Cache fixture" },
    "assets/runtime.json": {
      runtimeContract: identity.runtimeContract,
      minRuntimeRevision: identity.runtimeRevision,
      sdkVersion: identity.sdkVersion,
    },
  };
  for (const [name, value] of Object.entries(files))
    await writeFile(join(output, name), JSON.stringify(value));
  await writeFile(join(output, "app.html"), "<!doctype html><title>Cache fixture</title>");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=",
    "base64",
  );
  await writeFile(join(output, "QuickLook/Preview.png"), png);
}

test("template cache reuses matching artifacts and rebuilds changed or damaged entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-template-cache-"));
  try {
    const source = join(root, "source"),
      output = join(root, "output.slop"),
      directory = join(root, "cache");
    await mkdir(source);
    await writeFile(join(source, "main.ts"), "first");
    let builds = 0;
    const build = async () => {
      builds++;
      await writePackage(output);
    };
    const cache = new TemplateCache(directory, { "@swift": "a" });
    const run = async (current = cache) => {
      await rm(output, { recursive: true, force: true });
      return current.build(source, "quick-checklist", output, build);
    };
    expect(await run()).toBe("built");
    expect(await run()).toBe("hit");
    expect(builds).toBe(1);
    await mkdir(join(source, "dist"));
    await writeFile(join(source, "dist/ignored.js"), "generated");
    expect(await run()).toBe("hit");
    await writeFile(join(source, "main.ts"), "changed");
    expect(await run()).toBe("built");
    expect(cache.misses.get("quick-checklist")).toEqual(["template main.ts"]);
    // Asset directories named like build outputs are still copied into the package.
    await mkdir(join(source, "assets/dist"), { recursive: true });
    await writeFile(join(source, "assets/dist/theme.css"), "changed asset");
    expect(await run()).toBe("built");
    const toolchain = new TemplateCache(directory, { "@swift": "b" });
    expect(await run(toolchain)).toBe("built");
    expect(toolchain.misses.get("quick-checklist")).toEqual(["shared @swift"]);
    expect(await run()).toBe("built");
    await writeFile(join(directory, "quick-checklist/package.slop/app.html"), "damaged");
    expect(await run()).toBe("built");
    await writeFile(join(directory, "quick-checklist/entry.json"), "interrupted");
    expect(await run()).toBe("built");
    await mkdir(join(directory, "removed-template"));
    await writeFile(
      join(directory, "removed-template/entry.json"),
      JSON.stringify({ format: 1, key: "old", checksum: "old" }),
    );
    await cache.prune(["quick-checklist"]);
    expect(await readdir(directory)).toEqual(["quick-checklist"]);
    expect(await Bun.file(join(directory, "quick-checklist/entry.json")).exists()).toBe(true);
    await mkdir(join(directory, "unrelated"));
    await cache.prune(["quick-checklist"]);
    expect(await readdir(directory)).toContain("unrelated");
    await cache.prune([]);
    expect(await run()).toBe("built");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("changing one template preserves another template's cache entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-template-cache-"));
  try {
    const cache = new TemplateCache(join(root, "cache"), {});
    const builds: string[] = [];
    for (const slug of ["quick-checklist", "small-expenses"]) {
      await mkdir(join(root, slug));
      await writeFile(join(root, slug, "main.ts"), "original");
    }
    const run = async (slug: string) => {
      const output = join(root, slug + ".slop");
      await rm(output, { recursive: true, force: true });
      return cache.build(join(root, slug), slug, output, async () => {
        builds.push(slug);
        await writePackage(output, slug);
      });
    };
    await run("quick-checklist");
    await run("small-expenses");
    await writeFile(join(root, "quick-checklist/main.ts"), "changed");
    expect(await run("quick-checklist")).toBe("built");
    expect(await run("small-expenses")).toBe("hit");
    expect(builds).toEqual(["quick-checklist", "small-expenses", "quick-checklist"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed builds never publish cache entries; cached packages reject state and links", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-template-cache-"));
  try {
    const source = join(root, "source"),
      output = join(root, "output.slop"),
      directory = join(root, "cache");
    await mkdir(source);
    const cache = new TemplateCache(directory, {});
    await expect(
      cache.build(source, "quick-checklist", output, async () => {
        throw new Error("render failed");
      }),
    ).rejects.toThrow("render failed");
    expect(await Bun.file(join(directory, "quick-checklist/entry.json")).exists()).toBe(false);
    await writePackage(output);
    await validateTemplate(output, "quick-checklist");
    await mkdir(join(output, "state"));
    await expect(validateTemplate(output, "quick-checklist")).rejects.toThrow(
      "Unexpected template content",
    );
    await rm(join(output, "state"), { recursive: true });
    const html = await readFile(join(output, "app.html"));
    await writeFile(join(root, "external.html"), html);
    await rm(join(output, "app.html"));
    await symlink(join(root, "external.html"), join(output, "app.html"));
    await expect(validateTemplate(output, "quick-checklist")).rejects.toThrow(
      "Invalid runtime resource",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("template artwork is keyed on the compiler, not CLI routing, help or scripts", async () => {
  const repository = join(import.meta.dir, "../../..");
  const paths = await sharedTemplatePaths(repository, []);
  for (const input of [
    "packages/cli/src/build.ts",
    "packages/cli/src/svelte-plugin.ts",
    "packages/document/src",
    "packages/cli/runtimes",
  ])
    expect(paths).toContain(input);
  for (const unrelated of [
    "packages/cli/src/cli.ts",
    "packages/cli/src/app.ts",
    "packages/cli/skills",
    "scripts/v1/hygiene.ts",
    "scripts/v1/release-check.ts",
    "examples/slops/PRODUCT.md",
  ])
    expect(paths.some((path) => path === unrelated || path.startsWith(unrelated + "/"))).toBe(
      false,
    );
});
