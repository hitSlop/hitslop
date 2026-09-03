import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { documentSkillContent, documentSkillPath, manifestSchemaURL } from "@hitslop/schema";
import { exportDocument, screenshotDocument } from "../src/render.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(): Promise<string> {
  const temporary = await mkdtemp(join(tmpdir(), "hitslop-render-")); roots.push(temporary);
  const root = join(temporary, "render-test.slop");
  await mkdir(join(root, documentSkillPath, ".."), { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify({
    $schema: manifestSchemaURL,
    slug: "render-test",
    title: "Render Test",
    description: "Tests native rendering command forwarding.",
    categories: ["utilities"],
    presentation: { width: 320, height: 240 },
  }));
  await writeFile(join(root, "app.html"), "<main>Render</main>");
  await writeFile(join(root, documentSkillPath), documentSkillContent);
  return root;
}

describe("native rendering wrappers", () => {
  test("forwards export after validating the document", async () => {
    const root = await fixture(); let received: string[] = [];
    await exportDocument(root, { format: "pdf", output: "out.pdf" }, async (arguments_) => { received = arguments_; });
    expect(received).toEqual(["export", root, "--format", "pdf", "--output", "out.pdf"]);
  });

  test("forwards screenshot target and optional behavior", async () => {
    const root = await fixture(); let received: string[] = [];
    await screenshotDocument(root, { target: "icon", output: "Icon.png", ifPresent: true }, async (arguments_) => { received = arguments_; });
    expect(received).toEqual(["screenshot", root, "--target", "icon", "--output", "Icon.png", "--if-present"]);
  });
});
