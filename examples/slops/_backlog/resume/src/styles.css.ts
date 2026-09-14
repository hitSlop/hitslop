import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: t.paper });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit", outline: 0 });
globalStyle("input:focus-visible, textarea:focus-visible", { borderBottomColor: t.accent, boxShadow: `inset 0 -2px 0 ${t.accent}` });
globalStyle("button:focus-visible, [data-button-root]:focus-visible", { outline: `3px solid color-mix(in srgb, ${t.accent} 28%, transparent)`, outlineOffset: 2 });
globalStyle("::placeholder", { color: `color-mix(in srgb, ${t.muted} 60%, transparent)`, opacity: 1 });

export const canvas = style({ minHeight: "100%", containerType: "inline-size", background: t.paper });
export const resume = style({
  display: "grid",
  gridTemplateColumns: "190px minmax(0, 1fr)",
  minHeight: "100%",
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "1fr" } },
});
export const sidebar = style({
  display: "flex",
  flexDirection: "column",
  gap: 24,
  padding: "27px 21px",
  background: t.rail,
  "@container": {
    "(max-width: 560px)": { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 20, padding: "23px 20px", borderBottom: `1px solid ${t.rule}` },
    "(max-width: 420px)": { gridTemplateColumns: "1fr" },
  },
});
export const mainColumn = style({
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  padding: "28px 30px 26px",
  "@container": { "(max-width: 560px)": { padding: "25px 21px" } },
});
export const monogram = style({
  display: "grid",
  placeItems: "center",
  width: 48,
  height: 48,
  border: 0,
  borderRadius: "50%",
  padding: 0,
  color: t.paper,
  background: t.accent,
  fontSize: 15,
  fontWeight: 780,
  letterSpacing: "-.03em",
  textAlign: "center",
  textTransform: "uppercase",
});
export const heading = style({ margin: 0, color: t.muted, fontSize: 10, fontWeight: 760, letterSpacing: ".11em", textTransform: "uppercase" });
export const eyebrow = style({ display: "block", margin: 0, color: t.accent, fontSize: 10, fontWeight: 760, letterSpacing: ".11em", textTransform: "uppercase" });
export const contactBlock = style({
  display: "grid",
  gap: 10,
  "@container": {
    "(max-width: 560px)": { gridColumn: 2, gridRow: 1, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", alignItems: "end", gap: 10 },
    "(max-width: 420px)": { gridColumn: 1, gridRow: "auto", gridTemplateColumns: "1fr" },
  },
});
globalStyle(`${contactBlock} h2`, { "@container": { "(max-width: 560px)": { display: "none" } } });
globalStyle(`${contactBlock} label, ${contactBlock} div`, { display: "grid", gridTemplateColumns: "15px minmax(0, 1fr)", alignItems: "center", gap: 8 });
globalStyle(`${contactBlock} svg`, { width: 14, color: t.accent });
export const skillsBlock = style({ display: "grid", gap: 10, "@container": { "(max-width: 560px)": { gridColumn: "1 / -1" } } });
export const educationBlock = style({ display: "grid", gap: 10, "@container": { "(max-width: 560px)": { gridColumn: "1 / -1" } } });
export const field = style({
  width: "100%",
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: "3px 0",
  color: t.ink,
  background: "transparent",
  fontSize: 11,
  lineHeight: 1.35,
});
export const sectionHeading = style({ display: "flex", alignItems: "center", justifyContent: "space-between" });
export const addCompact = style({
  display: "inline-grid",
  placeItems: "center",
  width: 20,
  height: 20,
  border: 0,
  borderRadius: "50%",
  padding: 0,
  color: t.muted,
  background: `color-mix(in srgb, ${t.accent} 9%, transparent)`,
  cursor: "pointer",
  selectors: { "&:hover, &:active": { color: t.paper, background: t.accent } },
});
export const skills = style({ display: "flex", flexWrap: "wrap", gap: 6 });
export const skill = style({
  display: "inline-flex",
  alignItems: "center",
  maxWidth: "100%",
  minHeight: 27,
  borderRadius: 6,
  padding: "0 6px 0 8px",
  color: t.accent,
  background: t.accentSoft,
});
globalStyle(`${skill} input, ${skill} span`, {
  width: "min-content",
  minWidth: 42,
  maxWidth: 118,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: 0,
  color: "inherit",
  background: "transparent",
  fontSize: 10,
  fontWeight: 720,
});
export const skillRemove = style({
  display: "grid",
  placeItems: "center",
  width: 14,
  height: 14,
  border: 0,
  borderRadius: "50%",
  padding: 0,
  color: `color-mix(in srgb, ${t.accent} 65%, transparent)`,
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
  selectors: { "&:hover, &:active": { color: t.paper, background: t.accent } },
});
export const educationList = style({
  display: "grid",
  gap: 11,
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" } },
});
export const educationItem = style({ display: "grid", gap: 2 });
export const educationSchool = style({
  width: "100%",
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: "3px 0",
  color: t.ink,
  background: "transparent",
  fontSize: 11,
  fontWeight: 730,
  lineHeight: 1.35,
});
export const educationYear = style({ display: "flex", alignItems: "center", gap: 5 });
globalStyle(`${educationYear} input, ${educationYear} span`, { minWidth: 0, color: t.muted });
export const removeCompact = style({
  display: "inline-grid",
  placeItems: "center",
  flex: "0 0 auto",
  width: 18,
  height: 18,
  border: 0,
  borderRadius: 4,
  padding: 0,
  color: t.muted,
  background: "transparent",
  cursor: "pointer",
  opacity: 0.65,
  selectors: { "&:hover, &:active": { color: t.danger, background: `color-mix(in srgb, ${t.danger} 9%, transparent)`, opacity: 1 } },
});

export const profile = style({ paddingBottom: 21, borderBottom: `1px solid ${t.ink}` });
export const name = style({
  display: "block",
  width: "100%",
  margin: "8px 0 0",
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: 0,
  color: t.ink,
  background: "transparent",
  fontSize: "clamp(2.7rem, 8cqw, 3.55rem)",
  fontWeight: 650,
  lineHeight: 0.96,
  letterSpacing: "-.06em",
});
export const role = style({
  display: "block",
  width: "100%",
  marginTop: 7,
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: 0,
  color: t.accent,
  background: "transparent",
  fontSize: "clamp(16px, 3cqw, 20px)",
  fontWeight: 660,
  letterSpacing: "-.025em",
});
export const summary = style({
  display: "block",
  width: "100%",
  minHeight: 60,
  marginTop: 13,
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: 0,
  resize: "none",
  overflow: "hidden",
  fieldSizing: "content",
  color: t.muted,
  background: "transparent",
  fontSize: 12.5,
  lineHeight: 1.52,
  whiteSpace: "pre-wrap",
});
export const experience = style({ paddingTop: 20 });
export const experienceHeading = style({ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 7, borderBottom: `1px solid ${t.rule}` });
globalStyle(`${experienceHeading} h2`, { margin: 0, color: t.accent, fontSize: 10, fontWeight: 770, letterSpacing: ".1em", textTransform: "uppercase" });
export const addExperience = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minHeight: 24,
  border: 0,
  padding: 0,
  color: t.accent,
  background: "transparent",
  cursor: "pointer",
  fontSize: 9,
  fontWeight: 750,
  letterSpacing: ".07em",
  textTransform: "uppercase",
  selectors: { "&:hover, &:active": { color: `color-mix(in srgb, ${t.accent} 78%, ${t.ink})` } },
});
export const experienceList = style({ display: "grid" });
export const experienceItem = style({
  display: "grid",
  gridTemplateColumns: "82px minmax(0, 1fr)",
  gap: 18,
  padding: "15px 0",
  borderBottom: `1px solid ${t.rule}`,
  "@container": { "(max-width: 420px)": { gridTemplateColumns: "1fr", gap: 6 } },
});
export const experienceMeta = style({
  display: "flex",
  alignItems: "start",
  gap: 5,
  "@container": { "(max-width: 420px)": { justifyContent: "space-between" } },
});
export const period = style({
  minWidth: 0,
  width: "100%",
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: "2px 0",
  color: t.muted,
  background: "transparent",
  fontSize: 9.5,
  fontWeight: 710,
  letterSpacing: ".025em",
  textTransform: "uppercase",
  "@container": { "(max-width: 420px)": { width: "auto" } },
});
export const removeExperience = style({
  display: "inline-grid",
  placeItems: "center",
  flex: "0 0 auto",
  width: 20,
  height: 20,
  border: 0,
  borderRadius: 5,
  padding: 0,
  color: t.muted,
  background: "transparent",
  cursor: "pointer",
  opacity: 0,
  selectors: {
    [`${experienceItem}:hover &`]: { opacity: 0.72 },
    "&:hover, &:active": { color: t.danger, background: `color-mix(in srgb, ${t.danger} 9%, transparent)`, opacity: 1 },
    "&:focus-visible": { opacity: 0.72 },
  },
  "@media": { "(hover: none)": { opacity: 0.72 } },
  "@container": { "(max-width: 420px)": { opacity: 0.72 } },
});
export const roleLine = style({ display: "flex", alignItems: "baseline", minWidth: 0, gap: 6 });
globalStyle(`${roleLine} > span`, { color: t.accent });
export const jobRole = style({
  flex: "1.4 1 0",
  minWidth: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: 0,
  color: t.ink,
  background: "transparent",
  fontSize: 14,
  fontWeight: 730,
  letterSpacing: "-.02em",
});
export const company = style({
  flex: ".8 1 0",
  minWidth: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: 0,
  color: t.accent,
  background: "transparent",
  fontSize: 14,
  fontWeight: 730,
  letterSpacing: "-.02em",
});
export const experienceCopy = style({
  display: "block",
  width: "100%",
  minHeight: 70,
  marginTop: 6,
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: 0,
  resize: "none",
  overflow: "hidden",
  fieldSizing: "content",
  color: t.muted,
  background: "transparent",
  fontSize: 11.5,
  lineHeight: 1.48,
  whiteSpace: "pre-wrap",
});
export const srOnly = style({ position: "absolute", width: 1, height: 1, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap" });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle("html[data-slop-capture=\"static\"] input, html[data-slop-capture=\"static\"] textarea", { borderBottomColor: "transparent", boxShadow: "none" });
globalStyle("*, *::before, *::after", { "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: ".01ms !important" } } });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center", overflow: "hidden", background: "transparent" });
export const iconSheet = style({
  display: "grid",
  gridTemplateColumns: "92px minmax(0, 1fr)",
  width: 464,
  height: 464,
  overflow: "hidden",
  border: `18px solid ${t.ink}`,
  borderRadius: 48,
  background: t.paper,
});
export const iconRail = style({ background: t.accent });
export const iconMonogram = style({
  display: "grid",
  placeItems: "center",
  alignSelf: "center",
  justifySelf: "center",
  width: 260,
  height: 260,
  border: `14px solid ${t.ink}`,
  borderRadius: "50%",
  color: t.paper,
  background: t.accent,
  fontSize: 112,
  fontWeight: 800,
  letterSpacing: "-.06em",
});
