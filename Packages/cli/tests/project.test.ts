import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { loadManifest } from "../src/project.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(width = 240, height = 180, channels = 4): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-mask-")); roots.push(root);
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify({
    format: "hitslop/1", runtime: "web", slug: "masked-test", title: "Masked Test", description: "A masked window validation fixture.",
    author: { name: "Test" }, categories: ["Widgets"], stores: [],
    window: { width: 240, height: 180, resizable: false, shape: { kind: "imageMask", path: "assets/window-mask.png" } },
  }));
  const data = new Uint8Array(width * height * channels).fill(255);
  await writeFile(join(root, "assets/window-mask.png"), encode({ width, height, channels, data }));
  return root;
}

describe("imageMask validation", () => {
  test("accepts a decoded RGBA mask with exact manifest dimensions", async () => {
    await expect(loadManifest(await fixture())).resolves.toMatchObject({ window: { shape: { kind: "imageMask" } } });
  });

  test("rejects a mask with different pixel dimensions", async () => {
    await expect(loadManifest(await fixture(241, 180))).rejects.toThrow("exactly 240x180");
  });

  test("rejects a PNG without an explicit alpha channel", async () => {
    await expect(loadManifest(await fixture(240, 180, 3))).rejects.toThrow("explicit alpha");
  });
});
