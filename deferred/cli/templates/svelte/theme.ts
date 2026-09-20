import { defineTheme } from "@hitslop/runtime/theme";

export default defineTheme({
  surface: "#f7f4eb",
  panel: "#e3e9df",
  control: "#ede9df",
  ink: "#182126",
  muted: "#687276",
  accent: "#db6648",
  rule: "color-mix(in srgb, var(--slop-ink) 15%, transparent)",
  font: '"Avenir Next", Avenir, sans-serif',
});
