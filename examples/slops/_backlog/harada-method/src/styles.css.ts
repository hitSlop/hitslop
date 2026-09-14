import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: t.field });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit", outline: 0 });
globalStyle("button", { cursor: "pointer" });
globalStyle("textarea", { resize: "none" });
globalStyle("::placeholder", { color: t.placeholder, opacity: 1 });
globalStyle("button:focus-visible, input:focus-visible, [data-button-root]:focus-visible, [data-checkbox-root]:focus-visible", {
  outline: `3px solid color-mix(in srgb, ${t.accent} 42%, transparent)`,
  outlineOffset: 2,
});
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0.01ms !important", animationDuration: "0.01ms !important" } },
});

const sheetRule = `2.5px solid ${t.ink}`;

export const canvas = style({
  minHeight: "100%",
  containerType: "inline-size",
  background: t.field,
});
export const page = style({
  display: "flex",
  flexDirection: "column",
  minHeight: "100%",
  padding: "20px 24px 24px",
  background: t.field,
  fontVariantNumeric: "tabular-nums",
  "@container": { "(max-width: 700px)": { paddingInline: 16 } },
});
export const exportPage = style({
  display: "flex",
  flexDirection: "column",
  padding: "20px 24px 24px",
  background: t.field,
  fontVariantNumeric: "tabular-nums",
  containerType: "inline-size",
});

export const masthead = style({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
  alignItems: "center",
  gap: 16,
  borderBottom: sheetRule,
  paddingBottom: 12,
  "@container": { "(max-width: 700px)": { gridTemplateColumns: "auto minmax(0, 1fr)", rowGap: 10 } },
});
export const crest = style({
  width: 26,
  height: 26,
  borderRadius: 3,
  background: t.accent,
  boxShadow: `inset 0 0 0 9px ${t.ink}`,
});
export const wordmark = style({
  margin: 0,
  color: t.accent,
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: ".28em",
  textTransform: "uppercase",
});
export const title = style({
  margin: "3px 0 0",
  color: t.ink,
  fontFamily: t.display,
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: "-.03em",
  lineHeight: 1,
});
export const target = style({
  display: "grid",
  justifyItems: "end",
  gap: 1,
  "@container": { "(max-width: 700px)": { justifyItems: "start" } },
});
globalStyle(`${target} span`, {
  color: t.inkSoft,
  fontFamily: t.mono,
  fontSize: 7,
  fontWeight: 800,
  letterSpacing: ".16em",
  textTransform: "uppercase",
});
globalStyle(`${target} input, ${target} strong`, {
  border: 0,
  padding: 0,
  color: t.ink,
  background: "transparent",
  fontFamily: t.mono,
  fontSize: 12,
  fontWeight: 700,
});
export const targetNote = style({
  color: t.inkSoft,
  fontSize: 9,
  fontStyle: "normal",
  letterSpacing: ".02em",
});
export const tally = style({
  display: "grid",
  justifyItems: "end",
  gap: 3,
  minWidth: 96,
  "@container": { "(max-width: 700px)": { justifyItems: "start" } },
});
export const tallyCount = style({
  display: "flex",
  alignItems: "baseline",
  gap: 3,
  margin: 0,
  fontFamily: t.mono,
});
globalStyle(`${tallyCount} b`, { fontSize: 19, fontWeight: 700 });
globalStyle(`${tallyCount} small`, { color: t.inkSoft, fontSize: 9, fontWeight: 700 });
export const tallyBar = style({
  width: 96,
  height: 6,
  overflow: "hidden",
  borderRadius: 999,
  background: t.hairline,
});
export const tallyFill = style({
  display: "block",
  height: "100%",
  background: t.accent,
  transition: "width 180ms ease",
});
export const tallyLabel = style({
  margin: 0,
  color: t.inkSoft,
  fontFamily: t.mono,
  fontSize: 7,
  fontWeight: 800,
  letterSpacing: ".16em",
  textTransform: "uppercase",
});

export const guide = style({
  margin: "10px 0 0",
  color: t.inkSoft,
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: ".16em",
  textTransform: "uppercase",
});

export const zoomBar = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginTop: 12,
});
export const zoomKey = style({
  border: `1px solid ${t.hairline}`,
  borderRadius: 8,
  padding: "4px 8px",
  color: t.inkSoft,
  background: t.sheet,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: ".04em",
  selectors: {
    '&[data-on="true"]': { color: t.sheet, borderColor: t.ink, background: t.ink },
  },
});
export const zoomTitle = style({
  margin: "8px 0 0",
  color: t.inkSoft,
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: ".2em",
  textTransform: "uppercase",
});

const sheetBase = {
  display: "grid",
  gridTemplateColumns: "repeat(9, minmax(0, 1fr))",
  overflow: "clip",
  border: sheetRule,
  borderRadius: 10,
  background: t.sheet,
} as const;

