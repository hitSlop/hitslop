import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalFontFace("Training Condensed", {
  src: 'url("../assets/fonts/BarlowCondensed-SemiBold.ttf") format("truetype")',
  fontWeight: 600,
  fontDisplay: "swap",
});
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", {
  margin: 0,
  width: "100%",
  minHeight: "100%",
  fontFamily: t.font,
  background: t.surface,
  color: t.ink,
  colorScheme: "dark",
  fontSynthesis: "none",
});
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button", {
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled", { opacity: 0.45, cursor: "default" });
globalStyle(":focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 3,
});
export const board = style({
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  containerType: "inline-size",
});
export const header = style({
  padding: "18px 20px 12px",
  borderBottom: `1px solid ${t.border}`,
});
export const top = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
});
export const eyebrow = style({
  fontSize: 10,
  letterSpacing: ".13em",
  fontWeight: 700,
  textTransform: "uppercase",
  color: t.muted,
});
export const title = style({
  fontFamily: t.headingFont,
  fontWeight: 600,
  fontSize: 30,
  letterSpacing: ".01em",
  margin: "3px 0 10px",
  lineHeight: 1.05,
});
export const button = style({
  minHeight: 36,
  padding: "7px 11px",
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  background: t.card,
  color: t.ink,
  fontSize: 11,
  fontWeight: 650,
  boxShadow: "inset 0 1px 0 #ffffff08, 0 2px 0 #0005",
  ":active": { transform: "translateY(1px)" },
});
export const progress = style({
  height: 4,
  borderRadius: 2,
  overflow: "hidden",
  background: "#0007",
});
export const fill = style({
  height: "100%",
  background: t.accent,
  transition: "width 180ms ease",
});
export const content = style({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "16px 20px",
  scrollbarWidth: "thin",
});
export const active = style({ position: "relative", padding: "0 0 20px" });
export const kicker = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: t.accent,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".07em",
  textTransform: "uppercase",
});
export const exerciseName = style({
  fontFamily: t.headingFont,
  fontWeight: 600,
  fontSize: 34,
  lineHeight: 1.02,
  margin: "8px 0 14px",
  overflowWrap: "anywhere",
  letterSpacing: ".005em",
});
export const readouts = style({
  display: "grid",
  gridTemplateColumns: "1fr 1.5fr",
  gap: 1,
  border: `1px solid ${t.border}`,
  borderRadius: 10,
  overflow: "hidden",
  background: t.border,
  marginBottom: 14,
});
export const readout = style({
  padding: "10px 12px",
  background: "#0b0d0f",
  boxShadow: "inset 0 2px 5px #0007",
  minWidth: 0,
});
export const number = style({
  display: "block",
  fontFamily: t.headingFont,
  fontWeight: 600,
  fontSize: 30,
  lineHeight: 1.05,
  overflowWrap: "anywhere",
});
export const small = style({
  display: "block",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: ".12em",
  color: t.muted,
  marginTop: 4,
});
export const ticks = style({
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 12,
});
export const tick = style({
  width: 46,
  height: 44,
  display: "grid",
  placeItems: "center",
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  background: "linear-gradient(#303639, #222729)",
  color: t.ink,
  fontFamily: t.mono,
  fontSize: 13,
  fontWeight: 650,
  boxShadow: "inset 0 1px 0 #ffffff15, 0 3px 0 #0008",
  transition: "transform 100ms ease, background 100ms ease",
  selectors: {
    '&[data-state="checked"]': {
      background: t.accent,
      borderColor: t.accent,
      color: t.onAccent,
      boxShadow: "inset 0 2px 3px #17200635",
      transform: "translateY(2px)",
    },
  },
  ":active": { transform: "translateY(2px)" },
});
export const primary = style([
  button,
  {
    width: "100%",
    minHeight: 46,
    background: t.accent,
    color: t.onAccent,
    borderColor: t.accent,
    fontSize: 13,
    boxShadow: "inset 0 1px 0 #ffffff70, 0 3px 0 #647b2e",
  },
]);
export const sectionHead = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 0 8px",
  borderTop: `1px solid ${t.border}`,
});
export const list = style({ listStyle: "none", margin: 0, padding: 0 });
export const row = style({
  display: "flex",
  gap: 10,
  alignItems: "center",
  borderBottom: `1px solid ${t.border}`,
  minWidth: 0,
});
export const queue = style({
  width: "100%",
  textAlign: "left",
  display: "grid",
  gridTemplateColumns: "24px minmax(0,1fr) auto",
  gap: 10,
  alignItems: "center",
  padding: "11px 0",
  border: 0,
  background: "transparent",
  fontSize: 12,
  selectors: { '&[aria-current="true"]': { color: t.accent } },
});
export const queueName = style({
  display: "block",
  fontWeight: 600,
  overflowWrap: "anywhere",
});
export const meta = style({
  fontSize: 10,
  color: t.muted,
  display: "block",
  marginTop: 3,
});
export const index = style({
  fontFamily: t.headingFont,
  fontSize: 20,
  color: t.dim,
});
export const fraction = style({
  fontFamily: t.mono,
  fontSize: 10,
  whiteSpace: "nowrap",
});
export const dock = style({
  flexShrink: 0,
  padding: "12px 20px 15px",
  borderTop: `1px solid ${t.border}`,
  background: "#0a0c0d",
  boxShadow: "0 -6px 20px #0003",
});
export const dockTop = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 8,
});
export const restTime = style({
  fontFamily: t.headingFont,
  fontWeight: 600,
  fontSize: 42,
  lineHeight: 1,
  color: t.accent,
  fontVariantNumeric: "tabular-nums",
});
export const controls = style({
  display: "flex",
  gap: 6,
  alignItems: "center",
});
export const status = style({
  fontSize: 11,
  color: t.muted,
  margin: "7px 0 0",
});
export const empty = style({ padding: "22px 0", textAlign: "left" });
export const completeMark = style({
  width: 52,
  height: 52,
  display: "grid",
  placeItems: "center",
  background: t.accent,
  color: t.onAccent,
  borderRadius: "50%",
  fontSize: 28,
  marginBottom: 14,
});
export const overlay = style({
  position: "fixed",
  inset: 0,
  background: "#000a",
  zIndex: 100,
});
export const dialog = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(400px, calc(100vw - 28px))",
  maxHeight: "calc(100dvh - 28px)",
  overflowY: "auto",
  padding: 22,
  border: `1px solid ${t.border}`,
  borderRadius: 16,
  background: t.plate,
  color: t.ink,
  zIndex: 101,
  boxShadow: "0 20px 60px #0008",
});
export const dialogTitle = style({
  fontFamily: t.headingFont,
  fontWeight: 600,
  fontSize: 30,
  margin: "0 0 6px",
});
export const description = style({
  color: t.muted,
  fontSize: 12,
  lineHeight: 1.5,
  margin: "0 0 18px",
});
export const fields = style({ display: "grid", gap: 14 });
export const field = style({
  display: "grid",
  gap: 6,
  fontSize: 12,
  color: t.muted,
});
export const input = style({
  width: "100%",
  minWidth: 0,
  padding: 10,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  background: t.surface,
  color: t.ink,
  fontSize: 14,
});
export const pair = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
});
export const actions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 20,
});
export const danger = style([button, { color: t.danger, marginRight: "auto" }]);
export const selectContent = style({
  zIndex: 120,
  padding: 5,
  minWidth: 100,
  background: t.card,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  boxShadow: "0 10px 30px #0008",
});
export const option = style({
  padding: "11px 12px",
  fontSize: 12,
  borderRadius: 5,
  selectors: { "&[data-highlighted]": { background: t.border } },
});
export const tools = style({ display: "flex", gap: 4, flexShrink: 0 });
export const error = style({ fontSize: 12, color: t.danger, padding: 12 });
export const exportBoard = style({
  padding: 22,
  background: t.surface,
  color: t.ink,
});
export const exportLift = style({
  padding: "16px 0",
  borderBottom: `1px solid ${t.border}`,
});
export const exportTitle = style({
  fontFamily: t.headingFont,
  fontWeight: 600,
  fontSize: 25,
  margin: "0 0 6px",
  overflowWrap: "anywhere",
});
export const icon = style({ display: "block", width: "100%", height: "100%" });
globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', {
  display: "none !important",
});
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transition: "none !important",
      animation: "none !important",
    },
  },
});
