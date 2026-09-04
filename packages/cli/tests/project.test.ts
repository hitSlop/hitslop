import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { manifestSchemaURL } from "@hitslop/schema";
import { buildSlop, loadManifest, scaffold } from "../src/project.ts";
import { validateRuntimePackage } from "../src/runtime-package.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(width = 240, height = 180, channels = 4): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-skin-")); roots.push(root); await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify({ $schema: manifestSchemaURL, author: { name: "Fixture Author", url: "https://example.com" }, slug: "skin-test", title: "Skin Test", description: "A PNG skin validation fixture.", categories: ["utilities"], presentation: { width: 240, height: 180, skin: "assets/skin.png" } }));
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

  test("builds immutable theme and schema metadata without document stores", async () => {
    const root = await fixture();
    await writeFile(join(root, "index.html"), '<main style="color:var(--slop-accent)">Themed</main>');
    await writeFile(join(root, "schema.ts"), `import * as z from ${JSON.stringify(import.meta.resolve("zod"))};\nexport default z.object({ count: z.number().default(0).describe("Current count") });\n`);
    await writeFile(join(root, "assets", "theme.css"), ":root { --slop-accent: tomato; }\n");
    const built = await buildSlop(root);
    const html = await readFile(join(built.directory, "app.html"), "utf8");
    expect(html).toContain('href="assets/theme.css" data-hitslop-theme-default');
    expect(html).toContain('href="theme.css" data-hitslop-theme');
    expect(await readFile(join(built.directory, "assets", "theme.css"), "utf8")).toContain("--slop-accent");
    expect(JSON.parse(await readFile(join(built.directory, "data.schema.json"), "utf8"))).toMatchObject({ properties: { count: { type: "number" } } });
    await expect(readFile(join(built.directory, "schema.json"))).rejects.toThrow();
    await expect(readFile(join(built.directory, "SCHEMA.md"))).rejects.toThrow();
    expect(await readFile(join(built.directory, ".agents/skills/hitslop-document/SKILL.md"), "utf8")).toContain("Read `manifest.json` first");
    await expect(readFile(join(built.directory, "stores", "theme.css"))).rejects.toThrow();
  });

  test("validates document data, theme overrides, and the canonical skill", async () => {
    const root = await fixture();
    await writeFile(join(root, "index.html"), '<main style="color:var(--slop-accent)">Themed</main>');
    await writeFile(join(root, "schema.ts"), `import * as z from ${JSON.stringify(import.meta.resolve("zod"))};\nexport default z.object({ count: z.number().int() });\n`);
    await writeFile(join(root, "assets", "theme.css"), ":root { --slop-accent: tomato; }\n");
    const built = await buildSlop(root);
    await mkdir(join(built.directory, "stores"));
    await writeFile(join(built.directory, "stores/data.json"), '{"count":2}\n');
    await writeFile(join(built.directory, "stores/theme.css"), ":root { --slop-accent: hotpink; }\n");
    await expect(validateRuntimePackage(built.directory)).resolves.toMatchObject({ slug: "skin-test" });
    await writeFile(join(built.directory, "stores/data.json"), '{"count":"two"}\n');
    await expect(validateRuntimePackage(built.directory)).rejects.toThrow("does not match");
    await writeFile(join(built.directory, "stores/data.json"), '{"count":2}\n');
    await writeFile(join(built.directory, "stores/theme.css"), ":root { --slop-unknown: hotpink; }\n");
    await expect(validateRuntimePackage(built.directory)).rejects.toThrow("unknown theme variable");
    await writeFile(join(built.directory, "stores/theme.css"), ":root { --slop-accent: hotpink; }\n");
    await writeFile(join(built.directory, ".agents/skills/hitslop-document/SKILL.md"), "changed\n");
    await expect(validateRuntimePackage(built.directory)).rejects.toThrow("canonical");
  });

  test("rejects a runtime package without its document skill", async () => {
    const built = await buildSlop(await fixture());
    await rm(join(built.directory, ".agents"), { recursive: true });
    await expect(validateRuntimePackage(built.directory)).rejects.toThrow("missing .agents/skills/hitslop-document/SKILL.md");
  });

  test("requires every public theme reference to have an immutable default", async () => {
    const root = await fixture();
    await writeFile(join(root, "index.html"), '<main style="color:var(--slop-missing)">Themed</main>');
    await writeFile(join(root, "assets", "theme.css"), ":root { --slop-accent: var(--slop-missing); }\n");
    await expect(buildSlop(root)).rejects.toThrow("does not provide a default");
  });

  test("rejects invalid schema semantics and non-UTF-8 themes", async () => {
    const root = await fixture();
    const built = await buildSlop(root);
    await writeFile(join(built.directory, "data.schema.json"), '{"type":"not-a-json-schema-type"}\n');
    await expect(validateRuntimePackage(built.directory)).rejects.toThrow("valid JSON Schema");
    await writeFile(join(root, "assets", "theme.css"), Buffer.from([0xff]));
    await expect(buildSlop(root)).rejects.toThrow("assets/theme.css must be UTF-8");
  });

  test("copies one bounded publisher document guide", async () => {
    const root = await fixture();
    await writeFile(join(root, "document-guide.md"), "# Counter data\n\nKeep count non-negative.\n");
    const built = await buildSlop(root);
    expect(await readFile(join(built.directory, ".agents/skills/hitslop-document/references/app-guide.md"), "utf8")).toContain("Keep count");
    await writeFile(join(root, "document-guide.md"), Buffer.alloc(32 * 1024 + 1));
    await expect(buildSlop(root)).rejects.toThrow("32 KiB");
  });
});

