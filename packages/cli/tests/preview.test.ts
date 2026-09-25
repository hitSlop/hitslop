// Guards authored titles escaping the preview title/iframe attribute without injecting elements.
import { expect, test } from "bun:test";
import { previewFrame } from "../src/authoring";

test("preview titles cannot inject executable markup or iframe attributes", async () => {
  const title = '</title><script>alert(1)</script><title>" onload="alert(2)';
  const frame = previewFrame({ title, presentation: { width: 480, height: 620 } });
  let scripts = 0;
  let iframeTitle: string | null = null;
  let onload: string | null = null;
  const response = new HTMLRewriter()
    .on("script", {
      element() {
        scripts++;
      },
    })
    .on("iframe", {
      element(element) {
        iframeTitle = element.getAttribute("title");
        onload = element.getAttribute("onload");
      },
    })
    .transform(new Response(frame));
  await response.text();
  expect(scripts).toBe(0);
  expect(onload).toBeNull();
  expect(iframeTitle).not.toBeNull();
});
