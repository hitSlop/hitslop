import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildSlop } from "../builder/index.mjs";
import { sourceHash } from "../builder/hash.mjs";

async function packageRoot() {
  const temporary = await mkdtemp(join(tmpdir(), "slop-builder-test-"));
  const root = join(temporary, "Fixture.slop");
  await mkdir(join(root, "source"), { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify({ format: "slop-web/1", title: "Fixture", artifact: {} }));
  return { temporary, root };
}

test("hashes every nested source file", async () => {
  const { temporary, root } = await packageRoot();
  try {
    await writeFile(join(root, "source/main.ts"), "export {};\n");
    const first = sourceHash(root);
    await mkdir(join(root, "source/models"));
    await writeFile(join(root, "source/models/state.json"), "{}\n");
    assert.notEqual(sourceHash(root), first);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

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
