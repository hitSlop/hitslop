import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%" });
globalStyle("body", { background: t.surface, color: t.ink, overflow: "hidden" });
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button:focus-visible, input:focus-visible, [data-slider-thumb]:focus-visible", { outline: `2px solid ${t.ink}`, outlineOffset: 2 });

export const sheet = style({
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "22px 22px 18px",
  overflow: "hidden",
  background: t.surface,
  border: `2px solid ${t.border}`,
  boxShadow: "inset 0 2px 0 #ffffff",
  containerType: "inline-size",
});
export const prompt = style({
  width: "100%",
  border: 0,
  borderBottom: `1.5px solid ${t.border}`,
  padding: "0 0 10px",
  background: "transparent",
  fontFamily: t.headingFont,
  fontSize: 24,
  fontWeight: 700,
  fontStyle: "italic",
  lineHeight: 1.2,
});
export const checkin = style({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 14px",
  background: t.panel,
  border: `1px solid ${t.border}`,
  borderRadius: 14,
});
export const orbs = style({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 });
export const orbGroup = style({ display: "flex", gap: 8 });
export const orb = style({
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "2px solid transparent",
  cursor: "pointer",
  selectors: { '&[data-state="checked"]': { transform: "scale(1.18)", borderColor: "#ffffff", boxShadow: "0 0 10px rgba(0, 0, 0, 0.25)" } },
});
export const energy = style({ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: t.muted });
export const slider = style({ position: "relative", display: "flex", alignItems: "center", width: 65, height: 16, touchAction: "none", userSelect: "none" });
export const track = style({ position: "relative", width: "100%", height: 4, background: "rgba(0, 0, 0, 0.12)", borderRadius: 2, overflow: "hidden" });
export const range = style({ position: "absolute", height: "100%", background: t.ink });
export const thumb = style({ display: "block", width: 12, height: 12, background: t.ink, borderRadius: "50%", boxShadow: "0 1px 2px rgba(0, 0, 0, 0.3)", cursor: "grab" });
export const composer = style({ display: "flex", gap: 8, alignItems: "center" });
globalStyle(`${composer} input`, { flex: 1, minWidth: 0, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 10px", background: "#ffffff", fontSize: 12.5 });
export const log = style({ border: 0, borderRadius: 8, padding: "6px 12px", background: t.ink, color: "#ffffff", fontSize: 11, fontWeight: 700 });
export const list = style({ flex: 1, minHeight: 0, overflowY: "auto", listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 });
export const row = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  background: "#ffffff",
  border: "1px solid rgba(0, 0, 0, 0.05)",
  borderRadius: 10,
});
export const entryOrb = style({ width: 14, height: 14, borderRadius: "50%", flexShrink: 0 });
export const meta = style({ display: "flex", flexDirection: "column", width: 65, flexShrink: 0, fontSize: 11, fontWeight: 800 });
globalStyle(`${meta} small`, { fontSize: 9.5, color: t.dim, fontWeight: 400 });
export const note = style({ flex: 1, minWidth: 0, margin: 0, fontSize: 14, lineHeight: 1.4, fontStyle: "italic" });
export const remove = style({
  border: 0,
  background: "transparent",
  color: t.dim,
  opacity: 0,
  selectors: { [`${row}:hover &`]: { opacity: 1 }, [`${row}:focus-within &`]: { opacity: 1 } },
});
export const foot = style({ display: "flex", justifyContent: "space-between", gap: 8, borderTop: `1px solid ${t.border}`, paddingTop: 8, fontSize: 11, color: t.muted });
export const empty = style({ padding: 24, textAlign: "center", color: t.muted, fontFamily: t.headingFont });

export const exportSheet = style({
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "22px 22px 18px",
  background: t.surface,
  color: t.ink,
});
globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${sheet}`, { height: "auto", minHeight: "100vh", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${list}`, { overflow: "visible" });
globalStyle("*, *::before, *::after", { "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } } });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconSheet = style({ width: 400, height: 440, padding: 36, background: t.surface, borderRadius: 36, border: `8px solid ${t.border}` });
export const iconTitle = style({ width: 220, height: 16, marginBottom: 28, background: t.ink, borderRadius: 8 });
export const iconOrbs = style({ display: "flex", gap: 14, marginBottom: 32 });
globalStyle(`${iconOrbs} span`, { width: 28, height: 28, borderRadius: "50%" });
export const iconLine = style({ height: 12, marginBottom: 16, background: t.panel, borderRadius: 6 });
