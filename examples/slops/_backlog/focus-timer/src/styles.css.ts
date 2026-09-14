import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
import displayFontURL from "../assets/fonts/Barlow-SemiBold.ttf?url";
const t = theme.vars;
globalFontFace("Barlow Timer", {
  src: `url("${displayFontURL}") format("truetype")`,
  fontWeight: "600",
  fontStyle: "normal",
  fontDisplay: "swap",
});
globalStyle(":root", {
  colorScheme: "light",
  fontFamily: t.font,
  fontSynthesis: "none",
});
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", {
  width: "100%",
  height: "100%",
  margin: 0,
  background: "transparent",
});
globalStyle("#app", { display: "grid", placeItems: "center" });
globalStyle("body", { color: t.ink, fontVariantNumeric: "tabular-nums" });
globalStyle("button", {
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:focus-visible", {
  outline: `3px solid ${t.focus}`,
  outlineOffset: 4,
});
globalStyle("button:disabled", { cursor: "default" });
globalStyle("::selection", { color: t.panel, background: t.accent });
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animationDuration: "0s !important",
      transitionDuration: "0s !important",
    },
  },
});

// Shell and shared leaf

export const shell = style({
  position: "relative",
  isolation: "isolate",
  display: "grid",
  justifyItems: "center",
  width: "min(100vw, 100vh, 440px)",
  height: "min(100vw, 100vh, 440px)",
  minWidth: 320,
  minHeight: 320,
  overflow: "hidden",
  borderRadius: "50%",
  color: t.ink,
  containerType: "size",
  background: `radial-gradient(ellipse at 34% 12%, ${t.surfaceLight}, transparent 67%), linear-gradient(160deg, ${t.surface} 50%, ${t.surfaceDeep})`,
  boxShadow: `inset 0 2px 3px #ffffff70, inset 3px 0 5px #ffffff25, inset -4px -7px 12px #651b173b`,
  "::before": {
    content: '""',
    position: "absolute",
    inset: 9,
    zIndex: -1,
    borderRadius: "50%",
    border: "1px solid #75221b35",
    boxShadow: "0 1px 1px #ffffff30",
    pointerEvents: "none",
  },
});

export const exportShell = style([
  shell,
  {
    width: 440,
    height: 440,
    minWidth: 440,
    minHeight: 440,
  },
]);

export const iconShell = style([
  shell,
  {
    width: 464,
    height: 464,
    minWidth: 464,
    minHeight: 464,
  },
]);

export const leaf = style({
  position: "absolute",
  zIndex: 2,
  top: "5%",
  left: "50%",
  width: 64,
  height: 35,
  transform: "translateX(-50%)",
  filter: "drop-shadow(0 2px 1px #74291b44)",
  selectors: {
    [`${iconShell} &`]: { top: 29, transform: "translateX(-50%) scale(1.3)" },
  },
});

export const leafBlade = style({
  position: "absolute",
  width: 27,
  height: 16,
  top: 9,
  background: t.restAccent,
  borderRadius: "2px 90% 2px 90%",
  boxShadow: "inset 0 2px 2px #ffffff36",
  transformOrigin: "right bottom",
  selectors: {
    "&:nth-child(1)": { left: 6, transform: "rotate(14deg)" },
    "&:nth-child(2)": { left: 28, transform: "rotate(74deg)" },
    "&:nth-child(3)": {
      left: 19,
      top: 1,
      width: 24,
      height: 15,
      transform: "rotate(50deg)",
    },
  },
});

export const leafStem = style({
  position: "absolute",
  left: 32,
  top: 1,
  width: 5,
  height: 18,
  borderRadius: 3,
  background: t.restAccent,
  transform: "rotate(15deg)",
});

// Dial and readout

export const stage = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3.2cqh",
  width: "100%",
  paddingTop: "14.5cqh",
  "@container": { "(max-width: 380px)": { paddingTop: "13cqh", gap: 10 } },
});

export const dial = style({
  position: "relative",
  flexShrink: 0,
  width: "59.1cqw",
  height: "59.1cqw",
  borderRadius: "50%",
  color: t.ink,
  background: `linear-gradient(160deg, ${t.panel}, ${t.panelShade})`,
  boxShadow:
    "0 -3px 4px #73251b80, 0 3px 2px #ffba926b, inset 0 2px 6px #7c5c3133",
  "@container": { "(max-width: 380px)": { width: "63cqw", height: "63cqw" } },
});

export const dialGraphic = style({
  display: "block",
  width: "100%",
  height: "100%",
});

export const dialTick = style({
  stroke: t.muted,
  strokeWidth: 0.9,
  opacity: 0.5,
});

export const majorTick = style([
  dialTick,
  {
    strokeWidth: 1.5,
    opacity: 0.85,
  },
]);
const arc = style({
  fill: "none",
  strokeWidth: 3,
});

export const dialTrack = style([
  arc,
  {
    stroke: t.muted,
    opacity: 0.16,
  },
]);

export const dialProgress = style([
  arc,
  {
    stroke: t.accent,
    strokeLinecap: "round",
    selectors: {
      [`${dial}[data-kind="rest"] &`]: { stroke: t.restAccent },
    },
  },
]);

export const readout = style({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  textAlign: "center",
  paddingTop: 5,
});

