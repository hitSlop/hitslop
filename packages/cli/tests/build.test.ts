import { test, expect } from "bun:test";
import { buildProject } from "../src/build";
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
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

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
      <Slop {document}>
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
