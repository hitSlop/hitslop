import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalFontFace("Flashcard Outfit", {
  src: 'url("../assets/fonts/Outfit.ttf") format("truetype")',
  fontWeight: "100 900",
  fontDisplay: "swap",
});
globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", {
  fontFamily: t.font,
  colorScheme: "light",
  fontSynthesis: "none",
});
globalStyle("html, body, #app", {
  margin: 0,
  width: "100%",
  height: "100%",
  minHeight: "100%",
});
globalStyle("body", { color: t.ink, background: "transparent" });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", {
  cursor: "pointer",
  border: 0,
  background: "transparent",
  padding: 0,
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle(":focus-visible", {
  outline: `3px solid ${t.brassHi}`,
  outlineOffset: 2,
});
globalStyle("::selection", { background: t.cardLine, color: t.ink });
globalStyle("input, textarea", { caretColor: t.margin });
export const catalogShell = style({
  containerType: "inline-size",
  display: "grid",
  gridTemplateRows: "auto auto minmax(150px, 1fr) auto",
  gap: 10,
  width: "100%",
  height: "100%",
  minHeight: 440,
  padding: "14px 18px 10px",
  background: t.wood,
  overflowY: "auto",
  "@container": { "(max-width: 420px)": { paddingInline: 12 } },
});
export const drawerHead = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 44,
});
export const deckMark = style({
  display: "grid",
  placeItems: "center",
  color: t.ivory,
  flexShrink: 0,
});
export const brassPlate = style({ flex: 1, minWidth: 0 });
export const deckSelect = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  minHeight: 44,
  fontFamily: t.headingFont,
  fontSize: 23,
  fontWeight: 600,
  color: t.ivory,
  textAlign: "left",
});
globalStyle(`${deckSelect} span`, {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const selectContent = style({
  zIndex: 1000,
  minWidth: 180,
  maxWidth: "calc(100vw - 24px)",
  padding: 5,
  borderRadius: 12,
  background: t.card,
  color: t.ink,
  boxShadow: "0 8px 24px #19295b33",
  outline: "none",
});
globalStyle(`${selectContent} [data-select-item]`, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 44,
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 14,
  cursor: "pointer",
  outline: "none",
  overflowWrap: "anywhere",
});
globalStyle(`${selectContent} [data-highlighted]`, { background: t.cardLine });
export const iconBtn = style({
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  borderRadius: 10,
  color: t.ivory,
  background: "transparent",
  flexShrink: 0,
  selectors: { "&:hover:not(:disabled)": { background: t.woodDeep } },
});
export const iconDanger = style({
  selectors: { "&:hover:not(:disabled)": { color: t.danger } },
});
export const boxRail = style({
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 3,
  padding: 3,
  borderRadius: 12,
  background: t.woodDeep,
});
export const boxTab = style({
  display: "grid",
  placeItems: "center",
  gap: 2,
  minHeight: 44,
  padding: "5px 2px",
  borderRadius: 9,
  color: t.ivory,
  fontSize: 11,
  fontWeight: 600,
  selectors: { '&[data-state="active"]': { background: t.card, color: t.ink } },
});
globalStyle(`${boxTab} strong`, {
  fontFamily: t.headingFont,
  fontSize: 14,
  fontWeight: 600,
});
export const studyWell = style({ minHeight: 150 });
export const cardStage = style({
  display: "block",
  width: "100%",
  height: "100%",
  perspective: 1000,
  textAlign: "left",
  borderRadius: 16,
});
export const cardInner = style({
  position: "relative",
  width: "100%",
  height: "100%",
  transformStyle: "preserve-3d",
});
export const cardFace = style({
  position: "absolute",
  inset: 0,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  gap: 12,
  padding: "16px 22px",
  borderRadius: 16,
  background: t.card,
  boxShadow: "0 6px 12px #152c7a26",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  textAlign: "left",
});
export const cardBack = style({
  transform: "rotateY(180deg)",
  background: t.answer,
});
export const cardIndex = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: t.inkMuted,
  fontSize: 11,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
});
globalStyle(`${cardFace} strong`, {
  display: "block",
  alignSelf: "center",
  maxHeight: "100%",
  overflowY: "auto",
  fontFamily: t.headingFont,
  fontSize: "clamp(25px, 6.8cqw, 38px)",
  fontWeight: 600,
  lineHeight: 1.14,
  letterSpacing: "-.02em",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
});
globalStyle(`${cardBack} strong`, {
  fontSize: "clamp(20px, 4.8cqw, 27px)",
  lineHeight: 1.3,
});
globalStyle(`${cardFace} em`, {
  color: t.inkMuted,
  fontSize: 11,
  fontStyle: "normal",
});
export const staticCard = style({
  display: "grid",
  gap: 24,
  minHeight: 220,
  padding: "20px 24px",
  borderRadius: 16,
  background: t.card,
  textAlign: "left",
});
globalStyle(`${staticCard} strong`, {
  fontFamily: t.headingFont,
  fontSize: 30,
  fontWeight: 600,
  lineHeight: 1.3,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});
