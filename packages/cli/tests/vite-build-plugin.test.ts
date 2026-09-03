import { expect, test } from "bun:test";
import { inlineScript, inlineStyle } from "../src/vite-build-plugin.ts";

test("build plugin inlines JavaScript safely", () => {
  const html = '<script type="module" crossorigin src="./index.abcd.js"></script>';
  expect(inlineScript(html, "index.abcd.js", 'console.log("</script>")')).toBe('<script type="module" crossorigin>console.log("\\x3C/script>")</script>');
});

test("build plugin inlines generated structural CSS", () => {
  const html = '<link rel="stylesheet" crossorigin href="./index.abcd.css"><main></main>';
  expect(inlineStyle(html, "index.abcd.css", "body { color: red; }")).toContain('<style rel="stylesheet" crossorigin>body { color: red; }</style>');
});
