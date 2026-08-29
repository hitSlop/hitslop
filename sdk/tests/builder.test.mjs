import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildSlop } from "../builder/index.mjs";
import { packageTemplate } from "../builder/templates.mjs";

async function packageRoot() {
  const temporary = await mkdtemp(join(tmpdir(), "slop-builder-test-"));
  const root = join(temporary, "Fixture.slop");
  await mkdir(join(root, "source"), { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify({ format: "slop-web/1", title: "Fixture" }));
  return { temporary, root };
}

test("rejects build imports outside source", async () => {
  const { temporary, root } = await packageRoot();
  try {
    await writeFile(join(root, "data.json"), "{}\n");
    await writeFile(join(root, "source/main.ts"), 'import data from "../data.json"; console.log(data);\n');
    await assert.rejects(buildSlop(root), /Build inputs must live under source\/.*data\.json/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("builds direct Lucide icon imports", async () => {
  const { temporary, root } = await packageRoot();
  try {
    await writeFile(
      join(root, "source/App.svelte"),
      `<script>import Play from "@lucide/svelte/icons/play";</script>\n<Play aria-label="Play" />\n`
    );
    await writeFile(
      join(root, "source/main.ts"),
      `import { mount } from "svelte";\nimport App from "./App.svelte";\nmount(App, { target: document.querySelector("#app")! });\n`
    );

    const result = await buildSlop(root);
    assert.ok(result.bytes > 1_000);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("packages authored templates without source or hashes", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "slop-template-test-"));
  const template = join(temporary, "fixture");
  const output = join(temporary, "Fixture.slop");
  try {
    await mkdir(join(template, "source"), { recursive: true });
    await writeFile(join(template, "source/main.ts"), "document.body.textContent = 'fixture';\n");
    await writeFile(join(template, "style.css"), "/* overrides */\n");
    await writeFile(join(template, "data.json"), "{}\n");
    await writeFile(join(template, "template.json"), JSON.stringify({
      format: "slop-web/1",
      id: "test.fixture",
      title: "Fixture",
      catalog: { summary: "Fixture template", categories: ["Tests"], tags: [] },
      window: { width: 320, height: 320, shape: { kind: "roundedRect", radius: 16 } },
      stores: [{ id: "state", kind: "json", path: "data.json" }],
    }));

    await packageTemplate(template, output);
    const manifest = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
    assert.equal(existsSync(join(output, "source")), false);
    assert.equal(existsSync(join(output, "build/index.html")), true);
    assert.equal(existsSync(join(output, "style.css")), true);
    assert.equal("artifact" in manifest, false);
    assert.equal("appearance" in manifest, false);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
