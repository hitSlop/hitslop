import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: t.paper });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit", outline: 0 });
globalStyle("input:focus-visible, textarea:focus-visible", { borderBottomColor: t.accent, boxShadow: `inset 0 -2px 0 ${t.accent}` });
globalStyle("input[type='number']", { appearance: "textfield" });
globalStyle("input::-webkit-inner-spin-button, input::-webkit-outer-spin-button", { appearance: "none" });
globalStyle("::placeholder", { color: `color-mix(in srgb, ${t.muted} 60%, transparent)`, opacity: 1 });

export const canvas = style({ minHeight: "100%", containerType: "inline-size", background: t.paper });
export const invoice = style({
  minHeight: "100%",
  padding: "32px 34px 30px",
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
  "@container": { "(max-width: 560px)": { padding: "24px 22px" } },
});
export const masthead = style({
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 22,
  "@container": { "(max-width: 400px)": { display: "grid" } },
});
export const eyebrow = style({ display: "block", color: t.accent, fontSize: 10, fontWeight: 760, letterSpacing: ".11em", textTransform: "uppercase" });
export const numberField = style({ display: "block", marginTop: 7 });
globalStyle(`${numberField} input`, { width: "min(10ch, 64vw)", border: 0, borderBottom: "1px solid transparent", padding: 0, background: "transparent", fontSize: "clamp(3rem, 10cqw, 4rem)", fontWeight: 620, lineHeight: 0.94, letterSpacing: "-.065em" });
export const srOnly = style({ position: "absolute", width: 1, height: 1, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap" });

export const statusTrigger = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minWidth: 104,
  minHeight: 36,
  border: `1px solid ${t.rule}`,
  borderRadius: 9,
  padding: "0 10px",
  color: t.accent,
  background: "transparent",
  fontSize: 10,
  fontWeight: 760,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  cursor: "pointer",
});
export const statusDot = style({
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#a6aaa5",
  selectors: { '&[data-status="sent"]': { background: t.warning }, '&[data-status="paid"]': { background: t.accent } },
});
export const selectContent = style({
  zIndex: 70,
  minWidth: "var(--bits-select-anchor-width)",
  overflow: "hidden",
  border: `1px solid ${t.rule}`,
  borderRadius: 9,
  padding: 4,
  background: t.paper,
  outline: 0,
});
globalStyle(`${selectContent} [data-select-item]`, { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 15, minHeight: 34, borderRadius: 6, padding: "0 9px", fontSize: 12, outline: 0 });
globalStyle(`${selectContent} [data-highlighted]`, { color: t.paper, background: t.accent });

export const meta = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr .85fr",
  marginTop: 24,
  borderBlock: `1px solid ${t.ink}`,
  "@container": {
    "(max-width: 560px)": { gridTemplateColumns: "1fr 1fr" },
    "(max-width: 400px)": { gridTemplateColumns: "1fr" },
  },
});
globalStyle(`${meta} > label, ${meta} > div`, { display: "grid", gridTemplateColumns: "64px minmax(0, 1fr)", alignItems: "center", gap: 8, minHeight: 48 });
globalStyle(`${meta} > * + *`, { borderLeft: `1px solid ${t.rule}`, paddingLeft: 16 });
globalStyle(`${meta} span`, { color: t.muted, fontSize: 10, fontWeight: 760, letterSpacing: ".11em", textTransform: "uppercase" });
globalStyle(`${meta} input`, { minWidth: 0, border: 0, borderBottom: "1px solid transparent", padding: 0, background: "transparent", fontSize: 13, fontWeight: 650 });
export const currencyTrigger = style({ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 5, minHeight: 31, minWidth: 0, border: 0, background: "transparent", fontSize: 13, fontWeight: 650, cursor: "pointer" });

export const parties = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 34,
  padding: "22px 0 20px",
  "@container": { "(max-width: 400px)": { gridTemplateColumns: "1fr" } },
});
export const party = style({ display: "grid", alignContent: "start" });
globalStyle(`${party} > span, ${party} .notes > span`, { color: t.muted, fontSize: 10, fontWeight: 760, letterSpacing: ".11em", textTransform: "uppercase" });
globalStyle(`${party} input, ${party} textarea`, { width: "100%", border: 0, borderBottom: "1px solid transparent", borderRadius: 0, padding: 0, background: "transparent" });
globalStyle(`${party} input`, { marginTop: 9, fontSize: 17, fontWeight: 680, letterSpacing: "-.025em" });
globalStyle(`${party} textarea`, { height: 45, marginTop: 4, resize: "none", color: t.muted, fontSize: 12, lineHeight: 1.45 });

