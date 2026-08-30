import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installTemplate } from "../src/install.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(): Promise<{ project: string; templates: string; screenshot: string }> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-install-")); roots.push(root);
  const project = join(root, "source"); const templates = join(root, "templates"); const screenshot = join(root, "cover.png");
  await mkdir(join(project, "stores"), { recursive: true });
  await writeFile(join(project, "manifest.json"), JSON.stringify({
    slug: "tiny-counter", title: "Tiny Counter", description: "Counts a very small thing.",
    author: { name: "Test" }, categories: ["Widgets"], stores: { state: { kind: "json" } }, window: { width: 320, height: 240, shape: { kind: "roundedRect", radius: 22 } },
  }));
  await writeFile(join(project, "index.html"), "<main>Hello</main>");
  await writeFile(join(project, "stores/state.json"), "{}\n");
  await writeFile(screenshot, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  return { project, templates, screenshot };
}

describe("installTemplate", () => {
  test("builds an authoring project into the local wrapper format", async () => {
    const item = await fixture();
    const result = await installTemplate(item.project, { templatesRoot: item.templates, screenshot: item.screenshot, now: () => new Date("2026-08-29T18:00:00Z") });
    expect(result.directory).toBe(join(item.templates, "tiny-counter"));
    expect(JSON.parse(await readFile(join(result.directory, "install.json"), "utf8"))).toEqual({ artifactSha256: expect.any(String), installedAt: "2026-08-29T18:00:00.000Z" });
    expect(await readFile(join(result.directory, "template.slop", "app.html"), "utf8")).toContain("Hello");
    expect(await readFile(join(result.directory, "template.slop", "QuickLook", "Preview.png"))).toEqual(await readFile(item.screenshot));
    expect(await readFile(join(result.directory, "template.slop", "QuickLook", "Thumbnail.png"))).toEqual(await readFile(item.screenshot));
    await expect(readFile(join(result.directory, "cover.png"))).rejects.toThrow();
  });

  test("asks before replacing and preserves the old install when declined", async () => {
    const item = await fixture();
    await installTemplate(item.project, { templatesRoot: item.templates, screenshot: item.screenshot });
    let asked = false;
    await expect(installTemplate(item.project, { templatesRoot: item.templates, screenshot: item.screenshot, confirmOverwrite: async () => { asked = true; return false; } })).rejects.toThrow("cancelled");
    expect(asked).toBeTrue();
    expect(JSON.parse(await readFile(join(item.templates, "tiny-counter", "install.json"), "utf8")).artifactSha256).toHaveLength(64);
  });

  test("force replaces an existing install", async () => {
    const item = await fixture();
    await installTemplate(item.project, { templatesRoot: item.templates, screenshot: item.screenshot });
    const result = await installTemplate(item.project, { templatesRoot: item.templates, screenshot: item.screenshot, force: true });
    expect(result.replaced).toBeTrue();
  });

  test("captures a preview when no screenshot is supplied", async () => {
    const item = await fixture();
    let captured = false;
    await installTemplate(item.project, { templatesRoot: item.templates, captureScreenshot: async (_package, output) => { captured = true; await writeFile(output, await readFile(item.screenshot)); } });
    expect(captured).toBeTrue();
  });
});
