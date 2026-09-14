import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

const vuPulse = keyframes({
  "0%": { filter: "brightness(1)" },
  "100%": { filter: "brightness(1.25)" },
});

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "dark", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: "#090a0d", color: t.ink, overflow: "hidden", WebkitFontSmoothing: "antialiased" });
globalStyle("button", { font: "inherit", color: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, [data-select-trigger]:focus-visible, [data-slider-thumb]:focus-visible, [data-toggle-root]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 2,
});

export const canvas = style({
  width: "100%",
  height: "100%",
  display: "flex",
  padding: 10,
  overflow: "hidden",
  background: "#0d0e12",
  containerType: "inline-size",
});

export const chassis = style({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "14px 16px 12px",
  overflow: "hidden",
  background: `linear-gradient(180deg, ${t.chassisHi} 0%, ${t.chassis} 42%, #101218 100%)`,
  border: `2px solid ${t.border}`,
  borderRadius: 24,
  boxShadow: `0 16px 40px rgba(0, 0, 0, 0.72), inset 0 1px 0 ${t.glass}`,
});

export const header = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  paddingBottom: 10,
  borderBottom: `1px solid ${t.glass}`,
});

export const brand = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
});
globalStyle(`${brand} strong`, {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: t.accent,
});
globalStyle(`${brand} span`, {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: t.dim,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const headerRight = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexShrink: 0,
});

export const presetTrigger = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 132,
  padding: "6px 10px",
  background: t.well,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  color: t.ink,
  fontSize: 12,
  fontWeight: 700,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  cursor: "pointer",
});
globalStyle(`${presetTrigger}[data-placeholder]`, { color: t.muted });

export const presetContent = style({
  zIndex: 40,
  minWidth: 160,
  padding: 4,
  background: t.panel,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  color: t.ink,
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.55)",
});
globalStyle(`${presetContent} [data-select-item]`, {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "7px 10px",
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  outline: "none",
});
globalStyle(`${presetContent} [data-highlighted]`, { background: "#272c3b", color: t.accent });
globalStyle(`${presetContent} [data-selected]`, { fontWeight: 800, color: t.accent });

export const masterDial = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: t.muted,
});

export const masterSlider = style({
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: 72,
  height: 20,
  touchAction: "none",
  userSelect: "none",
});
export const masterTrack = style({
  position: "relative",
  width: "100%",
  height: 4,
  overflow: "hidden",
  background: t.track,
  borderRadius: 2,
});
export const masterRange = style({ position: "absolute", height: "100%", background: t.accent });
export const masterThumb = style({
  display: "block",
  width: 12,
  height: 12,
  background: t.ink,
  borderRadius: "50%",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
  cursor: "grab",
});

export const power = style({
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  padding: 0,
  borderRadius: "50%",
  background: t.panel,
  border: `1.5px solid ${t.border}`,
  color: t.dim,
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.45)",
  selectors: {
    "&[data-on='true']": {
      background: "#15803d",
      borderColor: t.power,
      color: "#ffffff",
      boxShadow: `0 0 12px color-mix(in srgb, ${t.power} 55%, transparent)`,
    },
  },
});

export const deck = style({
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 8,
  padding: "12px 8px 10px",
  background: `linear-gradient(180deg, #12141c, ${t.panel})`,
  border: `1px solid ${t.glass}`,
  borderRadius: 14,
  boxShadow: "inset 0 2px 10px rgba(0, 0, 0, 0.45)",
});

export const strip = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  padding: "4px 2px",
  borderRadius: 10,
  opacity: 1,
  selectors: {
    "&[data-audible='false']": { opacity: 0.42 },
    "&[data-soloed='true']": { boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${t.solo} 55%, transparent)` },
  },
});

export const channelInfo = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  color: t.muted,
});
export const channelName = style({
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  color: t.ink,
  textAlign: "center",
});

export const faderWell = style({
  flex: 1,
  position: "relative",
  width: 32,
  minHeight: 120,
  display: "flex",
  justifyContent: "center",
  alignItems: "stretch",
});

export const ticks = style({
  position: "absolute",
  top: 14,
  bottom: 14,
  right: 2,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  pointerEvents: "none",
});
globalStyle(`${ticks} i`, {
  display: "block",
  width: 5,
  height: 1,
  background: "rgba(255, 255, 255, 0.16)",
});

export const channelSlider = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: 28,
  height: "100%",
  touchAction: "none",
  userSelect: "none",
});
export const faderGroove = style({
  position: "absolute",
  top: 12,
  bottom: 12,
  left: "50%",
  transform: "translateX(-50%)",
  width: 6,
  background: t.track,
  borderRadius: 3,
  boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.8)",
});
export const faderRange = style({
  position: "absolute",
  bottom: 0,
  width: "100%",
  background: t.accent,
  borderRadius: 3,
  boxShadow: `0 0 8px color-mix(in srgb, ${t.accent} 45%, transparent)`,
});
export const faderCap = style({
  width: 24,
  height: 38,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(180deg, #f8fafc 0%, ${t.faderCap} 46%, ${t.faderRim} 100%)`,
  borderRadius: 4,
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.6), inset 0 1px 0 #ffffff",
  cursor: "grab",
  zIndex: 2,
});
export const faderLine = style({
  width: 16,
  height: 2,
  background: "#0f172a",
  borderRadius: 1,
});

