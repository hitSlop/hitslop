import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

const sparkle = keyframes({
  "0%": { transform: "translateY(0) rotate(0deg) scale(0.6)", opacity: 0 },
  "20%": { opacity: 1, transform: "translateY(-60px) rotate(45deg) scale(1.1)" },
  "80%": { opacity: 0.9, transform: "translateY(-240px) rotate(180deg) scale(1)" },
  "100%": { transform: "translateY(-320px) rotate(360deg) scale(0.5)", opacity: 0 },
});

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "dark", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: t.surface, color: t.ink, overflow: "hidden" });
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: .45 });
globalStyle("button:focus-visible, input:focus-visible, [data-progress-root]:focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 2,
});

export const flask = style({
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  overflow: "hidden",
  background: t.surface,
  border: `2px solid ${t.border}`,
  boxShadow: `inset 0 1px 0 color-mix(in srgb, ${t.accent} 25%, transparent)`,
  containerType: "inline-size",
  "@media": { "(max-width: 360px)": { padding: 12, gap: 10 } },
});

export const header = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  borderBottom: `1px solid color-mix(in srgb, ${t.accent} 15%, transparent)`,
  paddingBottom: 8,
});
export const brand = style({
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: t.accent,
});
export const target = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 700,
  color: t.muted,
});
globalStyle(`${target} input`, {
  width: 55,
  background: t.panel,
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  fontFamily: t.mono,
  fontSize: 11.5,
  fontWeight: 800,
  color: t.accent,
  padding: "2px 4px",
  textAlign: "right",
});

export const chamber = style({
  flex: 1,
  minHeight: 200,
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  background: t.chamber,
  border: `2px solid ${t.border}`,
  borderRadius: 20,
  boxShadow: `inset 0 4px 16px rgba(0, 0, 0, 0.8), 0 0 12px color-mix(in srgb, ${t.accent} 10%, transparent)`,
  selectors: {
    '&[data-complete="true"]': {
      borderColor: t.celebrate,
    },
  },
});
export const liquid = style({
  width: "100%",
  position: "absolute",
  inset: 0,
  height: "100%",
  background: `linear-gradient(180deg, ${t.accent} 0%, ${t.accentDeep} 40%, #0e7490 100%)`,
  boxShadow: `0 0 20px ${t.glow}`,
});
export const waveCap = style({
  position: "absolute",
  top: -10,
  left: 0,
  right: 0,
  height: 14,
  background: t.accent,
  borderRadius: "50% 50% 0 0",
  opacity: 0.8,
  selectors: {
    '&[data-complete="true"]': { background: "#fef08a", boxShadow: "0 0 15px #fde047" },
  },
});
export const readout = style({
  position: "absolute",
  inset: 0,
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  textShadow: "0 2px 8px rgba(0, 0, 0, 0.7)",
});
export const digits = style({
  fontFamily: t.mono,
  fontSize: 48,
  fontWeight: 900,
  lineHeight: 1,
  color: "#ffffff",
  letterSpacing: "-0.03em",
  fontVariantNumeric: "tabular-nums",
});
export const unit = style({
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: t.accent,
});
export const percent = style({
  marginTop: 4,
  fontSize: 12,
  fontWeight: 700,
  color: t.muted,
  background: "rgba(0, 0, 0, 0.45)",
  padding: "2px 8px",
  borderRadius: 10,
});
export const badge = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  pointerEvents: "auto",
  marginBottom: 8,
  padding: "4px 14px",
  border: 0,
  borderRadius: 20,
  background: "linear-gradient(135deg, #f59e0b, #ea580c)",
  color: "#ffffff",
  fontSize: 11.5,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  boxShadow: "0 4px 16px rgba(245, 158, 11, 0.6)",
});
export const confetti = style({ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 3 });
export const particle = style({
  position: "absolute",
  bottom: -20,
  userSelect: "none",
  animation: `${sparkle} linear both`,
});

export const taps = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  "@container": { "(max-width: 340px)": { gridTemplateColumns: "repeat(2, 1fr)" } },
});
export const tap = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "8px 4px",
  border: `1px solid ${t.border}`,
  borderRadius: 10,
  background: t.panel,
  color: t.ink,
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
  selectors: {
    "&:hover": { background: "#154c60", borderColor: t.accent },
    "&:active": { transform: "translateY(1px)" },
  },
});
globalStyle(`${tap} strong`, { fontFamily: t.mono, fontSize: 15, fontWeight: 800, color: t.accent });
globalStyle(`${tap} span`, { fontSize: 11, fontWeight: 700, color: t.muted, textTransform: "uppercase" });

export const foot = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  borderTop: `1px solid color-mix(in srgb, ${t.accent} 15%, transparent)`,
  paddingTop: 6,
  fontSize: 11,
  color: t.muted,
});
globalStyle(`${foot} button`, {
  background: "transparent",
  border: 0,
  color: t.danger,
  fontSize: 10.5,
  fontWeight: 700,
});

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.panel,
  color: t.celebrate,
  overflowWrap: "anywhere",
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${flask}`, { height: "auto", minHeight: "100vh", overflow: "visible" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important", transitionDuration: "0s !important" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconShell = style({
  width: 440,
  height: 440,
  display: "flex",
  flexDirection: "column",
  padding: 24,
  gap: 16,
  background: t.surface,
  borderRadius: 44,
  border: `14px solid ${t.border}`,
  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
});
export const iconChamber = style({
  flex: 1,
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  background: t.chamber,
  border: `4px solid ${t.border}`,
  borderRadius: 24,
});
export const iconFill = style({
  width: "100%",
  position: "relative",
  background: `linear-gradient(180deg, ${t.accent}, ${t.accentDeep})`,
  boxShadow: `0 0 20px ${t.glow}`,
});
export const iconWave = style({
  position: "absolute",
  top: -12,
  left: 0,
  right: 0,
  height: 16,
  background: t.accent,
  borderRadius: "50% 50% 0 0",
});
export const iconDrop = style({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  fontSize: 48,
  filter: "drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5))",
});
export const iconDots = style({ display: "flex", justifyContent: "center", gap: 8 });
globalStyle(`${iconDots} span`, {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: t.accent,
  boxShadow: `0 0 8px ${t.accent}`,
});

export const exportFlask = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  background: t.surface,
  color: t.ink,
});