export const sheet = style({
  ...sheetBase,
  flex: "1 1 auto",
  gridTemplateRows: "repeat(9, minmax(58px, 1fr))",
  marginTop: 14,
  selectors: {
    '&[data-zoom="on"]': {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gridTemplateRows: "repeat(3, minmax(88px, 1fr))",
    },
  },
});
export const exportSheet = style({
  ...sheetBase,
  gridTemplateRows: "repeat(9, minmax(58px, auto))",
  marginTop: 14,
});
export const cellAway = style({ display: "none" });

export const cell = style({
  position: "relative",
  display: "grid",
  overflow: "hidden",
  background: t.sheet,
  transition: "background-color 120ms ease",
  selectors: {
    '&[data-x="hair"]': { borderRight: `1px solid ${t.hairline}` },
    '&[data-x="block"]': { borderRight: sheetRule },
    '&[data-y="hair"]': { borderBottom: `1px solid ${t.hairline}` },
    '&[data-y="block"]': { borderBottom: sheetRule },
    '&[data-role="theme"]': { background: t.sheetShade },
    '&[data-role="goal"]': { background: t.accent, boxShadow: `inset 0 0 0 3px ${t.accentDeep}` },
    '&[data-done="true"]': { background: `color-mix(in srgb, ${t.accent} 7%, ${t.sheet})` },
  },
});

export const write = style({
  width: "100%",
  height: "100%",
  alignContent: "center",
  border: 0,
  padding: "6px 5px",
  color: t.ink,
  background: "transparent",
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: "-.005em",
  lineHeight: 1.3,
  textAlign: "center",
  overflowWrap: "break-word",
  selectors: {
    [`${cell}[data-role="theme"] &`]: { fontSize: 11, fontWeight: 750, letterSpacing: ".01em" },
    [`${cell}[data-role="goal"] &`]: {
      color: t.onAccent,
      fontFamily: t.display,
      fontSize: 13,
      fontWeight: 650,
      letterSpacing: "-.02em",
      lineHeight: 1.25,
    },
    [`${cell}[data-done="true"] &`]: { color: t.inkSoft },
    [`${sheet}[data-zoom="on"] &`]: { fontSize: 12 },
    [`${sheet}[data-zoom="on"] ${cell}[data-role="theme"] &`]: { fontSize: 14 },
    [`${sheet}[data-zoom="on"] ${cell}[data-role="goal"] &`]: { fontSize: 17 },
  },
});
globalStyle(`${write}::placeholder`, { color: t.placeholder });
globalStyle(`${cell}[data-role="goal"] .${write}::placeholder`, { color: "rgb(242 241 255 / 62%)" });
globalStyle(`${write}:focus-visible`, {
  background: `color-mix(in srgb, ${t.accent} 9%, transparent)`,
  boxShadow: `inset 0 0 0 2px ${t.accent}`,
});
globalStyle(`${cell}[data-role="goal"] .${write}:focus-visible`, {
  background: "rgb(0 0 0 / 12%)",
  boxShadow: `inset 0 0 0 2px ${t.onAccent}`,
});

export const tick = style({
  position: "absolute",
  right: 3,
  bottom: 3,
  display: "grid",
  placeItems: "center",
  width: 13,
  height: 13,
  border: `1px solid ${t.hairline}`,
  borderRadius: 4,
  padding: 0,
  color: t.sheet,
  background: t.sheet,
  opacity: 0,
  cursor: "pointer",
  transition: "opacity 120ms ease, background-color 120ms ease, border-color 120ms ease",
  selectors: {
    [`${cell}:hover &, ${cell}:focus-within &`]: { opacity: 1 },
    [`${sheet}[data-zoom="on"] &`]: { opacity: 1 },
    "&:hover": { borderColor: t.accent },
    '&[data-state="checked"]': { opacity: 1, borderColor: t.accent, background: t.accent },
  },
});

export const error = style({
  margin: "12px 0 0",
  color: t.danger,
  fontSize: 11,
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.sheet,
  color: t.ink,
  fontSize: 11,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle('html[data-slop-capture="static"] input::-webkit-calendar-picker-indicator', { display: "none" });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconPage = style({
  display: "grid",
  placeItems: "center",
  width: 464,
  height: 464,
  overflow: "hidden",
  borderRadius: 84,
  background: t.field,
  boxShadow: `inset 0 0 0 4px ${t.ink}`,
});
export const iconGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, 96px)",
  gridTemplateRows: "repeat(3, 96px)",
  gap: 12,
  padding: 12,
  borderRadius: 10,
  background: t.ink,
});
export const iconCell = style({
  borderRadius: 4,
  background: t.sheet,
  selectors: {
    '&[data-role="goal"]': { background: t.accent },
  },
});
