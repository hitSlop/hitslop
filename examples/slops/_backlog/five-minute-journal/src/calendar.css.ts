import { style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
const focus = { outline: `2px solid ${t.eveningAccent}`, outlineOffset: 2 };
export const trigger = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 44,
  maxWidth: "100%",
  textAlign: "left",
  border: 0,
  padding: 0,
  background: "transparent",
  color: t.muted,
  fontSize: 14,
  lineHeight: 1.5,
  ":hover": { color: t.ink },
  ":focus-visible": focus,
});
export const popover = style({
  zIndex: 30,
  width: "min(332px, calc(100vw - 16px))",
  maxHeight: "var(--bits-popover-content-available-height)",
  overflowY: "auto",
  borderRadius: 12,
  padding: 12,
  color: t.ink,
  background: t.paper,
  boxShadow: "0 12px 36px rgba(51,38,22,0.24)",
  ":focus-visible": focus,
});
export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
});
export const heading = style({
  fontFamily: t.headingFont,
  fontWeight: 500,
  fontSize: 17,
});
export const nav = style({
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  ":hover": { background: t.morning },
  ":focus-visible": focus,
});
export const grid = style({
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
});
export const weekday = style({
  height: 32,
  color: t.muted,
  fontWeight: 400,
  fontSize: 12,
});
export const cell = style({ padding: 0, textAlign: "center" });
export const day = style({
  width: "100%",
  height: 44,
  padding: 0,
  border: 0,
  borderRadius: 5,
  background: "transparent",
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
  ":hover": { background: t.morning },
  ":focus-visible": { ...focus, outlineOffset: -2 },
  selectors: {
    "&[data-outside-month]": { color: t.muted },
    "&[data-today]": { textDecoration: "underline", textUnderlineOffset: 5 },
    "&[data-selected]": {
      background: t.morningInk,
      color: t.paper,
      fontWeight: 600,
    },
    "&[data-disabled]": { opacity: 0.45, cursor: "default" },
  },
});
export const todayButton = style({
  width: "100%",
  marginTop: 8,
  minHeight: 44,
  border: 0,
  borderTop: `1px solid ${t.rule}`,
  background: "transparent",
  color: t.morningInk,
  fontSize: 14,
  ":hover": { background: t.morning },
  ":focus-visible": focus,
});
