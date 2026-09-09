import { createGlobalThemeContract } from "@vanilla-extract/css";

export const theme = createGlobalThemeContract({
  surface: "slop-surface",
  panel: "slop-panel",
  control: "slop-control",
  ink: "slop-ink",
  muted: "slop-muted",
  accent: "slop-accent",
  rule: "slop-rule",
  font: "slop-font",
});
