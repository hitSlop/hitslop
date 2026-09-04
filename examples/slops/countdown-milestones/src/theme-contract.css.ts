import { createGlobalThemeContract } from "@vanilla-extract/css";

export const theme = createGlobalThemeContract({
  paper: "slop-paper",
  ink: "slop-ink",
  muted: "slop-muted",
  coral: "slop-coral",
  yellow: "slop-yellow",
  blue: "slop-blue",
  green: "slop-green",
  rule: "slop-rule",
  focus: "slop-focus",
  displayFont: "slop-display-font",
  bodyFont: "slop-body-font",
});
