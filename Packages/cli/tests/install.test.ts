import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { manifestSchemaURL } from "@hitslop/schema";
import { decode, encode } from "fast-png";
import { installTemplate, validateTemplatePackage } from "../src/install.ts";
import { thumbnailFromPng } from "../src/static-preview.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(): Promise<{ project: string; templates: string; preview: string }> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-install-")); roots.push(root);
  const project = join(root, "source"); const templates = join(root, "templates"); const preview = join(root, "cover.png");
  await mkdir(project, { recursive: true });
  await writeFile(join(project, "manifest.json"), JSON.stringify({ $schema: manifestSchemaURL, slug: "tiny-counter", title: "Tiny Counter", description: "Counts a very small thing.", categories: ["utilities"], presentation: { width: 320, height: 240 } }));
  await writeFile(join(project, "index.html"), "<main>Hello</main>");
  await writeFile(preview, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  return { project, templates, preview };
}

describe("installTemplate", () => {
  test("installs one store-free slop with static Quick Look images", async () => {
    const item = await fixture(); const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview });
    expect(result.directory).toBe(join(item.templates, "installed", "tiny-counter.slop"));
    expect(await readFile(join(result.directory, "app.html"), "utf8")).toContain("Hello");
    expect(await readFile(join(result.directory, "QuickLook", "Preview.png"))).toEqual(await readFile(item.preview));
    expect(await readFile(join(result.directory, "QuickLook", "Thumbnail.png"))).toEqual(await readFile(item.preview));
    await expect(readFile(join(result.directory, "install.json"))).rejects.toThrow();
    await expect(readFile(join(result.directory, "AGENTS.md"))).rejects.toThrow();
  });

  test("asks before replacing and preserves an install when declined", async () => {
    const item = await fixture(); await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview });
    let asked = false;
    await expect(installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, confirmOverwrite: async () => { asked = true; return false; } })).rejects.toThrow("cancelled");
    expect(asked).toBeTrue();
    expect(await readFile(join(item.templates, "installed", "tiny-counter.slop", "app.html"), "utf8")).toContain("Hello");
  });

  test("force replaces an existing install", async () => {
    const item = await fixture(); await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview });
    expect((await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, force: true })).replaced).toBeTrue();
  });

  test("captures a preview when no override is supplied", async () => {
    const item = await fixture(); let captured = false;
    const result = await installTemplate(item.project, { templatesRoot: item.templates, capturePreview: async (packageDirectory: string, output: string) => {
      captured = true;
      await mkdir(join(packageDirectory, "stores"), { recursive: true });
      await writeFile(join(packageDirectory, "stores", "data.json"), "{}\n");
      await writeFile(output, await readFile(item.preview));
    } });
    expect(captured).toBeTrue();
    await expect(readFile(join(result.directory, "stores", "data.json"))).rejects.toThrow();
  });

  test("uses an author-supplied static thumbnail", async () => {
    const item = await fixture();
    const thumbnail = join(item.project, "thumbnail.png");
    await writeFile(thumbnail, encode({ width: 2, height: 1, channels: 4, data: new Uint8Array(8).fill(127) }));
    const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, thumbnail });
    expect(await readFile(join(result.directory, "QuickLook", "Thumbnail.png"))).toEqual(await readFile(thumbnail));
  });

  test("requires two independently valid static preview files", async () => {
    const item = await fixture(); const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview });
    await writeFile(join(result.directory, "QuickLook", "Thumbnail.png"), encode({ width: 2, height: 1, channels: 4, data: new Uint8Array(8).fill(127) }));
    await expect(validateTemplatePackage(result.directory, { requirePreview: true })).resolves.toBeUndefined();
    await rm(join(result.directory, "QuickLook", "Thumbnail.png"));
    await expect(validateTemplatePackage(result.directory, { requirePreview: true })).rejects.toThrow("Thumbnail.png");
    await writeFile(join(result.directory, "QuickLook", "Icon.png"), "nope");
    await expect(validateTemplatePackage(result.directory)).rejects.toThrow("QuickLook/Icon.png");
  });

  test("rejects macOS Finder metadata from templates", async () => {
    const item = await fixture(); const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview });
    await writeFile(join(result.directory, "Icon\r"), "");
    await expect(validateTemplatePackage(result.directory)).rejects.toThrow("Icon");
  });
});

test("default thumbnails preserve aspect ratio within 512 pixels", () => {
  const source = encode({ width: 1024, height: 256, channels: 4, data: new Uint8Array(1024 * 256 * 4).fill(200) });
  const thumbnail = decode(thumbnailFromPng(source));
  expect([thumbnail.width, thumbnail.height]).toEqual([512, 128]);
});
