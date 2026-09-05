import { expect, test } from "bun:test";
import { hitSlopBuildPlugin, inlineScript, inlineStyle } from "../src/vite-build-plugin.ts";

test("build plugin inlines JavaScript safely", () => {
  const html = '<script type="module" crossorigin src="./index.abcd.js"></script>';
  expect(inlineScript(html, "index.abcd.js", 'console.log("</script>")')).toBe('<script type="module" crossorigin>console.log("\\x3C/script>")</script>');
});

test("build plugin inlines generated structural CSS", () => {
  const html = '<link rel="stylesheet" crossorigin href="./index.abcd.css"><main></main>';
  expect(inlineStyle(html, "index.abcd.css", "body { color: red; }")).toContain('<style>body { color: red; }</style>');
});

test("preserves unlinked chunks and escapes CSS raw-text terminators", () => {
  const bundle = {
    "index.html": { type: "asset", fileName: "index.html", source: "<main>Hello</main>" },
    "assets/worker.js": { type: "chunk", fileName: "assets/worker.js", code: "postMessage(1)" },
  };
  const plugin = hitSlopBuildPlugin({ hasTheme: false });
  (plugin.generateBundle as Function).call({}, {}, bundle);
  expect(bundle["assets/worker.js"]).toBeDefined();
  expect(inlineStyle('<link href="style.css">', "style.css", 'p:before{content:"</style>"}')).toContain('<\\/style>');
});
