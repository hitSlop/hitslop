import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { manifestSchemaURL } from "@hitslop/schema";
import { compileDataSchema } from "@hitslop/schema";
import { loadDataSchema } from "../src/data-schema.ts";
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
  test("failed rebuild leaves the previous artifact intact", async () => {
    const root = await fixture();
    const built = await buildSlop(root);
    const previous = await readFile(join(built.directory, "app.html"), "utf8");
    await writeFile(join(root, "index.html"), '<script type="module" src="/missing.ts"></script>');
    await expect(buildSlop(root)).rejects.toThrow();
    expect(await readFile(join(built.directory, "app.html"), "utf8")).toBe(previous);
    expect(await readdir(join(root, "dist"))).toEqual(["skin-test.slop"]);
  });

  test("preserves emitted worker, dynamic module, font, and wasm assets", async () => {
    const root = await fixture();
    await writeFile(join(root, "index.html"), '<script type="module" src="/main.js"></script><link rel="stylesheet" href="/src.css">');
    await writeFile(join(root, "main.js"), 'new Worker(new URL("./worker.js", import.meta.url)); import("./lazy.js").then(console.log); import wasm from "./module.wasm?url"; console.log(wasm);');
    await writeFile(join(root, "worker.js"), 'postMessage("worker fixture")');
    await writeFile(join(root, "lazy.js"), 'export const value = "lazy fixture";');
    await writeFile(join(root, "module.wasm"), new Uint8Array(5000).fill(1));
    await writeFile(join(root, "font.woff2"), new Uint8Array(5000));
    await writeFile(join(root, "src.css"), '@font-face{font-family:fixture;src:url("./font.woff2")}body{font-family:fixture}');
    const built = await buildSlop(root);
    const assets = await readdir(join(built.directory, "assets"));
    for (const prefix of ["worker-", "lazy-", "module-", "font-"]) expect(assets.some(name => name.startsWith(prefix))).toBe(true);
    const html = await readFile(join(built.directory, "app.html"), "utf8");
    expect(html).toMatch(/url\(["']?(?:\.\/)?assets\/font-/);
  });

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
    await writeFile(join(root, "schema.ts"), `import * as Type from ${JSON.stringify(import.meta.resolve("typebox"))};\nexport default Type.Object({ count: Type.Number({ default: 0, description: "Current count" }) });\n`);
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
    await writeFile(join(root, "schema.ts"), `import * as Type from ${JSON.stringify(import.meta.resolve("typebox"))};\nexport default Type.Object({ count: Type.Integer() });\n`);
    await writeFile(join(root, "assets", "theme.css"), ":root { --slop-accent: tomato; }\n");
    const built = await buildSlop(root);
    await mkdir(join(built.directory, "stores"));
    await writeFile(join(built.directory, "stores/data.json"), '{"count":2}\n');
    await writeFile(join(built.directory, "stores/theme.css"), ":root { --slop-accent: hotpink; }\n");
    await expect(validateRuntimePackage(built.directory)).resolves.toMatchObject({ slug: "skin-test" });
    await writeFile(join(built.directory, "stores/data.json"), '{"count":"two"}\n');
    await expect(validateRuntimePackage(built.directory)).rejects.toThrow("validation failed");
    await writeFile(join(built.directory, "stores/data.json"), '{"count":2}\n');
    await writeFile(join(built.directory, "stores/theme.css"), ":root { --slop-unknown: hotpink; }\n");
    await expect(validateRuntimePackage(built.directory)).rejects.toThrow("unknown theme variable");
    await writeFile(join(built.directory, "stores/theme.css"), ":root { --slop-accent: hotpink; }\n");
    await writeFile(join(built.directory, ".agents/skills/hitslop-document/SKILL.md"), "changed\n");
    await expect(validateRuntimePackage(built.directory)).resolves.toMatchObject({ slug: "skin-test" });
  });

  test("opens a runtime package without document guidance", async () => {
    const built = await buildSlop(await fixture());
    await rm(join(built.directory, ".agents"), { recursive: true });
    await expect(validateRuntimePackage(built.directory)).resolves.toMatchObject({ slug: "skin-test" });
  });

  test("requires every public theme reference to have an immutable default", async () => {
    const root = await fixture();
    await writeFile(join(root, "index.html"), '<main style="color:var(--slop-missing)">Themed</main>');
    await writeFile(join(root, "assets", "theme.css"), ":root { --slop-accent: var(--slop-missing); }\n");
    await expect(buildSlop(root)).rejects.toThrow("does not provide a default");
  });

  test("build evaluates theme defaults once and cleans staging after theme failure", async () => {
    const root = await fixture();
    await writeFile(join(root, "theme.ts"), `
      import { appendFileSync } from "node:fs";
      import { join } from "node:path";
      appendFileSync(join(import.meta.dir, "evaluations"), "x");
      export default { css: ":root { --slop-ink: black; }" };
    `);
    const built = await buildSlop(root);
    expect(await readFile(join(root, "evaluations"), "utf8")).toBe("x");
    const previous = await readFile(join(built.directory, "app.html"));
    await writeFile(join(root, "theme.ts"), "export default {};");
    await expect(buildSlop(root)).rejects.toThrow("defineTheme");
    expect(await readFile(join(built.directory, "app.html"))).toEqual(previous);
    expect(await readdir(join(root, "dist"))).toEqual(["skin-test.slop"]);
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
    expect(packageJSON.dependencies["@hitslop/runtime"]).toBe("^0.3.0");
    expect(packageJSON.dependencies["@hitslop/svelte"]).toBe("^0.3.0");
    expect(packageJSON.devDependencies["@hitslop/cli"]).toBe("^0.3.0");
    expect(packageJSON.dependencies["bits-ui"]).toBe("^2.19.0");
    expect(packageJSON.dependencies.zod).toBeUndefined();
    expect(packageJSON.dependencies.typebox).toBe("^1.3.26");
    expect(packageJSON.devDependencies["@vanilla-extract/css"]).toBe("^1.21.2");
    expect(packageJSON.devDependencies["@vanilla-extract/vite-plugin"]).toBe("^5.2.6");
    expect(packageJSON.scripts).toMatchObject({ validate: "slop validate", register: "slop register" });
    expect(packageJSON.scripts.install).toBeUndefined();
    expect(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")).author).toEqual({ name: "Jordan Singer", url: "https://example.com/jordan" });
    const authoringSkill = await readFile(join(root, ".agents/skills/hitslop-authoring/SKILL.md"), "utf8");
    expect(authoringSkill).toContain("Storage is implicit and ID-free");
    const storageGuide = await readFile(join(root, ".agents/skills/hitslop-authoring/references/storage-and-packages.md"), "utf8");
    expect(storageGuide).toContain("Use JSON for structured data");
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
    expect(await readFile(join(root, "schema.ts"), "utf8")).toContain("Type.Object");
    const styles = await readFile(join(root, "src/styles.css.ts"), "utf8");
    expect(styles).toContain('from "../theme"');
    expect(styles).not.toContain("boxShadow");
    const theme = await readFile(join(root, "theme.ts"), "utf8");
    expect(theme).toContain("defineTheme");
    expect(app).toContain("onDestroy");
    expect(app).toContain("<ExportTarget>");
    expect(packageJSON.scripts.check).toContain("svelte-check");
    expect(theme).not.toContain("--slop-backing");
    expect(await readFile(join(root, "vite.config.ts"), "utf8")).toContain("vanillaExtractPlugin");
  });
});

test("starter schema checks without mutating data or stripping unknown fields", async () => {
  const schema = await loadDataSchema(new URL("../templates/svelte/schema.ts", import.meta.url).pathname);
  const validate = compileDataSchema(schema);
  const value = { count: 7, future: { field: true } };
  const before = structuredClone(value);
  validate(value);
  expect(value).toEqual(before);
  for (const invalid of [{}, { count: "7" }, { count: 1.5 }, { count: Infinity }]) {
    expect(() => validate(invalid)).toThrow();
  }
});

test("bundled authoring skills stay in sync with canonical guidance", async () => {
  const bundled = new URL("../templates/svelte/.agents/skills/", import.meta.url).pathname;
  // Resolve from repository root (tests live three directories below it).
  const source = new URL("../../../.agents/skills/", import.meta.url).pathname;
  for (const skill of ["hitslop-authoring", "hitslop-design"]) {
    const walk = async (relative: string): Promise<void> => {
      for (const entry of await readdir(join(source, relative), { withFileTypes: true })) {
        const path = join(relative, entry.name);
        if (entry.isDirectory()) await walk(path);
        else expect(await readFile(join(bundled, path), "utf8")).toBe(await readFile(join(source, path), "utf8"));
      }
    };
    await walk(skill);
  }
});
