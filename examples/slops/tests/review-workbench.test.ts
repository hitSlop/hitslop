import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadReview, reviewFingerprint, reviewHTML } from "../review-workbench";

async function fixture(run: (path: string) => Promise<void>) {
  const path = await mkdtemp(join(tmpdir(), "hitslop-review-"));
  try {
    await writeFile(
      join(path, "schema.ts"),
      'export default { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: true };',
    );
    await run(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

test("review fixtures are optional, validated, and uniquely named", async () =>
  fixture(async (path) => {
    expect((await loadReview(path)).cases).toEqual([]);
    const write = (cases: unknown) =>
      writeFile(join(path, "review.json"), JSON.stringify({ cases }));
    await write([
      { id: "empty", label: "Empty", data: { text: "", extra: 1 } },
    ]);
    expect((await loadReview(path)).cases[0]?.data).toEqual({
      text: "",
      extra: 1,
    });
    await write([{ id: "bad", label: "Bad", data: { text: 7 } }]);
    await expect(loadReview(path)).rejects.toThrow("Review case bad");
    await write([
      { id: "same", label: "One", data: { text: "a" } },
      { id: "same", label: "Two", data: { text: "b" } },
    ]);
    await expect(loadReview(path)).rejects.toThrow("unique");
  }));

test("fingerprint follows source and fixture changes, excludes review artifacts", async () =>
  fixture(async (path) => {
    const before = await reviewFingerprint(path);
    await mkdir(join(path, ".impeccable"));
    await writeFile(join(path, ".impeccable", "review.png"), "capture");
    expect(await reviewFingerprint(path)).toBe(before);
    await writeFile(join(path, "review.json"), '{"cases":[]}');
    expect(await reviewFingerprint(path)).not.toBe(before);
    const next = await reviewFingerprint(path);
    await writeFile(join(path, "theme.ts"), "export default {};");
    expect(await reviewFingerprint(path)).not.toBe(next);
  }));

test("workbench safely embeds labels and uses fixed review panes", () => {
  const html = reviewHTML(
    {
      slug: "test",
      title: "</script><script>alert(1)</script>",
      width: 720,
      height: 680,
    },
    {
      fingerprint: "abc",
      cases: [
        { id: "test", label: "</script><script>alert(2)</script>", data: {} },
      ],
    },
  );
  expect(html).not.toContain("<script>alert(");
  expect(html).toContain("\\u003c/script>");
  expect(html).toContain("width: 360");
  expect(html).toContain("width: 512");
  expect(html).toContain("height: 512");
  expect(html).toContain("event.source !== state.frame.contentWindow");
});
