import { style } from "@vanilla-extract/css";

const mono = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';

export const terminal = style({
  width: "100%",
  minWidth: 0,
  margin: 0,
  overflow: "hidden",
  borderRadius: 16,
  color: "oklch(94% .012 255)",
  background: "oklch(21% .025 255)",
  boxShadow: "0 24px 56px oklch(18% .04 260 / .18)",
});

export const bar = style({
  minHeight: 52,
  padding: "12px 20px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px 16px",
  background: "oklch(26% .025 255)",
});
export const lights = style({ display: "flex", gap: 6 });
const light = style({ width: 10, height: 10, borderRadius: "50%" });
export const red = style([light, { background: "oklch(71% .17 32)" }]);
export const yellow = style([light, { background: "oklch(85% .16 91)" }]);
export const green = style([light, { background: "oklch(72% .13 145)" }]);
export const windowTitle = style({ fontSize: 13, fontWeight: 650 });
export const example = style({ marginLeft: "auto", fontSize: 12, color: "oklch(77% .02 255)" });

export const transcript = style({
  padding: "clamp(20px, 3vw, 32px)",
  display: "grid",
  gap: 24,
  fontFamily: mono,
  fontSize: 14,
  lineHeight: 1.65,
});
export const step = style({ minWidth: 0, display: "grid", gap: 4 });
export const note = style({ margin: "0 0 4px", color: "oklch(76% .025 255)", fontSize: 12, overflowWrap: "anywhere" });
export const commandLine = style({ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr)", gap: 10 });
export const prompt = style({ color: "oklch(81% .13 155)", userSelect: "none" });
export const command = style({ fontFamily: "inherit", fontSize: "inherit", overflowWrap: "anywhere" });

export const result = style({
  padding: "20px clamp(20px, 3vw, 32px)",
  display: "flex",
  alignItems: "center",
  gap: 14,
  background: "oklch(27% .04 155)",
});
export const fileIcon = style({ width: 28, height: 28, flexShrink: 0, stroke: "oklch(81% .13 155)", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" });
export const resultCopy = style({ minWidth: 0, display: "grid", gap: 4 });
export const output = style({ fontFamily: mono, fontSize: 14, overflowWrap: "anywhere" });
export const resultHint = style({ fontSize: 12, color: "oklch(81% .025 155)" });
