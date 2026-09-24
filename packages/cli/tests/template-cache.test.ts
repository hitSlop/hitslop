import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fingerprint, TemplateCache, validateTemplate } from "../../../scripts/v1/template-cache";

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
      await cp(resolve("generated/v1/templates/quick-checklist.slop"), output, { recursive: true });
    };
    const cache = new TemplateCache(directory, "shared-a");
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
    // Asset directories named like build outputs are still copied into the package.
    await mkdir(join(source, "assets/dist"), { recursive: true });
    await writeFile(join(source, "assets/dist/theme.css"), "changed asset");
    expect(await run()).toBe("built");
    expect(await run(new TemplateCache(directory, "shared-b"))).toBe("built");
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
    expect(await fingerprint(root, ["source"], "toolchain-a")).not.toBe(
      await fingerprint(root, ["source"], "toolchain-b"),
    );
    await cache.prune([]);
    expect(await run()).toBe("built");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("changing one template preserves another template's cache entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-template-cache-"));
  try {
    const cache = new TemplateCache(join(root, "cache"), "shared");
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
        await cp(resolve("generated/v1/templates", slug + ".slop"), output, { recursive: true });
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
    const cache = new TemplateCache(directory, "shared");
    await expect(
      cache.build(source, "quick-checklist", output, async () => {
        throw new Error("render failed");
      }),
    ).rejects.toThrow("render failed");
    expect(await Bun.file(join(directory, "quick-checklist/entry.json")).exists()).toBe(false);
    await cp(resolve("generated/v1/templates/quick-checklist.slop"), output, { recursive: true });
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
