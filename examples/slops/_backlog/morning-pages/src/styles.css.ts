import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
const line = 28;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: t.paper });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, textarea:focus-visible, [data-progress-root]:focus-visible", {
  outline: `2px solid ${t.margin}`,
  outlineOffset: 3,
});
globalStyle("::placeholder", { color: t.dim, fontStyle: "italic", opacity: 1 });

const ruling = `repeating-linear-gradient(to bottom, transparent 0 27px, ${t.rule} 27px ${line}px)`;

export const pad = style({
  display: "flex",
  minHeight: "100%",
  flexDirection: "column",
  background: t.paper,
  containerType: "inline-size",
  fontVariantNumeric: "tabular-nums",
});
export const exportPad = style({
  display: "flex",
  flexDirection: "column",
  background: t.paper,
  color: t.ink,
  containerType: "inline-size",
  fontVariantNumeric: "tabular-nums",
});

export const stub = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "14px 20px 12px 64px",
  background: t.stub,
  borderBottom: `2px solid ${t.ink}`,
  position: "relative",
});
export const perforations = style({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: -3,
  height: 6,
  background: `radial-gradient(circle at 4px 3px, ${t.hole} 1.6px, transparent 1.7px)`,
  backgroundSize: "12px 6px",
  pointerEvents: "none",
});
export const brandRow = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
});
export const brand = style({
  display: "flex",
  flexDirection: "column",
  gap: 1,
});
export const brandTitle = style({
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});
export const brandSub = style({
  fontFamily: t.mono,
  fontSize: 9,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: t.muted,
});
export const dateNav = style({
  display: "flex",
  alignItems: "center",
  gap: 2,
  fontFamily: t.mono,
  fontSize: 11,
});
export const navBtn = style({
  border: 0,
  padding: "2px 7px",
  background: "transparent",
  color: t.muted,
  fontSize: 16,
  lineHeight: 1,
  selectors: {
    "&:hover": { color: t.ink },
    "&[data-today='true']": { fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" },
  },
});
export const headlineRow = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
});
export const dateHeadline = style({
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  "@container": { "(max-width: 420px)": { fontSize: 18 } },
});
export const stamp = style({
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: t.gold,
  border: `1.5px solid ${t.gold}`,
  borderRadius: 2,
  padding: "3px 8px",
  transform: "rotate(-6deg)",
  background: t.goldSoft,
});

export const odometer = style({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "end",
  gap: "4px 14px",
  "@container": { "(max-width: 420px)": { gridTemplateColumns: "1fr" } },
});
export const odometerReadout = style({
  display: "flex",
  alignItems: "baseline",
  gap: 8,
});
export const odometerDigits = style({
  fontFamily: t.mono,
  fontSize: 34,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "0.06em",
  color: t.ink,
  selectors: { '&[data-complete="true"]': { color: t.gold } },
});
export const odometerPrecise = style({
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 700,
  color: t.muted,
  letterSpacing: "0.04em",
});
export const pagesTrack = style({
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 0,
});
export const fillTrack = style({
  position: "relative",
  height: 6,
  overflow: "hidden",
  background: `color-mix(in srgb, ${t.ink} 10%, transparent)`,
});
export const fill = style({
  height: "100%",
  width: "100%",
  transformOrigin: "left center",
  background: t.gold,
  selectors: { '&[data-complete="true"]': { background: t.margin } },
});
export const segments = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 4,
});
export const segment = style({
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textAlign: "center",
  padding: "3px 0",
  color: t.muted,
  borderBottom: `2px solid color-mix(in srgb, ${t.ink} 16%, transparent)`,
  selectors: {
    '&[data-done="true"]': {
      color: t.gold,
      borderBottomColor: t.gold,
    },
  },
});

export const sheet = style({
  position: "relative",
  flex: 1,
  minHeight: 460,
  backgroundImage: ruling,
  backgroundPosition: `0 8px`,
  backgroundColor: t.paper,
});
export const marginRule = style({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 48,
  width: 2,
  background: t.margin,
  pointerEvents: "none",
});
export const holes = style({
  position: "absolute",
  top: 24,
  bottom: 24,
  left: 16,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-evenly",
  pointerEvents: "none",
});
export const hole = style({
  width: 11,
  height: 11,
  borderRadius: "50%",
  background: t.hole,
  boxShadow: "inset 0 1px 2px rgba(80, 60, 20, 0.35)",
});
export const editor = style({
  display: "block",
  width: "100%",
  minHeight: "100%",
  margin: 0,
  border: 0,
  padding: "8px 22px 36px 64px",
  background: "transparent",
  color: t.ink,
  fontFamily: t.font,
  fontSize: 16,
  lineHeight: `${line}px`,
  resize: "none",
  overflow: "hidden",
  fieldSizing: "content",
});
export const writing = style({
  margin: 0,
  padding: "8px 22px 36px 64px",
  fontFamily: t.font,
  fontSize: 16,
  lineHeight: `${line}px`,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});
export const empty = style({
  margin: 0,
  padding: "8px 22px 36px 64px",
  color: t.dim,
  fontStyle: "italic",
  fontSize: 16,
  lineHeight: `${line}px`,
});

export const footer = style({
  padding: "8px 22px 12px 64px",
  fontStyle: "italic",
  fontSize: 11,
  lineHeight: 1.4,
  color: t.muted,
});
export const error = style({
  margin: "0 20px 12px 64px",
  fontFamily: t.mono,
  fontSize: 12,
  color: t.gold,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important", transitionDuration: "0s !important" } },
});

export const iconSurface = style({
  display: "grid",
  width: "100%",
  height: "100%",
  placeItems: "center",
  overflow: "hidden",
  background: "transparent",
});
export const iconPad = style({
  position: "relative",
  width: 300,
  height: 392,
  padding: "28px 22px 22px 56px",
  background: t.paper,
  borderRadius: 8,
  boxShadow: "0 18px 40px rgba(80, 60, 20, 0.22)",
});
export const iconMargin = style({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 40,
  width: 4,
  background: t.margin,
});
export const iconLines = style({
  display: "flex",
  flexDirection: "column",
  gap: 22,
  paddingTop: 18,
});
export const iconLine = style({
  height: 8,
  borderRadius: 4,
  background: t.rule,
  selectors: {
    "&:nth-child(4)": { width: "72%" },
    "&:nth-child(5)": { width: "48%" },
  },
});
export const iconSeal = style({
  position: "absolute",
  right: 22,
  bottom: 22,
  display: "grid",
  placeItems: "center",
  width: 72,
  height: 72,
  borderRadius: "50%",
  border: `4px solid ${t.gold}`,
  background: t.goldSoft,
  color: t.gold,
  fontFamily: t.mono,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.04em",
  boxShadow: "0 6px 14px rgba(154, 74, 10, 0.2)",
  selectors: { '&[data-complete="true"]': { borderColor: t.margin, color: t.margin } },
});
