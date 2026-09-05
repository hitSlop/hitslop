import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { manifestSchemaURL } from "@hitslop/schema";
import { decode, encode } from "fast-png";
import { installTemplate, makePackageWritable, validateTemplatePackage } from "../src/install.ts";
import { iconFromPng } from "../src/static-preview.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => {
    await makePackageWritable(root).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }));
});

async function fixture(): Promise<{ project: string; templates: string; preview: string }> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-install-")); roots.push(root);
  const project = join(root, "source"); const templates = join(root, "templates"); const preview = join(root, "preview.png");
  await mkdir(project, { recursive: true });
  await writeFile(join(project, "manifest.json"), JSON.stringify({ $schema: manifestSchemaURL, author: { name: "Fixture Author", url: "https://example.com" }, slug: "tiny-counter", title: "Tiny Counter", description: "Counts a very small thing.", categories: ["utilities"], presentation: { width: 320, height: 240 } }));
  await writeFile(join(project, "index.html"), "<main>Hello</main>");
  await writeFile(preview, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  return { project, templates, preview };
}

const skipNativeIcon = { captureIcon: async () => false };

describe("installTemplate", () => {
  test("installs one store-free slop with static Quick Look images", async () => {
    const item = await fixture(); const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, ...skipNativeIcon });
    expect(result.directory).toBe(join(item.templates, "tiny-counter.slop"));
    expect(await readFile(join(result.directory, "app.html"), "utf8")).toContain("Hello");
    expect(await readFile(join(result.directory, "QuickLook", "Preview.png"))).toEqual(await readFile(item.preview));
    expect([decode(await readFile(join(result.directory, "QuickLook", "Icon.png"))).width, decode(await readFile(join(result.directory, "QuickLook", "Icon.png"))).height]).toEqual([512, 512]);
    await expect(readFile(join(result.directory, "install.json"))).rejects.toThrow();
    await expect(readFile(join(result.directory, "AGENTS.md"))).rejects.toThrow();
    expect((await lstat(result.directory)).mode & 0o222).toBe(0);
    expect((await lstat(join(result.directory, "app.html"))).mode & 0o222).toBe(0);
    await expect(writeFile(join(result.directory, "app.html"), "nope")).rejects.toThrow();
  });

  test("asks before replacing and preserves an install when declined", async () => {
    const item = await fixture(); await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, ...skipNativeIcon });
    let asked = false;
    await expect(installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, ...skipNativeIcon, confirmOverwrite: async () => { asked = true; return false; } })).rejects.toThrow("cancelled");
    expect(asked).toBeTrue();
    expect(await readFile(join(item.templates, "tiny-counter.slop", "app.html"), "utf8")).toContain("Hello");
  });

  test("force replaces an existing install", async () => {
    const item = await fixture(); await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, ...skipNativeIcon });
    const replaced = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, ...skipNativeIcon, force: true });
    expect(replaced.replaced).toBeTrue();
    expect((await lstat(replaced.directory)).mode & 0o222).toBe(0);
  });

  test("captures a preview when no override is supplied", async () => {
    const item = await fixture(); let captured = false;
    const result = await installTemplate(item.project, { templatesRoot: item.templates, ...skipNativeIcon, capturePreview: async (packageDirectory: string, output: string) => {
      captured = true;
      await mkdir(join(packageDirectory, "stores"), { recursive: true });
      await writeFile(join(packageDirectory, "stores", "data.json"), "{}\n");
      await writeFile(output, await readFile(item.preview));
    } });
    expect(captured).toBeTrue();
    await expect(readFile(join(result.directory, "stores", "data.json"))).rejects.toThrow();
  });

  test("uses an author-supplied static icon", async () => {
    const item = await fixture();
    const icon = join(item.project, "icon.png");
    await writeFile(icon, encode({ width: 512, height: 512, channels: 4, data: new Uint8Array(512 * 512 * 4).fill(127) }));
    const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, icon });
    expect(await readFile(join(result.directory, "QuickLook", "Icon.png"))).toEqual(await readFile(icon));
  });

  test("asks for an authored icon even when app.html does not mention one", async () => {
    const item = await fixture();
    let asked = false;
    await installTemplate(item.project, {
      templatesRoot: item.templates,
      preview: item.preview,
      captureIcon: async () => {
        asked = true;
        return false;
      },
    });
    expect(asked).toBeTrue();
  });

  test("uses an authored icon and removes stores initialized during its capture", async () => {
    const item = await fixture();
    const icon = Buffer.from(encode({ width: 512, height: 512, channels: 4, data: new Uint8Array(512 * 512 * 4).fill(91) }));
    const result = await installTemplate(item.project, {
      templatesRoot: item.templates,
      preview: item.preview,
      captureIcon: async (packageDirectory, output) => {
        await mkdir(join(packageDirectory, "stores"), { recursive: true });
        await writeFile(join(packageDirectory, "stores", "data.json"), "{}\n");
        await writeFile(output, icon);
        return true;
      },
    });
    expect(await readFile(join(result.directory, "QuickLook", "Icon.png"))).toEqual(icon);
    await expect(readFile(join(result.directory, "stores", "data.json"))).rejects.toThrow();
  });

  test("requires two independently valid static preview files", async () => {
    const item = await fixture(); const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, ...skipNativeIcon });
    await makePackageWritable(result.directory);
    await writeFile(join(result.directory, "QuickLook", "Icon.png"), encode({ width: 512, height: 512, channels: 4, data: new Uint8Array(512 * 512 * 4).fill(127) }));
    await expect(validateTemplatePackage(result.directory, { requirePreview: true })).resolves.toBeUndefined();
    await rm(join(result.directory, "QuickLook", "Icon.png"));
    await expect(validateTemplatePackage(result.directory, { requirePreview: true })).rejects.toThrow("Icon.png");
    await writeFile(join(result.directory, "QuickLook", "Icon.png"), "nope");
    await expect(validateTemplatePackage(result.directory)).rejects.toThrow("valid PNG");
  });

  test("rejects macOS Finder metadata from templates", async () => {
    const item = await fixture(); const result = await installTemplate(item.project, { templatesRoot: item.templates, preview: item.preview, ...skipNativeIcon });
    await makePackageWritable(result.directory);
    await writeFile(join(result.directory, "Icon\r"), "");
    await expect(validateTemplatePackage(result.directory)).rejects.toThrow("Icon");
  });
});

test("default icons fit previews inside a 512 pixel square", () => {
  const source = encode({ width: 1024, height: 256, channels: 4, data: new Uint8Array(1024 * 256 * 4).fill(200) });
  const icon = decode(iconFromPng(source));
  expect([icon.width, icon.height]).toEqual([512, 512]);
});

test("fallback icon downsampling averages fine detail and respects transparent edges", () => {
  const checker = new Uint8Array(1024 * 1024 * 4);
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    const offset = (y * 1024 + x) * 4;
    const value = (x + y) % 2 ? 255 : 0;
    checker.set([value, value, value, 255], offset);
  }
  const icon = decode(iconFromPng(encode({ width: 1024, height: 1024, channels: 4, data: checker })));
  expect(icon.data[0]).toBe(128);
  const edge = encode({ width: 2, height: 1, channels: 4, data: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]) });
  const blended = decode(iconFromPng(edge, 1));
  expect(Array.from(blended.data)).toEqual([255, 0, 0, 128]);
});
