import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalFontFace("Reading Newsreader", {
  src: 'url("../assets/fonts/Newsreader.ttf") format("truetype")',
  fontWeight: "200 800",
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
  minHeight: "100%",
});
globalStyle("body", { background: t.surface, color: t.ink });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", {
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle(":focus-visible", {
  outline: `2px solid ${t.stamp}`,
  outlineOffset: 3,
});
globalStyle("::selection", { background: t.readingSoft, color: t.stamp });
globalStyle("input, textarea", { caretColor: t.stamp });
export const card = style({
  position: "relative",
  minHeight: "100%",
  background: t.surface,
  containerType: "inline-size",
});
export const pocket = style({
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: "24px 26px 18px",
  "@container": {
    "(max-width: 420px)": { padding: "20px 16px 16px", gap: 16 },
  },
});
export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  paddingBottom: 18,
  borderBottom: `1px solid ${t.border}`,
});
export const identity = style({
  flex: 1,
  minWidth: 0,
  display: "grid",
  gap: 7,
});
export const masthead = style({
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: "clamp(36px, 8cqw, 48px)",
  fontWeight: 550,
  lineHeight: 1.05,
  letterSpacing: "-.03em",
  color: t.stamp,
});
export const memberRow = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "2px 7px",
  minWidth: 0,
  color: t.muted,
});
export const memberName = style({
  width: 110,
  minWidth: 0,
  border: 0,
  padding: "3px 0",
  background: "transparent",
  color: t.ink,
  fontSize: 12,
  fontWeight: 600,
});
export const memberSince = style({
  flex: "1 1 125px",
  minWidth: 0,
  border: 0,
  padding: "3px 0",
  background: "transparent",
  fontSize: 12,
  color: t.muted,
});
export const finishedCount = style({
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  gap: 3,
  alignSelf: "stretch",
  minWidth: 66,
  padding: "10px 12px 17px",
  background: t.stamp,
  color: t.onAccent,
  clipPath: "polygon(0 0,100% 0,100% 100%,50% 88%,0 100%)",
});
globalStyle(`${finishedCount} strong`, {
  fontFamily: t.headingFont,
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 500,
});
globalStyle(`${finishedCount} span`, { fontSize: 10 });
export const composer = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
  gridTemplateAreas: '"title author add" "status status status"',
  gap: "8px 8px",
  alignItems: "center",
  padding: "12px",
  borderRadius: 12,
  background: t.control,
  "@container": {
    "(max-width: 420px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gridTemplateAreas: '"title add" "author add" "status status"',
    },
  },
});
const draft = {
  minWidth: 0,
  width: "100%",
  minHeight: 38,
  border: 0,
  borderBottom: `1px solid ${t.border}`,
  background: "transparent",
  padding: "6px 0",
  color: t.ink,
  fontSize: 13,
} as const;
export const titleDraft = style([draft, { gridArea: "title" }]);
export const authorDraft = style([draft, { gridArea: "author" }]);
globalStyle(`${composer} input::placeholder`, { color: t.muted, opacity: 1 });
export const statusGroup = style({
  gridArea: "status",
  display: "flex",
  gap: 4,
  alignItems: "center",
});
export const statusStamp = style({
  border: 0,
  borderRadius: 7,
  minHeight: 32,
  padding: "0 10px",
  fontSize: 11,
  background: "transparent",
  color: t.muted,
  fontWeight: 600,
  selectors: { '&[data-state="on"]': { background: t.paper, color: t.stamp } },
});
export const add = style({
  gridArea: "add",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  minHeight: 44,
  border: 0,
  borderRadius: 9,
  padding: "0 12px",
  background: t.stamp,
  color: t.onAccent,
  fontSize: 12,
  fontWeight: 650,
  ":active": { transform: "translateY(1px)" },
});
export const ledger = style({ minWidth: 0 });
export const head = style({ display: "none" });
export const list = style({
  display: "flex",
  flexDirection: "column",
  listStyle: "none",
  margin: 0,
  padding: 0,
});
export const row = style({
  display: "grid",
  gridTemplateColumns: "30px minmax(0, 1fr) 78px 26px",
  gridTemplateAreas: '"cover info status remove" "cover stars note note"',
  gap: "0 9px",
  alignItems: "center",
  padding: "9px 0",
  borderBottom: `1px solid ${t.rule}`,
  "@container": {
    "(max-width: 420px)": {
      gridTemplateColumns: "30px minmax(0, 1fr) 76px 26px",
      gap: "3px 7px",
    },
  },
});
export const bookSpine = style({
  gridArea: "cover",
  width: 29,
  height: 42,
  display: "grid",
  placeItems: "center",
  background: t.stampSoft,
  color: t.stamp,
  borderRadius: "3px 7px 7px 3px",
  borderLeft: `3px solid ${t.stamp}`,
  selectors: {
    '&[data-status="Reading"]': {
      background: t.readingSoft,
      color: t.reading,
      borderColor: t.reading,
    },
    '&[data-status="Read"]': {
      background: t.readSoft,
      color: t.read,
      borderColor: t.read,
    },
  },
  "@container": { "(max-width: 420px)": { width: 27, height: 40 } },
});
export const bookInfo = style({
  gridArea: "info",
  display: "grid",
  gap: 1,
  minWidth: 0,
});
export const titleCell = style({
  width: "100%",
  minWidth: 0,
  border: 0,
  padding: 0,
  margin: 0,
  resize: "none",
  overflow: "hidden",
  background: "transparent",
  fontFamily: t.headingFont,
  fontSize: 18,
  fontWeight: 550,
  lineHeight: 1.2,
  color: t.ink,
  overflowWrap: "anywhere",
});
export const authorCell = style({
  width: "100%",
  minWidth: 0,
  border: 0,
  padding: "2px 0",
  background: "transparent",
  fontSize: 11,
  lineHeight: 1.3,
  color: t.muted,
});
export const stars = style({
  gridArea: "stars",
  display: "flex",
  gap: 0,
  alignItems: "center",
  minWidth: 0,
});
export const star = style({
  display: "grid",
  placeItems: "center",
  width: 25,
  height: 26,
  flexShrink: 0,
  border: 0,
  padding: 0,
  background: "transparent",
  color: t.goldMuted,
  selectors: { '&[data-filled="true"]': { color: t.gold } },
  ":active": { transform: "scale(.9)" },
  "@container": { "(max-width: 420px)": { width: 23 } },
});
export const statusPill = style({
  gridArea: "status",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 8px",
  border: 0,
  borderRadius: 8,
  background: t.control,
  color: t.muted,
  fontSize: 11,
  fontWeight: 650,
  whiteSpace: "nowrap",
  selectors: {
    '&[data-status="Read"]': { background: t.readSoft, color: t.read },
    '&[data-status="Reading"]': { background: t.readingSoft, color: t.reading },
  },
});
export const selectContent = style({
  zIndex: 40,
  minWidth: 128,
  padding: 5,
  borderRadius: 12,
  background: t.paper,
  color: t.ink,
  boxShadow: "0 8px 24px #38233726",
});
globalStyle(`${selectContent} [data-select-item]`, {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  minHeight: 44,
  padding: "0 10px",
  borderRadius: 7,
  fontSize: 13,
  outline: "none",
  cursor: "pointer",
});
globalStyle(`${selectContent} [data-highlighted]`, { background: t.control });
export const remove = style({
  gridArea: "remove",
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 32,
  border: 0,
  padding: 0,
  background: "transparent",
  color: t.dim,
  ":hover": { color: t.danger },
});
export const foot = style({
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
  color: t.muted,
  fontSize: 11,
  paddingTop: 4,
});
export const empty = style({
  display: "grid",
  justifyItems: "start",
  padding: "24px 0",
  color: t.muted,
});
globalStyle(`${empty} h2`, {
  margin: "0 0 8px",
  fontFamily: t.headingFont,
  fontSize: 25,
  color: t.stamp,
  fontWeight: 500,
});
globalStyle(`${empty} p`, { margin: 0, fontSize: 13, lineHeight: 1.5 });
export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.control,
  color: t.stamp,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.paper,
  color: t.ink,
  fontSize: 11,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', {
  display: "none !important",
});
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transitionDuration: "0s !important",
      animationDuration: "0s !important",
      scrollBehavior: "auto",
    },
  },
});
export const exportCard = style({
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: "24px 26px 18px",
  background: t.surface,
  color: t.ink,
  containerType: "inline-size",
});
export const exportRow = style([
  row,
  {
    gridTemplateColumns: "30px minmax(0, 1fr) 78px",
    gridTemplateAreas: '"cover info status" "cover stars status"',
    "@container": {
      "(max-width: 420px)": { gridTemplateColumns: "30px minmax(0, 1fr) 76px" },
    },
  },
]);
export const iconSurface = style({
  display: "grid",
  width: "100%",
  height: "100%",
  placeItems: "center",
  background: "transparent",
});
export const iconGraphic = style({ width: "100%", height: "100%" });

