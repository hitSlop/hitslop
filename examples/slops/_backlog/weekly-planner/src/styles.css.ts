import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", {
  margin: 0,
  width: "100%",
  minHeight: "100%",
  fontFamily: t.font,
  color: t.ink,
  background: t.paper,
});
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle(":focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 2,
});
export const canvas = style({
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
});
export const header = style({
  padding: "18px 22px 14px",
  background: t.ink,
  color: t.onAccent,
  display: "flex",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  boxShadow: "inset 0 -3px 0 #0002",
});
export const identity = style({ flex: "1 1 220px", minWidth: 0 });
export const eyebrow = style({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  opacity: 0.7,
});
export const weekTitle = style({
  display: "block",
  width: "100%",
  minWidth: 0,
  border: 0,
  background: "transparent",
  color: "inherit",
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: "-.04em",
  padding: "4px 0",
  margin: 0,
});
export const focus = style({
  display: "grid",
  gap: 5,
  flex: "1 1 180px",
  maxWidth: 300,
  fontSize: 10,
});
globalStyle(`${focus} input`, {
  width: "100%",
  border: 0,
  borderBottom: "1px solid #ffffff40",
  padding: "3px 0 6px",
  background: "transparent",
  color: "white",
  fontSize: 12,
});
export const toolbar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "9px 18px",
  gap: 12,
  fontSize: 11,
  color: t.muted,
});
export const button = style({
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  background: "white",
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 650,
  boxShadow: "0 2px 0 #172e5515",
  ":active": { transform: "translateY(1px)" },
});
export const primary = style([
  button,
  { background: t.accent, color: "white", borderColor: t.accent },
]);
export const scroll = style({
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  position: "relative",
  overscrollBehavior: "contain",
});
export const board = style({
  minWidth: 810,
  display: "grid",
  gridTemplateColumns: "48px repeat(7, minmax(108px, 1fr))",
  position: "relative",
});
export const dayHead = style({
  position: "sticky",
  top: 0,
  zIndex: 12,
  background: t.paperSoft,
  minHeight: 57,
  padding: "9px 9px",
  borderBottom: `1px solid ${t.border}`,
  borderRight: `1px solid ${t.rule}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 4,
});
export const dayName = style({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".06em",
});
export const date = style({
  fontSize: 24,
  lineHeight: 1,
  letterSpacing: "-.04em",
  fontWeight: 700,
});
export const add = style({
  border: 0,
  background: "transparent",
  color: t.accent,
  padding: 5,
  minHeight: 28,
  minWidth: 24,
  fontSize: 20,
});
export const corner = style([
  dayHead,
  { left: 0, zIndex: 14, fontSize: 9, padding: 5 },
]);
export const anytime = style({
  minHeight: 60,
  padding: "6px 5px",
  borderRight: `1px solid ${t.rule}`,
  borderBottom: `1px solid ${t.border}`,
  background: "#fff",
});
export const anytimeLabel = style([
  anytime,
  {
    position: "sticky",
    left: 0,
    zIndex: 10,
    fontSize: 8,
    color: t.muted,
    padding: "12px 3px",
  },
]);
export const gutter = style({
  position: "sticky",
  left: 0,
  zIndex: 10,
  background: t.paper,
  height: 1536,
});
export const hour = style({
  height: 64,
  fontSize: 9,
  textAlign: "right",
  padding: "2px 7px",
  color: t.muted,
  borderTop: `1px solid ${t.rule}`,
});
export const lane = style({
  position: "relative",
  height: 1536,
  borderRight: `1px solid ${t.rule}`,
  background:
    "linear-gradient(to bottom, #dce4f0 1px, transparent 1px) 0 0 / 100% 64px, linear-gradient(to bottom, #eaf0f7 1px, transparent 1px) 0 0 / 100% 32px, #fff",
});
export const sheet = style({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: 0,
  padding: 0,
  background: "transparent",
  touchAction: "pan-x pan-y",
  cursor: "crosshair",
});
export const block = style({
  position: "absolute",
  borderRadius: 6,
  border: "1px solid #172e551c",
  background: t.sky,
  boxShadow:
    "inset 0 1px 0 #ffffffb0, inset 0 -2px 0 #172e5518, 0 2px 3px #172e5512",
  overflow: "hidden",
  minWidth: 0,
  transition: "box-shadow 120ms ease, transform 120ms ease",
  selectors: {
    '&[data-color="coral"]': { background: t.coral },
    '&[data-color="mint"]': { background: t.mint },
    '&[data-color="lilac"]': { background: t.lilac },
    '&[data-done="true"]': { opacity: 0.6 },
    '&[data-active="true"]': {
      zIndex: 8,
      transform: "translateY(-2px)",
      boxShadow: "0 7px 16px #172e5533",
      outline: `2px solid ${t.accent}`,
    },
  },
});
export const blockBody = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  width: "100%",
  height: "100%",
  textAlign: "left",
  padding: "5px 6px",
  border: 0,
  background: "transparent",
  touchAction: "none",
  cursor: "grab",
  overflow: "hidden",
  fontSize: 11,
  lineHeight: 1.25,
  selectors: {
    '&[data-short="true"]': {
      padding: "0 5px",
      fontSize: 10,
      lineHeight: "14px",
    },
  },
  ":active": { cursor: "grabbing" },
});
export const blockTitle = style({
  display: "block",
  fontWeight: 650,
  overflowWrap: "anywhere",
});
export const blockTime = style({
  display: "block",
  fontSize: 9,
  marginTop: 3,
  opacity: 0.75,
});
export const handle = style({
  position: "absolute",
  left: "25%",
  width: "50%",
  height: 7,
  border: 0,
  background: "transparent",
  padding: 0,
  touchAction: "none",
  cursor: "ns-resize",
  zIndex: 2,
  ":hover": { background: "#172e5525" },
  ":focus-visible": { background: "#172e5540", outlineOffset: -2 },
});
export const untimed = style([
  block,
  { position: "relative", marginBottom: 4, minHeight: 30 },
]);
export const ghost = style({
  position: "absolute",
  left: 2,
  right: 2,
  background: "#2449a529",
  border: `2px dashed ${t.accent}`,
  borderRadius: 6,
  pointerEvents: "none",
  zIndex: 9,
  fontSize: 10,
  padding: 3,
});
export const footer = style({
  padding: "8px 18px",
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 10,
  color: t.muted,
  borderTop: `1px solid ${t.border}`,
});
export const overlay = style({
  position: "fixed",
  inset: 0,
  background: "#172e5570",
  zIndex: 100,
});
export const dialog = style({
  position: "fixed",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(420px, calc(100vw - 28px))",
  maxHeight: "calc(100dvh - 28px)",
  overflow: "auto",
  background: t.paper,
  borderRadius: 16,
  padding: 22,
  zIndex: 101,
  boxShadow: "0 20px 60px #172e5540",
});
export const dialogTitle = style({
  fontSize: 22,
  margin: "0 0 6px",
  fontWeight: 700,
});
export const description = style({
  fontSize: 12,
  color: t.muted,
  margin: "0 0 18px",
});
export const fields = style({ display: "grid", gap: 14 });
export const field = style({
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
});
export const input = style({
  minWidth: 0,
  width: "100%",
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  background: "white",
  padding: 10,
  fontSize: 14,
});
export const pair = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
});
export const selectContent = style({
  zIndex: 110,
  background: "white",
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  padding: 5,
  boxShadow: "0 8px 24px #172e5520",
  minWidth: 140,
});
export const option = style({
  padding: "10px 12px",
  fontSize: 13,
  borderRadius: 5,
  selectors: { "&[data-highlighted]": { background: t.paperSoft } },
});
export const check = style({
  width: 20,
  height: 20,
  border: `1px solid ${t.border}`,
  borderRadius: 5,
  background: "white",
  selectors: {
    '&[data-state="checked"]': { background: t.accent, color: "white" },
  },
});
export const checkLabel = style({
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 12,
});
export const actions = style({
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  marginTop: 20,
});
export const danger = style([button, { color: t.danger, marginRight: "auto" }]);
export const error = style({ padding: 10, color: t.danger, fontSize: 12 });
export const exportPage = style({ padding: 22, background: t.paper });
export const exportDays = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  marginTop: 20,
});
export const exportDay = style({ minWidth: 0 });
export const exportBlock = style([
  block,
  {
    position: "relative",
    padding: 10,
    marginBottom: 6,
    fontSize: 12,
    overflowWrap: "anywhere",
  },
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

export const icon = style({ display: "block", width: "100%", height: "100%" });