describe("authoring scaffold", () => {
  test("includes portable skills, complete scripts, Bits UI, and export-aware starter", async () => {
    const root = await mkdtemp(join(tmpdir(), "hitslop-scaffold-")); roots.push(root);
    await scaffold(root, { title: "Tiny Tally", description: "Counts a tiny thing.", categories: ["utilities"], author: { name: "Jordan Singer", url: "https://example.com/jordan" } });
    const packageJSON = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string>; scripts: Record<string, string> };
    expect(packageJSON.dependencies["@hitslop/runtime"]).toBe("^0.1.2");
    expect(packageJSON.dependencies["@hitslop/svelte"]).toBe("^0.1.2");
    expect(packageJSON.devDependencies["@hitslop/cli"]).toBe("^0.1.4");
    expect(packageJSON.dependencies["bits-ui"]).toBe("^2.19.0");
    expect(packageJSON.dependencies.zod).toBe("^4.5.2");
    expect(packageJSON.devDependencies["@vanilla-extract/css"]).toBe("^1.17.4");
    expect(packageJSON.devDependencies["@vanilla-extract/vite-plugin"]).toBe("^5.1.1");
    expect(packageJSON.scripts).toMatchObject({ validate: "slop validate", register: "slop register" });
    expect(packageJSON.scripts.install).toBeUndefined();
    expect(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")).author).toEqual({ name: "Jordan Singer", url: "https://example.com/jordan" });
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
    const app = await readFile(join(root, "src/App.svelte"), "utf8");
    expect(app).toContain('const title = "Tiny Tally"');
    expect(app).toContain("jsonStore({ schema: counterSchema, initial:");
    expect(await readFile(join(root, "schema.ts"), "utf8")).toContain("z.object");
    const styles = await readFile(join(root, "src/styles.css.ts"), "utf8");
    expect(styles).toContain('from "./theme-contract.css.ts"');
    expect(styles).not.toContain("boxShadow");
    const theme = await readFile(join(root, "assets/theme.css"), "utf8");
    expect(theme).toContain("--slop-surface");
    expect(theme).not.toContain("--slop-backing");
    expect(await readFile(join(root, "vite.config.ts"), "utf8")).toContain("vanillaExtractPlugin");
  });
});
