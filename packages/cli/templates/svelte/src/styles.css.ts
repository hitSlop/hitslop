import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "./theme-contract.css.ts";

globalStyle(":root", { colorScheme: "light", fontFamily: theme.font, fontSynthesis: "none" });
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", { width: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: theme.ink, background: theme.surface });
globalStyle("button", { font: "inherit" });
globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle('html[data-slop-renderer="true"][data-slop-capture="icon"] main', { display: "none" });
globalStyle('html[data-slop-renderer="true"][data-slop-capture="icon"] [data-slop-render="icon"]', { display: "grid !important" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { scrollBehavior: "auto", transitionDuration: ".01ms" } },
});

export const main = style({ minHeight: "100vh", containerType: "inline-size", background: theme.surface });
export const counter = style({
  display: "grid",
  alignContent: "center",
  minHeight: "100vh",
  padding: "34px 38px",
  "@container": { "(max-width: 360px)": { padding: "25px 23px" } },
});
globalStyle(`${counter} header`, { display: "grid", gap: 4 });
export const eyebrow = style({ margin: 0, color: theme.accent, fontSize: 10, fontWeight: 760, letterSpacing: ".1em", textTransform: "uppercase" });
export const heading = style({ margin: 0, fontSize: 25, fontWeight: 670, letterSpacing: "-.035em" });
export const readout = style({ margin: "25px 0 14px", border: `1px solid ${theme.rule}`, borderRadius: 12, padding: "25px 24px 21px", background: theme.panel });
export const output = style({ display: "block", fontSize: "clamp(70px, 20cqw, 94px)", fontWeight: 650, lineHeight: ".84", letterSpacing: "-.075em", fontVariantNumeric: "tabular-nums" });
export const readoutLabel = style({ display: "block", marginTop: 13, color: theme.muted, fontSize: 12 });
export const controls = style({ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 9 });
export const controlButton = style({
  minHeight: 48,
  border: `1px solid ${theme.rule}`,
  borderRadius: 10,
  color: theme.ink,
  background: theme.control,
  cursor: "pointer",
  fontSize: 23,
  selectors: { "&:focus-visible": { outline: `3px solid color-mix(in srgb, ${theme.accent} 34%, transparent)`, outlineOffset: 2 } },
});
export const primaryButton = style({ borderColor: "transparent", color: theme.surface, background: theme.accent });
export const resetButton = style({ gridColumn: "1 / -1", minHeight: 30, border: 0, color: theme.muted, background: "transparent", fontSize: 10, fontWeight: 750, letterSpacing: ".08em", textTransform: "uppercase" });
export const error = style({ margin: "10px 0 0", color: "#9a2e27", fontSize: 11 });
export const renderTarget = style({ display: "none !important", width: 512, height: 512, placeItems: "center", overflow: "hidden", background: "transparent" });
export const iconTile = style({ display: "grid", placeItems: "center", width: 464, height: 464, border: `18px solid ${theme.ink}`, borderRadius: 72, color: theme.surface, background: theme.accent, fontSize: 250, fontWeight: 700 });
