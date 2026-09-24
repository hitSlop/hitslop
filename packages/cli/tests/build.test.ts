import { test, expect } from "bun:test";
import { buildProject, runtimePlugin } from "../src/build";
import { build as esbuild } from "esbuild";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTemplate, installTemplate } from "../src/template";
import { readdir, mkdir } from "node:fs/promises";
test("build contains no document engine, and rejects direct Loro imports", async () => {
  const root = await mkdtemp(join(process.cwd(), ".v1-build-test-"));
  try {
    const source = join(root, "source");
    await cp("examples/slops/quick-checklist", source, { recursive: true });
    const output = await buildProject(source, join(root, "built.slop"));
    const js = await readFile(join(output, "assets/main.js"), "utf8");
    expect(js).toContain("/__runtime__/index.js");
    expect(js).not.toContain("loro_wasm_bg");
    await writeFile(
      join(source, "main.ts"),
      'import {LoroDoc} from "loro-crdt"; console.log(new LoroDoc());',
    );
    await expect(buildProject(source, join(root, "bad.slop"))).rejects.toThrow(
      "cannot import engine",
    );
    await writeFile(join(source, "main.ts"),
      'import {Document} from "@hitslop/document/runtime"; console.log(Document);');
    await expect(buildProject(source, join(root, "bad-runtime.slop"))).rejects.toThrow(
      "cannot import engine",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

test("plain DOM adapter builds and renders with no Svelte or embedded engine", async () => {
  const root = await mkdtemp(join(process.cwd(), ".v1-build-test-"));
  try {
    const source = join(root, "source");
    await cp("packages/cli/templates/checklist", source, { recursive: true });
    await writeFile(join(source, "main.ts"), `
      import "./styles.css";
      import {mountDocumentView} from "@hitslop/document/adapter";
      await mountDocumentView({
        mount({document: doc, target}) {
          const root = document.createElement("main");
          root.dataset.hitslopRoot = "";
          const render = () => { root.textContent = String(doc.current.title); };
          render();
          target.append(root);
          const stop = doc.subscribe(render);
          return { rendered() {}, unmount() { stop(); root.remove(); } };
        },
      });
    `);
    // Only the host-runtime plugin: a non-Svelte app needs no Svelte compiler or runtime.
    const bundle = await esbuild({
      entryPoints: [join(source, "main.ts")], bundle: true, write: false,
      outdir: join(root, "graph"), format: "esm", platform: "browser",
      metafile: true, plugins: [runtimePlugin],
    });
    for (const input of Object.keys(bundle.metafile!.inputs)) {
      expect(input).not.toMatch(/svelte|loro-crdt/);
      expect(input).not.toMatch(/document\/src\/(document|operations|session|runtime-entry)\.ts/);
    }
    const renderer = join(process.cwd(), "apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
    const output = await buildTemplate(source, renderer, join(root, "plain.slop"));
    const png = await readFile(join(output, "QuickLook/Preview.png"));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 90000);

test("init creates a buildable v1 source and refuses to overwrite it", async () => {
  const root = await mkdtemp(join(process.cwd(), ".v1-build-test-"));
  const source = join(root, "starter");
  try {
    const run = () =>
      Bun.spawn([process.execPath, "packages/cli/src/cli.ts", "init", source], {
        stdout: "ignore",
        stderr: "ignore",
      }).exited;
    expect(await run()).toBe(0);
    expect(await run()).toBe(1);
    const metadata = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
    expect(metadata.dependencies["@hitslop/document"]).not.toContain("__HITSLOP");
    const built = await buildProject(source, join(root, "starter.slop"));
    expect(JSON.parse(await readFile(join(built, "manifest.json"), "utf8")).runtime).toBe(
      "hitslop-v1",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

test("Slop and child components share the host document", async () => {
  const root = await mkdtemp(join(process.cwd(), ".v1-build-test-"));
  const source = join(root, "source");
  const renderer = join(process.cwd(), "apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
  try {
    await cp("examples/slops/quick-checklist", source, { recursive: true });
    await writeFile(join(source, "Child.svelte"), `
      <script lang="ts">
        import {getContext} from "svelte";
        import {documentContext, useDocument} from "@hitslop/document/svelte";
        import schema from "./schema";
        const doc = useDocument(schema);
        if (doc.fields !== getContext(documentContext).fields) throw new Error("Child opened another document");
      </script>
      <h1>{doc.current.title}</h1>
    `);
    await writeFile(join(source, "App.svelte"), `
      <script lang="ts">
        import {mount} from "svelte";
        import {Slop} from "@hitslop/document/svelte";
        import Child from "./Child.svelte";
        let missingHost = "";
        try { mount(Slop, {target: document.createElement("div"), props: {children: () => {}}, context: new Map()}); }
        catch (error) { missingHost = String(error); }
        if (!missingHost.includes("Slop requires a host document"))
          throw new Error("Missing host document was not diagnosed: " + missingHost);
      </script>
      <Slop>
        <Child />
        {#snippet exportView()}<Child />{/snippet}
        {#snippet icon()}<Child />{/snippet}
      </Slop>
    `);
    const output = await buildTemplate(source, renderer, join(root, "probe.slop"));
    for (const name of ["Preview", "Icon"]) {
      const png = await readFile(join(output, `QuickLook/${name}.png`));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 90000);

test("native template assets are complete before replacing a registered master", async () => {
  const root = await mkdtemp(join(process.cwd(), ".v1-build-test-"));
  const renderer = join(
    process.cwd(),
    "apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native",
  );
  try {
    const output = await buildTemplate(
      "examples/slops/quick-checklist",
      renderer,
      join(root, "Checklist.slop"),
    );
    for (const name of ["Preview", "Icon"]) {
      const png = await readFile(join(output, `QuickLook/${name}.png`));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      if (name === "Icon") {
        expect(png.readUInt32BE(16)).toBe(512);
        expect(png.readUInt32BE(20)).toBe(512);
      }
    }
    expect(await readdir(output)).not.toContain("state");
    expect(await readdir(output)).not.toContain("Icon\r");
    const templates = join(root, "templates");
    await mkdir(templates);
    const master = join(templates, "quick-checklist.slop");
    await installTemplate(output, master);
    await installTemplate(output, master);
    expect((await readdir(join(root, "template-backups"))).length).toBe(1);
    const before = await readFile(join(output, "QuickLook/Preview.png"));
    await expect(
      buildTemplate("examples/slops/quick-checklist", "/usr/bin/false", output),
    ).rejects.toThrow();
    expect(await readFile(join(output, "QuickLook/Preview.png"))).toEqual(before);
    await mkdir(join(master, "state"));
    await expect(installTemplate(output, master)).rejects.toThrow("writable document state");
    const badSource = join(root, "bad-capture-source");
    await cp("examples/slops/quick-checklist", badSource, { recursive: true });
    await writeFile(
      join(badSource, "App.svelte"),
      `
      <script lang="ts">
        import {Slop,useDocument} from "@hitslop/document/svelte";
        import schema from "./schema";
        const document=useDocument(schema);
        function broken(){throw new Error("Authored icon failed");}
      </script>
      <Slop>
        <h1>{document.current.title}</h1>
        {#snippet icon()}<span>{broken()}</span>{/snippet}
      </Slop>
    `,
    );
    await expect(buildTemplate(badSource, renderer, output)).rejects.toThrow(
      "Authored icon failed",
    );
    expect(await readFile(join(output, "QuickLook/Preview.png"))).toEqual(before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 90000);

test("build paths and fresh source evaluation do not depend on authored stdout", async () => {
  const root = await mkdtemp(join(process.cwd(), ".v1-build-test-"));
  try {
    const source = join(root, "source with spaces");
    await cp("packages/cli/templates/checklist", source, { recursive: true });
    const initialPath = join(source, "initial.ts");
    const original = await readFile(initialPath, "utf8");
    await writeFile(initialPath, original + '\nconsole.log("authored output is not a path");\n');
    const defaultOutput = await buildProject(source);
    expect(defaultOutput).toBe(join(source, "dist", "quick-checklist.slop"));
    const first = JSON.parse(await readFile(join(defaultOutput, "initial.json"), "utf8"));
    await writeFile(
      initialPath,
      `console.log("another log"); export default ${JSON.stringify({ ...first, title: "Fresh evaluation" })};`,
    );
    const explicitOutput = join(root, "output with spaces.slop");
    expect(await buildProject(source, explicitOutput)).toBe(explicitOutput);
    expect(JSON.parse(await readFile(join(explicitOutput, "initial.json"), "utf8")).title).toBe(
      "Fresh evaluation",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

test("copied fonts retain their URLs without duplicate bundles", async () => {
  const root = await mkdtemp(join(process.cwd(), ".v1-build-test-"));
  try {
    const source = join(root, "source");
    await cp("examples/slops/quick-checklist", source, { recursive: true });
    await mkdir(join(source, "assets/fonts"), { recursive: true });
    await mkdir(join(source, "dependency"));
    await writeFile(join(source, "assets/fonts/My Font.ttf"), "copied-font");
    await writeFile(join(source, "assets/fonts/OFL.txt"), "font license");
    await writeFile(join(source, "dependency/External.woff2"), "dependency-font");
    await writeFile(join(source, "font-test.css"), `
      @font-face { font-family: Local; src: url('./assets/fonts/My Font.ttf'); }
      @font-face { font-family: Direct; src: url('/assets/fonts/My%20Font.ttf'); }
      @font-face { font-family: External; src: url('./dependency/External.woff2'); }
    `);
    const main = await readFile(join(source, "main.ts"), "utf8");
    await writeFile(join(source, "main.ts"), main + `
      import './font-test.css';
      import fontURL from './assets/fonts/My Font.ttf';
      console.log(fontURL);
    `);
    const output = await buildProject(source, join(root, "fonts.slop"));
    const files = await readdir(join(output, "assets"), { recursive: true });
    expect(files.filter(file => file.endsWith(".ttf"))).toEqual(["fonts/My Font.ttf"]);
    expect(files.filter(file => file.endsWith(".woff2"))).toHaveLength(1);
    expect(await readFile(join(output, "assets/fonts/OFL.txt"), "utf8")).toBe("font license");
    expect(await readFile(join(output, "assets/main.css"), "utf8")).toContain("/assets/fonts/My%20Font.ttf");
    expect(await readFile(join(output, "assets/main.js"), "utf8")).toContain("/assets/fonts/My%20Font.ttf");
  } finally { await rm(root, { recursive: true, force: true }); }
}, 60000);
