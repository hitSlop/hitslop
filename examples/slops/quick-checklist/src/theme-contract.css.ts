import { createGlobalThemeContract } from "@vanilla-extract/css";
export const theme = createGlobalThemeContract({
  surface: "slop-surface", paper: "slop-paper", ink: "slop-ink", muted: "slop-muted",
  accent: "slop-accent", onAccent: "slop-on-accent", rule: "slop-rule", control: "slop-control", font: "slop-font",
});
