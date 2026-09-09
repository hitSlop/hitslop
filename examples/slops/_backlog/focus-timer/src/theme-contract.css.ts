import { createGlobalThemeContract } from "@vanilla-extract/css";

export const theme = createGlobalThemeContract({
  surface: "slop-surface",
  surfaceRest: "slop-surface-rest",
  surfaceLight: "slop-surface-light",
  panel: "slop-panel",
  ink: "slop-ink",
  accent: "slop-accent",
  restAccent: "slop-rest-accent",
  action: "slop-action",
  focus: "slop-focus",
  font: "slop-font",
});