export const emptyDeck = style({
  display: "grid",
  gap: 8,
  placeContent: "center",
  height: "100%",
  padding: "18px 16px",
  borderRadius: 16,
  background: t.card,
  textAlign: "center",
});
globalStyle(`${emptyDeck} strong`, {
  fontFamily: t.headingFont,
  fontSize: 25,
  fontWeight: 600,
});
globalStyle(`${emptyDeck} p`, { margin: 0, color: t.inkMuted, fontSize: 14 });
export const emptyAction = style({
  justifySelf: "center",
  minHeight: 44,
  padding: "7px 14px",
  borderRadius: 10,
  background: t.wood,
  color: t.card,
  fontSize: 14,
  fontWeight: 600,
});
export const studyBar = style({ display: "grid", gap: 4 });
export const reviewActions = style({ display: "flex", gap: 10 });
export const grade = style({
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 44,
  borderRadius: 12,
  color: t.ink,
  fontSize: 14,
  fontWeight: 700,
  ":active": { transform: "translateY(1px)" },
});
export const gradeAgain = style({ background: t.again });
export const gradeGood = style({ background: t.good });
export const reveal = style([
  grade,
  { width: "100%", color: t.ink, background: t.cardLine },
]);
globalStyle(`${reviewActions} kbd`, {
  font: "inherit",
  fontSize: 10,
  opacity: 0.75,
  border: "1px solid currentColor",
  padding: "1px 4px",
  borderRadius: 4,
});
export const tools = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 2,
});
globalStyle(`${tools} > span`, {
  marginRight: "auto",
  color: t.ivory,
  fontSize: 11,
});
export const error = style({
  position: "relative",
  gridColumn: "1 / -1",
  margin: 0,
  color: t.danger,
  fontSize: 12,
  textAlign: "center",
  overflowWrap: "anywhere",
});
globalStyle(`${error} [data-button-root]`, {
  marginLeft: 8,
  border: `1px solid ${t.card}`,
  borderRadius: 5,
  padding: "3px 7px",
  color: t.card,
  fontSize: 11,
});

export const dialogOverlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: t.overlay,
});
export const dialogCard = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 101,
  width: "calc(100% - 40px)",
  maxWidth: 360,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  border: 0,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  borderRadius: 16,
  background: t.card,
  boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
  outline: "none",
  color: t.ink,
});
export const dialogHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
});
globalStyle(`${dialogHead} h2, ${dialogHead} [data-dialog-title]`, {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.02em",
});
export const dialogClose = style({
  display: "grid",
  placeItems: "center",
  width: 44,
  height: 44,
  borderRadius: 6,
  color: t.inkMuted,
  selectors: { "&:hover": { color: t.ink, background: "rgba(0, 0, 0, 0.06)" } },
});
globalStyle(`${dialogCard} form`, {
  display: "flex",
  flexDirection: "column",
  gap: 10,
});
export const formField = style({ display: "grid", gap: 4 });
globalStyle(`${formField} span`, {
  color: t.margin,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
});
globalStyle(`${formField} input, ${formField} textarea`, {
  width: "100%",
  border: `1px solid color-mix(in srgb, ${t.ink} 16%, transparent)`,
  borderRadius: 4,
  padding: 8,
  background: t.cardWash,
  outline: 0,
});
export const dialogActions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 4,
});
export const btnPrimary = style({
  minHeight: 44,
  padding: "7px 12px",
  borderRadius: 8,
  background: t.ink,
  color: t.card,
  fontSize: 12,
  fontWeight: 800,
});
export const btnSecondary = style({
  minHeight: 44,
  padding: "7px 12px",
  borderRadius: 8,
  background: "transparent",
  color: t.ink,
  border: `1px solid ${t.ink}`,
  fontSize: 12,
  fontWeight: 800,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', {
  display: "none !important",
});
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animationDuration: "0s !important",
      transitionDuration: "0s !important",
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
export const exportShell = style([
  catalogShell,
  {
    height: "auto",
    minHeight: "100%",
    overflow: "visible",
    gridTemplateRows: "auto auto auto",
    padding: 18,
  },
]);
