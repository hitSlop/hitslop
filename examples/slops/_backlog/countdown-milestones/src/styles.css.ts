import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalFontFace("Countdown Fredoka", {
  src: 'url("../assets/fonts/Fredoka.ttf") format("truetype")',
  fontWeight: "300 700",
  fontDisplay: "swap",
});
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", {
  margin: 0,
  width: "100%",
  minHeight: "100%",
  fontFamily: t.bodyFont,
  color: t.ink,
  background: t.paper,
  colorScheme: "light",
  fontSynthesis: "none",
});
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle("button:disabled", { opacity: 0.4, cursor: "default" });
globalStyle(":focus-visible", {
  outline: `2px solid ${t.focus}`,
  outlineOffset: 3,
});
export const shell = style({
  minHeight: "100dvh",
  padding: "14px 20px",
  containerType: "inline-size",
});
export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 12,
});
export const eyebrow = style({
  fontSize: 10,
  fontWeight: 750,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: t.muted,
});
export const button = style({
  border: `1px solid ${t.rule}`,
  borderRadius: 9,
  padding: "8px 11px",
  minHeight: 36,
  background: t.page,
  fontSize: 11,
  fontWeight: 650,
  boxShadow: "0 2px 0 #25212c13",
  ":active": { transform: "translateY(1px)" },
});
export const calendar = style({
  position: "relative",
  padding: "18px 16px 12px",
  borderRadius: "12px 12px 18px 18px",
  background: t.page,
  border: `1px solid ${t.rule}`,
  boxShadow: "0 5px 0 #d7eaff, 0 6px 0 #25212c25, 0 10px 16px #35476912",
  marginBottom: 20,
});
export const binding = style({
  position: "absolute",
  top: -8,
  width: 15,
  height: 28,
  borderRadius: 7,
  background: t.coral,
  border: "1px solid #c94b41",
  boxShadow: "inset 0 2px 0 #ffffff50, 0 2px 0 #25212c22",
});
export const title = style({
  fontFamily: t.displayFont,
  fontSize: 24,
  fontWeight: 500,
  letterSpacing: "-.025em",
  lineHeight: 1.1,
  margin: "2px 0 6px",
  textAlign: "center",
  overflowWrap: "anywhere",
});
export const readout = style({ textAlign: "center", padding: "0 0 8px" });
export const number = style({
  display: "block",
  fontFamily: t.displayFont,
  fontWeight: 550,
  fontSize: "clamp(64px, 23cqw, 88px)",
  lineHeight: 1,
  letterSpacing: "-.03em",
  fontVariantNumeric: "tabular-nums",
  selectors: {
    '&[data-long="true"]': {
      fontSize: "clamp(40px, 16cqw, 68px)",
      overflowWrap: "anywhere",
    },
  },
});
export const unit = style({
  display: "inline-block",
  fontFamily: t.displayFont,
  fontSize: 15,
  fontWeight: 450,
  marginTop: 4,
  padding: "2px 12px",
  background: t.yellow,
  borderRadius: 5,
});
export const detail = style({
  fontSize: 12,
  color: t.muted,
  margin: "6px 0 0",
  fontVariantNumeric: "tabular-nums",
});
export const dateButton = style({
  display: "block",
  width: "100%",
  border: 0,
  borderTop: `1px dashed ${t.rule}`,
  background: "transparent",
  padding: "9px 0 0",
  fontSize: 12,
  fontWeight: 650,
  textAlign: "center",
  lineHeight: 1.5,
});
export const sectionHead = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
});
export const sectionTitle = style({
  margin: 0,
  fontFamily: t.displayFont,
  fontWeight: 500,
  fontSize: 21,
});
export const progressRow = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 8,
  fontSize: 10,
  color: t.muted,
});
export const track = style({
  flex: 1,
  height: 5,
  background: "#25212c18",
  borderRadius: 3,
  overflow: "hidden",
});
export const fill = style({
  height: "100%",
  background: t.coral,
  transition: "width 180ms ease",
});
export const list = style({ listStyle: "none", margin: 0, padding: 0 });
export const row = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "5px 0",
  minHeight: 44,
  borderBottom: `1px solid ${t.rule}`,
  flexWrap: "wrap",
});
export const check = style({
  width: 32,
  height: 32,
  flexShrink: 0,
  border: `1.5px solid ${t.ink}`,
  borderRadius: "50%",
  background: t.page,
  display: "grid",
  placeItems: "center",
  padding: 0,
  fontWeight: 700,
  transition: "transform 140ms ease, background 140ms ease",
  selectors: {
    '&[data-state="checked"]': {
      background: t.coral,
      borderColor: t.coral,
      color: t.ink,
    },
  },
  ":active": { transform: "scale(.9)" },
});
export const milestone = style({
  flex: 1,
  minWidth: 0,
  border: 0,
  background: "transparent",
  padding: "4px 0",
  fontSize: 13,
  lineHeight: 1.5,
  resize: "none",
  overflow: "hidden",
  overflowWrap: "anywhere",
  selectors: {
    '&[data-done="true"]': { textDecoration: "line-through", color: t.muted },
  },
});
export const tools = style({ display: "flex", gap: 5, marginLeft: "auto" });
export const smallButton = style([
  button,
  { minHeight: 30, padding: "4px 8px", fontSize: 12 },
]);
export const add = style({ display: "flex", gap: 8, marginTop: 12 });
export const addInput = style({
  flex: 1,
  minWidth: 0,
  padding: "9px 0",
  border: 0,
  borderBottom: `1px solid ${t.ink}`,
  background: "transparent",
  fontSize: 12,
});
export const addButton = style([
  button,
  { background: t.ink, color: t.page, border: 0 },
]);
export const empty = style({
  fontSize: 13,
  lineHeight: 1.5,
  color: t.muted,
  margin: "14px 0",
});
export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "#25212c70",
});
export const dialog = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 101,
  width: "min(380px, calc(100vw - 28px))",
  maxHeight: "calc(100dvh - 28px)",
  overflowY: "auto",
  padding: 22,
  borderRadius: 18,
  background: t.page,
  border: `1px solid ${t.rule}`,
  boxShadow: "0 16px 40px #25212c30",
});
export const dialogTitle = style({
  fontFamily: t.displayFont,
  fontSize: 26,
  fontWeight: 500,
  margin: "0 0 8px",
});
export const description = style({
  fontSize: 12,
  color: t.muted,
  lineHeight: 1.5,
  margin: "0 0 18px",
});
export const field = style({
  display: "grid",
  gap: 6,
  fontSize: 12,
  marginTop: 14,
  color: t.muted,
});
export const input = style({
  width: "100%",
  minWidth: 0,
  padding: 10,
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
  background: "white",
  fontSize: 14,
});
export const actions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 20,
});
export const save = style([
  button,
  { background: t.coral, borderColor: t.coral },
]);
export const error = style({
  color: "#9a2923",
  fontSize: 12,
  lineHeight: 1.4,
  marginTop: 12,
});
export const popover = style({
  zIndex: 120,
  width: 286,
  maxWidth: "calc(100vw - 32px)",
  padding: 12,
  background: t.page,
  border: `1px solid ${t.rule}`,
  borderRadius: 12,
  boxShadow: "0 8px 28px #25212c30",
});
export const calHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
});
export const calHeading = style({ fontSize: 14, fontWeight: 650 });
export const grid = style({
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
});
export const weekday = style({
  fontSize: 10,
  color: t.muted,
  fontWeight: 600,
  paddingBottom: 5,
});
export const cell = style({ padding: 1, textAlign: "center" });
export const day = style({
  width: "100%",
  aspectRatio: "1",
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: 7,
  background: "transparent",
  fontSize: 12,
  cursor: "pointer",
  selectors: {
    "&[data-selected]": { background: t.coral },
    "&[data-outside-month]": { color: t.muted, opacity: 0.55 },
  },
  ":hover": { boxShadow: `inset 0 0 0 1px ${t.ink}` },
});
export const icon = style({ display: "block", width: "100%", height: "100%" });
export const exportShell = style([
  shell,
  { minHeight: 0, background: t.paper },
]);
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
