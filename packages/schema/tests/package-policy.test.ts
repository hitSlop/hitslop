import { expect, test } from "bun:test";
import { safeArchivePath, validateTemplatePath } from "../src/package-path.ts";
import { checkPngDimensions } from "../src/png.ts";
import paths from "../../../apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/package-paths.json";

test("package paths match the shared native acceptance corpus", () => {
  for (const item of paths) {
    expect(safeArchivePath(item.path)).toBe(item.safe);
    if (item.template) expect(() => validateTemplatePath(item.path)).not.toThrow();
    else expect(() => validateTemplatePath(item.path)).toThrow();
  }
});

test("template path policy rejects nested source, traversal, and mutable stores", () => {
  for (const path of ["assets/src/file.js", "assets/package.json", "assets/style.css", "assets/BUILD/x", "stores/data.json", "Icon\r", "../app.html", "assets//x", "assets/./x", "/app.html", "assets/../x", "assets/\\x"]) expect(() => validateTemplatePath(path)).toThrow();
  for (const path of ["manifest.json", "app.html", "assets/", "assets/font.woff2", ".agents/skills/hitslop-document/SKILL.md", "QuickLook/Icon.png"]) expect(() => validateTemplatePath(path)).not.toThrow();
  expect(safeArchivePath("a".repeat(241))).toBe(false);
});

test("PNG header guard rejects allocation bombs and wrong icon dimensions before decoding", () => {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13); view.setUint32(12, 0x49484452);
  view.setUint32(16, 0xffffffff); view.setUint32(20, 0xffffffff);
  expect(() => checkPngDimensions(bytes, "Preview")).toThrow("dimension limit");
  view.setUint32(16, 5000); view.setUint32(20, 5000);
  expect(() => checkPngDimensions(bytes, "Preview")).toThrow("dimension limit");
  view.setUint32(16, 512); view.setUint32(20, 512);
  expect(checkPngDimensions(bytes, "Icon", { width: 512, height: 512 })).toEqual({ width: 512, height: 512 });
  expect(() => checkPngDimensions(bytes, "Skin", { width: 300, height: 200 })).toThrow("exactly 300x200");
  expect(() => checkPngDimensions(new Uint8Array(), "Preview")).toThrow("valid PNG");
});