export const noteButton = style({
  gridArea: "note",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 5,
  minHeight: 26,
  border: 0,
  padding: "0",
  color: t.stamp,
  background: "transparent",
  fontSize: 11,
});
export const notesOverlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "rgb(56 35 55 / 45%)",
});
export const notesDialog = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 101,
  width: "min(480px, calc(100vw - 28px))",
  maxHeight: "calc(100dvh - 28px)",
  overflowY: "auto",
  borderRadius: 16,
  padding: 22,
  background: t.paper,
  color: t.ink,
  boxShadow: "0 18px 46px #38233733",
  outline: 0,
});
export const notesHeader = style({
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 12,
});
export const notesTitle = style({
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: 27,
  fontWeight: 550,
  lineHeight: 1.15,
  color: t.stamp,
  overflowWrap: "anywhere",
});
export const notesClose = style({
  display: "grid",
  placeItems: "center",
  width: 36,
  height: 36,
  flexShrink: 0,
  border: 0,
  borderRadius: 8,
  background: t.control,
  color: t.muted,
});
export const notesDescription = style({
  margin: "12px 0 20px",
  color: t.muted,
  fontSize: 13,
  lineHeight: 1.5,
});
export const notesLabel = style({
  display: "block",
  marginBottom: 7,
  fontSize: 12,
  color: t.muted,
});
export const notesInput = style({
  display: "block",
  width: "100%",
  minHeight: 150,
  resize: "vertical",
  border: `1px solid ${t.border}`,
  borderRadius: 10,
  padding: 12,
  background: t.control,
  fontSize: 14,
  lineHeight: 1.6,
});
export const notesActions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 16,
});
export const notesCancel = style({
  minHeight: 44,
  border: 0,
  borderRadius: 9,
  padding: "0 16px",
  background: t.control,
  color: t.ink,
  fontSize: 13,
});
export const notesSave = style([
  notesCancel,
  { color: t.onAccent, background: t.stamp },
]);
export const exportNotes = style({
  gridColumn: "1 / -1",
  padding: "8px 0 4px 39px",
  color: t.muted,
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere",
});
globalStyle(`${exportNotes} strong`, { fontSize: 11, color: t.stamp });
globalStyle(`${exportNotes} p`, { margin: "4px 0 0", whiteSpace: "pre-wrap" });
