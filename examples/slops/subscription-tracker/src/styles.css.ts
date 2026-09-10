import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalFontFace("Subscription Space", {
  src: 'url("../assets/fonts/SpaceGrotesk.ttf") format("truetype")',
  fontWeight: "300 700",
  fontDisplay: "swap",
});
globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", {
  colorScheme: "light",
  fontFamily: t.font,
  fontSynthesis: "none",
});
globalStyle("html, body, #app", {
  width: "100%",
  minHeight: "100%",
  margin: 0,
});
globalStyle("body", { color: t.ink, background: t.paper });
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle("button:focus-visible, input:focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 3,
});
globalStyle("::selection", { background: t.mint, color: t.accentInk });
globalStyle("::placeholder", { color: t.muted, opacity: 1 });
globalStyle("input", { caretColor: t.accent });
export const canvas = style({
  minHeight: "100%",
  containerType: "inline-size",
});
export const ledger = style({
  minHeight: "100%",
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
});
export const exportLedger = style([
  ledger,
  { containerType: "inline-size", paddingBottom: 20 },
]);
export const masthead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "20px 26px 14px",
  background: t.accentInk,
  color: t.onDark,
  "@container": { "(max-width: 500px)": { padding: "22px 18px 16px" } },
});
globalStyle(`${masthead} h1`, {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: "clamp(25px, 5.2cqw, 34px)",
  lineHeight: 1.1,
  fontWeight: 600,
  letterSpacing: "-.03em",
});
export const headingLoop = style({ display: "inline-flex", color: t.mint });
export const currencyField = style({
  display: "grid",
  gap: 3,
  flexShrink: 0,
  color: t.mutedOnDark,
  fontSize: 10,
  textAlign: "right",
});
export const currencyTrigger = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 36,
  border: "1px solid #65577c",
  borderRadius: 8,
  padding: "0 9px",
  background: "transparent",
  color: t.onDark,
  fontSize: 12,
  ":focus-visible": { outline: `2px solid ${t.mint}`, outlineOffset: 3 },
});
export const selectContent = style({
  zIndex: 120,
  minWidth: "var(--bits-select-anchor-width)",
  borderRadius: 12,
  padding: 5,
  background: t.paper,
  color: t.ink,
  boxShadow: "0 10px 28px #24203926",
  outline: 0,
});
globalStyle(`${selectContent} [data-select-item]`, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 15,
  minHeight: 44,
  borderRadius: 7,
  padding: "0 10px",
  fontSize: 14,
  outline: 0,
  cursor: "pointer",
});
globalStyle(`${selectContent} [data-highlighted]`, {
  background: t.accent,
  color: t.onDark,
});
export const totals = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "18px 20px",
  padding: "8px 26px 18px",
  background: t.accentInk,
  color: t.onDark,
  "@container": {
    "(max-width: 500px)": { paddingInline: 18, gap: "16px 12px" },
  },
});
globalStyle(`${totals} > div`, {
  display: "grid",
  alignContent: "end",
  gap: 8,
  minWidth: 0,
});
globalStyle(`${totals} span`, { color: t.mutedOnDark, fontSize: 12 });
globalStyle(`${totals} strong`, {
  fontFamily: t.headingFont,
  fontSize: "clamp(36px, 8cqw, 54px)",
  fontWeight: 600,
  letterSpacing: "-.04em",
  lineHeight: 1.05,
  color: t.mint,
  overflowWrap: "anywhere",
});
globalStyle(`${totals} b`, {
  fontFamily: t.headingFont,
  fontSize: 20,
  fontWeight: 500,
  paddingBottom: 4,
});
export const totalNote = style({
  gridColumn: "1 / -1",
  display: "flex !important",
  alignItems: "center",
  gap: "7px !important",
  borderTop: "1px solid #65577c",
  paddingTop: 10,
});
globalStyle(`${totalNote} span`, { color: t.mutedOnDark });
export const services = style({
  padding: "18px 26px 0",
  "@container": { "(max-width: 500px)": { paddingInline: 18 } },
});
export const listHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 12,
});
globalStyle(`${listHead} h2`, {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
});
globalStyle(`${exportLedger} .${listHead} h2`, {
  position: "static",
  width: "auto",
  height: "auto",
  clipPath: "none",
  fontSize: 16,
});
export const viewTabs = style({
  display: "flex",
  gap: 2,
  borderRadius: 10,
  padding: 3,
  background: t.paperSoft,
});
export const viewTab = style({
  minHeight: 38,
  padding: "0 14px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: t.muted,
  fontSize: 13,
  fontWeight: 650,
  selectors: {
    '&[data-state="active"]': { background: t.paper, color: t.accent },
  },
});
export const add = style({
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 6,
  minHeight: 44,
  border: 0,
  borderRadius: 10,
  padding: "0 13px",
  background: t.accent,
  color: t.onDark,
  fontSize: 13,
  fontWeight: 650,
  ":hover": { background: t.accentInk },
  ":active": { transform: "translateY(1px)" },
});
export const serviceList = style({ margin: 0, padding: 0, listStyle: "none" });
export const row = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 102px 86px 44px",
  gap: 8,
  alignItems: "center",
  minHeight: 72,
  borderBottom: `1px solid ${t.rule}`,
  padding: "8px 0",
  selectors: { '&[data-paused="true"]': { background: t.surface } },
  "@container": {
    "(max-width: 500px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto 44px",
      gap: "2px 8px",
    },
  },
});
export const serviceCopy = style({
  display: "flex",
  alignItems: "center",
  gap: 11,
  minWidth: 0,
  border: 0,
  borderRadius: 8,
  padding: "7px 0",
  textAlign: "left",
  background: "transparent",
  ":hover": { color: t.accent },
});
export const serviceText = style({ display: "grid", gap: 4, minWidth: 0 });
globalStyle(`${serviceCopy} strong`, {
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.3,
  overflowWrap: "anywhere",
});
globalStyle(`${serviceCopy} small`, {
  color: t.muted,
  fontSize: 11,
  lineHeight: 1.3,
  overflowWrap: "anywhere",
});
export const categoryMark = style({
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 12,
  background: t.paperSoft,
  color: t.accent,
  selectors: {
    '&[data-category="Entertainment"]': {
      background: "#f9e5f0",
      color: "#9c3670",
    },
    '&[data-category="Home"]': { background: "#dff3ee", color: "#216958" },
    '&[data-category="Health"]': { background: "#e8edff", color: "#4250aa" },
  },
});
globalStyle(`${row} time`, {
  display: "grid",
  gap: 4,
  "@container": {
    "(max-width: 500px)": {
      gridColumn: "1 / -1",
      display: "flex",
      gap: 5,
      alignItems: "baseline",
      padding: "0 0 5px 49px",
    },
  },
});
globalStyle(`${row} time span, ${row} output small`, {
  color: t.muted,
  fontSize: 10,
});
globalStyle(`${row} time b`, { fontSize: 11, fontWeight: 600 });
globalStyle(`${row} time[data-state="overdue"]`, { color: t.danger });
globalStyle(`${row} time[data-state="overdue"] span`, { color: t.danger });
globalStyle(`${row} time[data-state="soon"] b`, { color: t.ink });
globalStyle(`${row} output`, {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "end",
  gap: 2,
  "@container": { "(max-width: 500px)": { gridColumn: 2, gridRow: 1 } },
});
globalStyle(`${row} output strong`, {
  fontFamily: t.headingFont,
  fontSize: 15,
  fontWeight: 600,
});
export const toggle = style({
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  border: 0,
  borderRadius: 12,
  color: t.muted,
  background: t.paperSoft,
  transition: "background .16s ease, color .16s ease",
  ":hover": { background: t.accent, color: t.onDark },
  "@container": { "(max-width: 500px)": { gridColumn: 3, gridRow: 1 } },
});
export const empty = style({
  display: "grid",
  justifyItems: "start",
  gap: 10,
  padding: "36px 4px",
  color: t.ink,
});
globalStyle(`${empty} strong`, {
  fontFamily: t.headingFont,
  fontSize: 24,
  fontWeight: 600,
});
globalStyle(`${empty} p`, {
  maxWidth: 340,
  margin: "0 0 8px",
  color: t.muted,
  fontSize: 14,
  lineHeight: 1.5,
});
export const footer = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 8,
  padding: "18px 26px",
  color: t.muted,
  fontSize: 10,
});
export const saveError = style({ margin: 20, color: t.danger, fontSize: 13 });
export const editorBackdrop = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "color-mix(in srgb, var(--slop-ink) 42%, transparent)",
});
export const editor = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  zIndex: 101,
  width: "min(470px, calc(100vw - 30px))",
  transform: "translate(-50%, -50%)",
  border: 0,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  borderRadius: 16,
  padding: 0,
  color: t.ink,
  background: t.paper,
  outline: 0,
  boxShadow: "0 18px 40px color-mix(in srgb, var(--slop-ink) 18%, transparent)",
});
globalStyle(`${editor} form`, { padding: 24 });
globalStyle(`${editor} header`, {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  paddingBottom: 13,
  borderBottom: `1px dashed ${t.rule}`,
});
globalStyle(`${editor} header p`, {
  margin: 0,
  color: t.accent,
  fontSize: 9,
  fontWeight: 760,
  letterSpacing: ".14em",
  textTransform: "uppercase",
});
globalStyle(`${editor} header h2`, {
  margin: "7px 0 0",
  fontSize: 24,
  fontWeight: 680,
  letterSpacing: "-.03em",
});
export const dialogClose = style({
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  border: `1px solid ${t.ink}`,
  borderRadius: 6,
  padding: 0,
  background: t.paperSoft,
});
globalStyle(`${editor} label`, {
  display: "grid",
  gap: 5,
  marginTop: 14,
  color: t.muted,
  fontSize: 11,
  fontWeight: 760,
  letterSpacing: ".1em",
  textTransform: "uppercase",
});
globalStyle(`${editor} input`, {
  width: "100%",
  height: 44,
  border: 0,
  borderBottom: `1px solid ${t.ink}`,
  padding: 0,
  color: t.ink,
  background: "transparent",
  fontSize: 13,
  fontWeight: 650,
  letterSpacing: 0,
  textTransform: "none",
});
export const fieldTrigger = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  width: "100%",
  height: 44,
  border: 0,
  borderBottom: `1px solid ${t.ink}`,
  borderRadius: 0,
  padding: 0,
  color: t.ink,
  background: "transparent",
  fontSize: 13,
  fontWeight: 650,
  letterSpacing: 0,
  textTransform: "none",
  cursor: "pointer",
});
export const formGrid = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 13,
  "@media": { "(max-width: 420px)": { gridTemplateColumns: "1fr", gap: 0 } },
});
export const optional = style({
  color: `color-mix(in srgb, ${t.muted} 70%, transparent)`,
});
globalStyle(`${editor} footer`, {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto auto",
  gap: 7,
  marginTop: 22,
});
globalStyle(`${editor} footer button`, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  minHeight: 44,
  border: `1px solid ${t.ink}`,
  borderRadius: 6,
  padding: "0 11px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".04em",
  textTransform: "uppercase",
});
export const deleteBtn = style({ color: t.danger, background: "transparent" });
export const cancel = style({ background: "transparent" });
export const save = style({
  color: t.paper,
  background: t.accent,
  borderColor: `${t.accent} !important`,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', {
  display: "none !important",
});
globalStyle(`${exportLedger} .${row}`, {
  gridTemplateColumns: "minmax(0, 1fr) 110px 100px",
});
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transitionDuration: ".01ms !important",
      animationDuration: ".01ms !important",
    },
  },
});
export const iconSurface = style({
  display: "grid",
  width: "100%",
  height: "100%",
  placeItems: "center",
  background: "transparent",
});
export const iconGraphic = style({ width: "100%", height: "100%" });
