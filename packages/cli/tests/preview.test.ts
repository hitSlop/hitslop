import { expect, test } from "bun:test";
import { previewFrame } from "../src/authoring";

test("preview frames follow standard presentation geometry and escape the title", () => {
  const frame = previewFrame({ title: 'A <note> & "title"', presentation: { width: 480, height: 620 } });
  expect(frame).toContain("width:480px;height:620px");
  expect(frame).toContain("resize:both;min-width:240px;min-height:180px");
  expect(frame).toContain("background:Canvas");
  expect(frame).toContain('src="/app.html"');
  expect(frame).toContain("A &#60;note&#62; &#38; &#34;title&#34;");
  expect(frame).not.toContain("<note>");
});

test("preview frames respect fixed, transparent, ellipse and capsule presentations", () => {
  const ellipse = previewFrame({ title: "Circle", presentation: {
    width: 320, height: 320, shape: "ellipse", background: "transparent", resizable: false,
  } });
  expect(ellipse).toContain("border-radius:50%");
  expect(ellipse).not.toContain("background:Canvas");
  expect(ellipse).not.toContain("resize:both");
  const capsule = previewFrame({ title: "Capsule", presentation: { width: 480, height: 240, shape: "capsule" } });
  expect(capsule).toContain("border-radius:9999px");
});

test("skin preview frames use the PNG as both backing and mask and cannot resize", () => {
  const frame = previewFrame({ title: "Washer", presentation: { width: 320, height: 320, skin: "assets/washer.png" } });
  for (const property of ["background", "-webkit-mask", "mask"])
    expect(frame).toContain(`${property}:url("/assets/washer.png") 0 0/100% 100% no-repeat`);
  expect(frame).not.toContain("resize:both");
  expect(frame).not.toContain("border-radius:");
});