export const channelBottom = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 5,
});
export const channelLevel = style({
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 700,
  color: t.dim,
  fontVariantNumeric: "tabular-nums",
});
export const padRow = style({
  display: "flex",
  gap: 4,
});
export const pad = style({
  minWidth: 34,
  padding: "3px 5px",
  borderRadius: 4,
  border: `1px solid ${t.border}`,
  background: "#232733",
  color: t.muted,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: "0.06em",
  selectors: {
    "&[data-kind='mute'][data-state='on']": {
      background: "#7f1d1d",
      borderColor: t.mute,
      color: "#fecaca",
      boxShadow: `0 0 8px color-mix(in srgb, ${t.mute} 40%, transparent)`,
    },
    "&[data-kind='solo'][data-state='on']": {
      background: "#78350f",
      borderColor: t.solo,
      color: "#fde68a",
      boxShadow: `0 0 8px color-mix(in srgb, ${t.solo} 40%, transparent)`,
    },
  },
});

export const footer = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  paddingTop: 6,
  borderTop: `1px solid ${t.glass}`,
});
export const vuRow = style({
  display: "flex",
  alignItems: "center",
  gap: 3,
});
export const vuSegment = style({
  width: 8,
  height: 12,
  borderRadius: 2,
  background: "#1a1e27",
  selectors: {
    "&[data-lit='green']": { background: t.vuGreen, boxShadow: `0 0 5px ${t.vuGreen}`, animation: `${vuPulse} 120ms linear infinite alternate` },
    "&[data-lit='amber']": { background: t.vuAmber, boxShadow: `0 0 5px ${t.vuAmber}`, animation: `${vuPulse} 120ms linear infinite alternate` },
    "&[data-lit='red']": { background: t.vuRed, boxShadow: `0 0 5px ${t.vuRed}`, animation: `${vuPulse} 90ms linear infinite alternate` },
  },
});
export const status = style({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: t.dim,
  fontFamily: t.mono,
});
export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.panel,
  color: t.vuAmber,
  overflowWrap: "anywhere",
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${canvas}`, { height: "auto", minHeight: "100vh" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important", transitionDuration: "0s !important" } },
});

export const exportCanvas = style({
  display: "flex",
  minHeight: 480,
  padding: 10,
  background: "#0d0e12",
  color: t.ink,
});
export const staticCap = style({
  position: "absolute",
  left: "50%",
  width: 24,
  height: 18,
  marginLeft: -12,
  background: `linear-gradient(180deg, #f8fafc, ${t.faderRim})`,
  borderRadius: 3,
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
  transform: "translateY(50%)",
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconShell = style({
  width: 440,
  height: 440,
  display: "flex",
  flexDirection: "column",
  padding: 28,
  gap: 18,
  background: t.chassis,
  borderRadius: 44,
  border: `14px solid ${t.border}`,
  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
});
export const iconTop = style({ display: "flex", justifyContent: "space-between", alignItems: "center" });
export const iconPill = style({ width: 120, height: 16, background: t.panel, borderRadius: 8 });
export const iconLamp = style({
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: t.dim,
  selectors: {
    "&[data-on='true']": { background: t.power, boxShadow: `0 0 10px ${t.power}` },
  },
});
export const iconDeck = style({
  flex: 1,
  display: "flex",
  justifyContent: "space-between",
  padding: "18px 22px",
  background: t.panel,
  borderRadius: 18,
});
export const iconSlot = style({
  position: "relative",
  width: 10,
  height: "100%",
  background: t.track,
  borderRadius: 5,
});
export const iconCap = style({
  position: "absolute",
  left: "50%",
  width: 26,
  height: 36,
  background: `linear-gradient(180deg, #f8fafc, ${t.faderRim})`,
  borderRadius: 5,
  boxShadow: "0 3px 6px rgba(0, 0, 0, 0.5)",
  transform: "translate(-50%, 50%)",
});
export const iconVu = style({ display: "flex", gap: 6 });
globalStyle(`${iconVu} span`, {
  flex: 1,
  height: 10,
  borderRadius: 2,
  background: t.vuGreen,
  opacity: 0.85,
});
globalStyle(`${iconVu} span[data-hot='true']`, {
  background: t.vuAmber,
  boxShadow: `0 0 6px ${t.vuAmber}`,
});