export const lines = style({ borderTop: `1px solid ${t.ink}` });
export const lineHeading = style({
  display: "grid",
  gridTemplateColumns: "minmax(150px, 1fr) 46px 72px 88px 24px",
  alignItems: "center",
  gap: 9,
  minHeight: 34,
  color: t.muted,
  fontSize: 10,
  fontWeight: 760,
  letterSpacing: ".11em",
  textTransform: "uppercase",
  "@container": { "(max-width: 560px)": { display: "none" } },
});
globalStyle(`${lineHeading} h2`, { margin: 0, font: "inherit" });
export const line = style({
  display: "grid",
  gridTemplateColumns: "minmax(150px, 1fr) 46px 72px 88px 24px",
  alignItems: "center",
  gap: 9,
  minHeight: 46,
  borderTop: `1px solid ${t.rule}`,
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "1fr 1fr 1fr", padding: "11px 28px 11px 0", position: "relative" } },
});
globalStyle(`${line} input`, { width: "100%", minWidth: 0, border: 0, borderBottom: "1px solid transparent", padding: "8px 2px", background: "transparent", fontSize: 14 });
export const amount = style({ textAlign: "right", fontSize: 13, fontWeight: 680 });
export const remove = style({
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  border: 0,
  borderRadius: 6,
  padding: 0,
  color: t.muted,
  background: "transparent",
  opacity: 0,
  selectors: { [`${line}:hover &`]: { opacity: 1 }, "&:hover": { color: t.danger } },
  "@media": { "(hover: none)": { opacity: 1 } },
});
export const add = style({ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 31, border: 0, padding: "0 2px", color: t.accent, background: "transparent", fontSize: 10, fontWeight: 760, letterSpacing: ".06em", textTransform: "uppercase", cursor: "pointer" });
export const mobile = style({ display: "none", "@container": { "(max-width: 560px)": { display: "block", marginBottom: 1, color: t.muted, fontSize: 8, fontWeight: 750, letterSpacing: ".08em", textTransform: "uppercase" } } });

export const closing = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 216px",
  gap: 38,
  marginTop: 18,
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "1fr" } },
});
export const notes = style({ display: "grid", alignContent: "start", gap: 7 });
globalStyle(`${notes} > span`, { color: t.muted, fontSize: 10, fontWeight: 760, letterSpacing: ".11em", textTransform: "uppercase" });
globalStyle(`${notes} textarea`, { width: "100%", height: 70, border: 0, borderTop: `1px solid ${t.rule}`, borderRadius: 0, padding: "9px 0", resize: "none", background: "transparent", fontSize: 12, lineHeight: 1.45 });
export const totals = style({ display: "grid", alignContent: "start", gap: 8, margin: 0, fontSize: 13 });
globalStyle(`${totals} > div`, { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 18 });
globalStyle(`${totals} dt`, { color: t.muted });
globalStyle(`${totals} dd`, { margin: 0 });
globalStyle(`${totals} input`, { width: 34, border: 0, borderBottom: `1px solid ${t.rule}`, padding: "1px 0", background: "transparent", textAlign: "right" });
export const grand = style({ marginTop: 3, borderTop: `1px solid ${t.ink}`, paddingTop: 11, color: t.accent, fontSize: 23, fontWeight: 700, letterSpacing: "-.035em" });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${lineHeading}, html[data-slop-capture="static"] .${line}`, { gridTemplateColumns: "minmax(150px, 1fr) 46px 72px 88px" });
globalStyle("*, *::before, *::after", { "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: ".01ms !important" } } });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconTile = style({ position: "relative", display: "grid", placeItems: "center", width: 464, height: 464, overflow: "hidden", borderRadius: 96, background: t.accentInk });
export const iconDoc = style({ position: "relative", width: 300, height: 372, borderRadius: 18, background: t.paper });
export const iconRuleA = style({ position: "absolute", left: 26, top: 118, width: 248, height: 44, borderRadius: 8, background: t.accent });
export const iconRuleB = style({ position: "absolute", left: 26, top: 178, width: 182, height: 44, borderRadius: 8, background: t.accent });
export const iconTotal = style({ position: "absolute", top: 252, left: 38, width: 224, height: 82, borderRadius: 14, background: t.accentInk });
export const iconFold = style({ position: "absolute", top: 46, left: 304, width: 78, height: 78, background: t.accentInk, clipPath: "polygon(0 0, 100% 0, 100% 100%)" });
