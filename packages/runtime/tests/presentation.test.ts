import { expect, test } from "bun:test";
import { presentationStage, presentationStageCSS, hostScrollbarCSS } from "../src/presentation";
test("standard presentation introduces no layout rules", () => {
  const stage = presentationStage({ width: 320, height: 240 });
  expect(stage.mode).toBe("standard");
  expect(presentationStageCSS(stage)).toBe(hostScrollbarCSS);
});
test("transparent layout is capture scoped and does not hide overflow", () => {
  const css = presentationStageCSS(
    presentationStage({ width: 720, height: 560, background: "transparent" }),
  );
  expect(css).toContain(":not([data-slop-capture])");
  expect(css).toContain("[data-hitslop-root]");
  expect(css).not.toContain("overflow:hidden");
  expect(css.slice(hostScrollbarCSS.length)).not.toContain("!important");
});
test("skin is fixed, clipped and does not expose its path", () => {
  const stage = presentationStage({ width: 720, height: 560, skin: "assets/private.png" });
  expect(stage.resizable).toBe(false);
  expect(stage.mode).toBe("skin");
  expect(JSON.stringify(stage)).not.toContain("private.png");
  expect(presentationStageCSS(stage)).toContain("overflow:hidden");
});