export const digits = style({
  display: "block",
  maxWidth: "80%",
  fontFamily: t.displayFont,
  fontSize: "clamp(52px, 16.4cqw, 72px)",
  fontWeight: 600,
  lineHeight: 1.03,
  letterSpacing: "-.025em",
  "@container": { "(max-width: 380px)": { fontSize: "16cqw" } },
});

export const status = style({
  margin: "8px 0 0",
  maxWidth: "76%",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 500,
  color: t.muted,
  "@container": { "(max-width: 380px)": { marginTop: 3, maxWidth: "80%" } },
});

// Controls: keep interaction states and size adaptations with their base

export const modeSwitch = style({
  display: "flex",
  alignItems: "center",
  gap: 2,
  marginBottom: 4,
});

export const modeTrigger = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  minHeight: 44,
  padding: "0 9px",
  border: 0,
  borderRadius: 8,
  fontSize: 14,
  lineHeight: 1,
  fontWeight: 600,
  background: "transparent",
  color: t.muted,
  transition: "background 120ms ease-out, color 120ms ease-out",
  ":focus-visible": { outlineColor: t.accent, outlineOffset: 1 },
  selectors: {
    '&[data-state="active"]': {
      color: t.ink,
      background: "#fffdf280",
      boxShadow: "0 1px 2px #60492c20",
    },
    "&:hover:not(:disabled)": { background: "#fffdf2b3", color: t.ink },
    '&:disabled:not([data-state="active"])': { color: t.muted },
  },
  "@container": { "(max-width: 380px)": { paddingInline: 5, fontSize: 12 } },
});

export const modeDuration = style({
  fontSize: 12,
  fontWeight: 500,
});

export const controls = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
});

export const startButton = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  width: "36.4cqw",
  minWidth: 136,
  height: 48,
  border: 0,
  borderRadius: 24,
  color: t.ink,
  background: `linear-gradient(${t.action}, ${t.panelShade})`,
  boxShadow: "0 4px 6px #661b1b42, inset 0 2px 1px #fffdf2b3",
  fontSize: 16,
  fontWeight: 600,
  transition:
    "transform 120ms ease-out, box-shadow 120ms ease-out, filter 120ms ease-out",
  selectors: {
    "&:hover:not(:disabled)": { filter: "brightness(1.04)" },
    "&:active:not(:disabled)": {
      transform: "translateY(2px)",
      boxShadow: "0 1px 2px #661b1b42, inset 0 1px 2px #78644930",
    },
  },
  "@container": { "(max-width: 380px)": { height: 44 } },
});

export const startIcon = style({
  width: 18,
  height: 18,
  strokeWidth: 1.6,
});

export const resetButton = style({
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  padding: 0,
  border: 0,
  borderRadius: "50%",
  color: t.onSurface,
  background: "#5b160b12",
  boxShadow: "inset 0 1px 2px #73251b42, 0 1px 1px #ffba9259",
  transition: "background 120ms ease-out, transform 120ms ease-out",
  selectors: {
    "&:hover:not(:disabled)": { background: "#fff3da26" },
    "&:active:not(:disabled)": { transform: "translateY(1px)" },
  },
});

export const resetIcon = style({
  width: 19,
  height: 19,
  strokeWidth: 1.8,
});

// Session count and save errors
const footer = style({
  position: "absolute",
  bottom: "7%",
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "58%",
  margin: 0,
  color: t.onSurface,
  fontSize: 12,
  lineHeight: "18px",
  fontWeight: 500,
  textAlign: "center",
});

export const completedCount = style([
  footer,
  {
    "@container": { "(max-width: 380px)": { bottom: "4.5%" } },
    selectors: { [`${exportShell} &`]: { bottom: 33 } },
  },
]);

export const countDot = style({
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "currentColor",
  flexShrink: 0,
});

export const error = style([
  footer,
  {
    gap: 4,
    bottom: "4%",
  },
]);

export const retryButton = style({
  border: 0,
  background: "transparent",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  padding: "0 4px",
  minWidth: 44,
  minHeight: 44,
  fontWeight: 600,
});

// Static export and icon

export const staticMode = style({
  margin: "0 0 12px",
  color: t.muted,
  fontSize: 16,
  fontWeight: 600,
  lineHeight: "28px",
});

export const exportName = style({
  position: "absolute",
  bottom: 60,
  margin: 0,
  color: t.onSurface,
  fontSize: 18,
  fontWeight: 600,
});

export const iconCanvas = style({
  width: 512,
  height: 512,
  display: "grid",
  placeItems: "center",
  background: "transparent",
});

export const iconFace = style({
  position: "absolute",
  top: 88,
  width: 274,
  height: 274,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  color: t.ink,
  background: t.panel,
  boxShadow:
    "0 -4px 5px #73251b80, 0 4px 3px #ffba926b, inset 0 2px 6px #7c5c3133",
  "::before": {
    content: '""',
    position: "absolute",
    inset: 19,
    border: `5px solid ${t.accent}`,
    borderRadius: "50%",
  },
});

export const iconDigits = style({
  fontFamily: t.displayFont,
  fontSize: 128,
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: "-.025em",
});

export const iconTick = style({
  position: "absolute",
  top: 8,
  left: "50%",
  width: 3,
  height: 10,
  borderRadius: 2,
  background: t.muted,
});

export const iconButton = style({
  position: "absolute",
  bottom: 43,
  width: 136,
  height: 30,
  borderRadius: 18,
  background: t.panel,
  boxShadow: "0 3px 5px #661b1b42, inset 0 2px 1px #fffdf2b3",
});
