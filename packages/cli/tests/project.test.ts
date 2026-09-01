import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { manifestSchemaURL } from "@hitslop/schema";
import { buildSlop, loadManifest, scaffold } from "../src/project.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(width = 240, height = 180, channels = 4): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-skin-")); roots.push(root); await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify({ $schema: manifestSchemaURL, slug: "skin-test", title: "Skin Test", description: "A PNG skin validation fixture.", categories: ["utilities"], presentation: { width: 240, height: 180, skin: "assets/skin.png" } }));
  await writeFile(join(root, "index.html"), "<main>Skin</main>");
  await writeFile(join(root, "assets/skin.png"), encode({ width, height, channels, data: new Uint8Array(width * height * channels).fill(255) }));
  return root;
}

describe("skin validation", () => {
  test("accepts exact RGBA dimensions", async () => await expect(loadManifest(await fixture())).resolves.toMatchObject({ presentation: { skin: "assets/skin.png" } }));
  test("rejects different dimensions", async () => await expect(loadManifest(await fixture(241, 180))).rejects.toThrow("exactly 240x180"));
  test("rejects PNGs without alpha", async () => await expect(loadManifest(await fixture(240, 180, 3))).rejects.toThrow("RGBA PNG"));
});

describe("immutable artifacts", () => {
  test("inlines authored CSS into app.html", async () => {
    const root = await fixture();
    await writeFile(join(root, "index.html"), '<link rel="stylesheet" href="/src.css"><main>Skin</main>');
    await writeFile(join(root, "src.css"), "body { background: rgb(12, 34, 56); }");
    const built = await buildSlop(root);
    expect(await readFile(join(built.directory, "app.html"), "utf8")).toContain("#0c2238");
    await expect(readFile(join(built.directory, "src.css"))).rejects.toThrow();
  });

  test("builds without stores or a runtime stylesheet", async () => {
    const root = await fixture(); await writeFile(join(root, "style.css"), "body { color: red }"); await mkdir(join(root, "stores")); await writeFile(join(root, "stores/data.json"), "{}\n");
    const built = await buildSlop(root);
    expect(await readFile(join(built.directory, "app.html"), "utf8")).toContain("Skin");
    await expect(readFile(join(built.directory, "style.css"))).rejects.toThrow();
    await expect(readFile(join(built.directory, "stores/data.json"))).rejects.toThrow();
    await expect(readFile(join(built.directory, "AGENTS.md"))).rejects.toThrow();
  });
});

describe("authoring scaffold", () => {
  test("includes portable skills, complete scripts, Bits UI, and export-aware starter", async () => {
    const root = await mkdtemp(join(tmpdir(), "hitslop-scaffold-")); roots.push(root);
    await scaffold(root, { title: "Tiny Tally", description: "Counts a tiny thing.", categories: ["utilities"] });
    const packageJSON = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { dependencies: Record<string, string>; scripts: Record<string, string> };
    expect(packageJSON.dependencies["bits-ui"]).toBe("^2.19.0");
    expect(packageJSON.scripts).toMatchObject({ validate: "slop validate", install: "slop install" });
    const authoringSkill = await readFile(join(root, ".agents/skills/hitslop-authoring/SKILL.md"), "utf8");
    expect(authoringSkill).toContain("Storage is implicit and ID-free");
    expect(await readFile(join(root, ".agents/skills/hitslop-authoring/references/storage-and-packages.md"), "utf8")).toContain("SQLite");
    const designSkill = await readFile(join(root, ".agents/skills/hitslop-design/SKILL.md"), "utf8");
    expect(designSkill).toContain("data-slop-export");
    expect(designSkill).toContain("host window be the outer object boundary");
    expect(await readFile(join(root, ".agents/skills/hitslop-design/references/presentation-and-export.md"), "utf8")).toContain("Transparent backgrounds");
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("hitslop-authoring");
    expect(agents).toContain("hitslop-design");
    expect(await readFile(join(root, "src/App.svelte"), "utf8")).toContain('const title = "Tiny Tally"');
    const styles = await readFile(join(root, "src/styles.css"), "utf8");
    expect(styles).toContain("--slop-surface");
    expect(styles).not.toContain("--slop-backing");
    expect(styles).not.toContain("box-shadow");
  });
});
