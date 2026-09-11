import { style } from "@vanilla-extract/css";

const hover = "(hover: hover) and (pointer: fine)";
const reducedMotion = "(prefers-reduced-motion: reduce)";

export const grid = style({
  marginTop: 34,
  display: "grid",
  // Keep empty tracks so filtered results retain the same compact size.
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
  gap: "32px 20px",
});

export const card = style({
  minWidth: 0,
  display: "grid",
  gridTemplateRows: "auto 1fr",
});

export const previewStage = style({
  position: "relative",
  display: "block",
  aspectRatio: "4 / 3",
  overflow: "hidden",
  border: "1px solid color-mix(in oklch, var(--ink), transparent 87%)",
  borderRadius: 14,
  background: "oklch(93% .025 250)",
});

export const previewImage = style({
  position: "absolute",
  inset: 16,
  width: "calc(100% - 32px)",
  height: "calc(100% - 32px)",
  objectFit: "contain",
  filter: "drop-shadow(0 10px 14px oklch(18% .03 65 / .18))",
  transition: "transform 280ms cubic-bezier(.22,1,.36,1)",
  "@media": {
    [hover]: { selectors: { [`${previewStage}:hover &`]: { transform: "translateY(-4px)" } } },
    [reducedMotion]: { transition: "none" },
  },
});

export const previewAction = style({
  position: "absolute",
  right: 13,
  bottom: 13,
  minHeight: 37,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 7,
  color: "oklch(98% .004 250)",
  background: "var(--ink)",
  fontSize: ".64rem",
  fontWeight: 750,
  boxShadow: "0 7px 18px oklch(20% .03 65 / .16)",
  transform: "translateY(4px)",
  opacity: 0,
  transition: "transform 220ms cubic-bezier(.22,1,.36,1), opacity 180ms ease-out",
  selectors: { [`${previewStage}:focus-visible &`]: { transform: "translateY(0)", opacity: 1 } },
  "@media": {
    [hover]: { selectors: { [`${previewStage}:hover &`]: { transform: "translateY(0)", opacity: 1 } } },
    [reducedMotion]: { transition: "none" },
  },
});

export const copy = style({
  minWidth: 0,
  padding: "12px 2px 0",
  display: "flex",
  flexDirection: "column",
  overflowWrap: "anywhere",
});

export const titleRow = style({
  display: "grid",
  gridTemplateColumns: "30px minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
});

export const icon = style({
  width: 30,
  height: 30,
  borderRadius: 7,
  boxShadow: "0 4px 10px oklch(20% .03 65 / .13)",
});

export const identity = style({ display: "grid", gap: 2 });
export const categories = style({
  color: "var(--muted)",
  fontSize: ".56rem",
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "capitalize",
});
export const title = style({ margin: 0, fontSize: "1rem", letterSpacing: "-.025em" });
export const description = style({
  flexGrow: 1,
  minHeight: "3.2em",
  margin: "11px 0 0",
  color: "var(--muted)",
  fontSize: ".76rem",
  lineHeight: 1.58,
});

export const byline = style({
  marginTop: 13,
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "5px 14px",
  color: "var(--muted)",
  fontSize: ".58rem",
});
export const authorLink = style({ color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 2 });
export const footer = style({
  marginTop: 13,
  paddingTop: 12,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0 14px",
  borderTop: "1px solid var(--rule)",
});
export const fileSize = style({ color: "var(--muted)", fontSize: ".59rem" });
export const download = style({ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 7, fontSize: ".66rem", fontWeight: 750 });
export const downloadArrow = style({ fontSize: ".85rem" });
