import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import fontUrl from "../assets/fonts/Barlow-SemiBold.ttf?url";
import theme from "../theme";
const t = theme.vars;
globalFontFace("Decision Barlow", {
  src: `url("${fontUrl}") format("truetype")`,
  fontWeight: 600,
  fontDisplay: "swap",
});
globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", {
  colorScheme: "light",
  fontFamily: t.font,
  fontSynthesis: "none",
  scrollbarColor: `${t.brass} ${t.surface}`,
});
globalStyle("html, body, #app", {
  width: "100%",
  minHeight: "100%",
  margin: 0,
});
globalStyle("body", { color: t.ink, background: t.surface });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("::selection", { background: t.brassSoft, color: t.ink });
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transitionDuration: "0s !important",
      animationDuration: "0s !important",
    },
  },
});
const focus = { outline: `2px solid ${t.pro}`, outlineOffset: 3 };

// Graphite housing, with a single ivory working bed.
export const desk = style({
  minHeight: "100dvh",
  containerType: "inline-size",
  background: t.surface,
  padding: 12,
});
export const letter = style({
  display: "flex",
  minHeight: "calc(100dvh - 24px)",
  flexDirection: "column",
  color: t.ink,
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
  borderRadius: 9,
  overflow: "hidden",
});
export const exportLetter = style([
  letter,
  {
    minHeight: 0,
    borderRadius: 0,
    containerType: "inline-size",
    border: `12px solid ${t.surface}`,
  },
]);
export const letterhead = style({
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "10px 16px 15px",
  background: t.surface,
  color: t.onSurface,
});
export const metaRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "0 12px",
});
export const stamp = style({
  margin: 0,
  color: t.onSurface,
  fontFamily: t.headingFont,
  fontSize: 21,
  fontWeight: 600,
});
export const dateField = style({
  width: "17ch",
  minHeight: 44,
  border: 0,
  padding: 0,
  color: t.mutedOnSurface,
  background: "transparent",
  fontSize: 13,
  textAlign: "right",
  ":focus-visible": {
    outline: `2px solid ${t.surfaceFocus}`,
    outlineOffset: 2,
  },
});
export const questionRow = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
});
export const whether = style({ color: t.mutedOnSurface, fontSize: 14 });
export const question = style({
  width: "100%",
  minWidth: 0,
  minHeight: 44,
  margin: 0,
  border: 0,
  padding: "2px 0 5px",
  background: "transparent",
  color: t.onSurface,
  fontFamily: t.headingFont,
  fontSize: 30,
  fontWeight: 600,
  lineHeight: 1.2,
  resize: "none",
  overflow: "hidden",
  overflowWrap: "anywhere",
  "::placeholder": { color: t.mutedOnSurface, opacity: 1 },
  ":focus-visible": { outline: "none", boxShadow: `0 2px 0 ${t.surfaceFocus}` },
});

// The mechanical readout is shallow, leaving the reasons in charge.
export const scale = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  padding: "2px 0",
  "@container": { "(max-width: 560px)": { flexDirection: "column", gap: 0 } },
});
export const beamHold = style({
  position: "relative",
  width: 240,
  height: 78,
  flexShrink: 0,
});
export const post = style({
  position: "absolute",
  left: "50%",
  bottom: 0,
  width: 3,
  height: 28,
  transform: "translateX(-50%)",
  background: t.brass,
});
export const fulcrum = style({
  position: "absolute",
  left: "50%",
  bottom: 24,
  width: 0,
  height: 0,
  transform: "translateX(-50%)",
  borderLeft: "9px solid transparent",
  borderRight: "9px solid transparent",
  borderBottom: `16px solid ${t.brass}`,
});
export const beam = style({
  position: "absolute",
  top: 10,
  right: 6,
  left: 6,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  transformOrigin: "center 2px",
});
export const bar = style({
  position: "absolute",
  top: 1,
  right: 26,
  left: 26,
  height: 3,
  borderRadius: 1,
  background: t.brass,
});
export const hang = style({
  display: "flex",
  width: 52,
  flexDirection: "column",
  alignItems: "center",
  transformOrigin: "center 2px",
});
export const chain = style({ width: 1.5, height: 20, background: t.brass });
export const pan = style({
  display: "grid",
  minWidth: 48,
  minHeight: 30,
  placeItems: "center",
  border: `2px solid ${t.brass}`,
  borderTop: 0,
  borderRadius: "0 0 16px 16px",
  padding: "3px 8px 5px",
  fontFamily: t.headingFont,
  fontSize: 18,
  fontWeight: 600,
  selectors: {
    '&[data-side="for"]': {
      color: t.pro,
      borderColor: t.surfacePro,
      background: t.proSoft,
    },
    '&[data-side="against"]': {
      color: t.con,
      borderColor: t.surfaceCon,
      background: t.conSoft,
    },
  },
});
export const delta = style({
  margin: "8px 0",
  fontSize: 14,
  color: t.mutedOnSurface,
  selectors: {
    '&[data-lean="for"]': { color: t.surfacePro },
    '&[data-lean="against"]': { color: t.surfaceCon },
  },
});

// Reason lists, importance controls, and direct entry.
export const spread = style({
  display: "grid",
  flex: 1,
  gridTemplateColumns: "1fr 1fr",
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "1fr" } },
});
export const column = style({
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  gap: 8,
  padding: "20px 20px 14px",
  selectors: {
    '&[data-side="against"]': { borderLeft: `1px solid ${t.rule}` },
  },
  "@container": {
    "(max-width: 560px)": {
      padding: "18px 16px 14px",
      borderBottom: `1px solid ${t.rule}`,
    },
  },
});
export const columnHead = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  paddingBottom: 9,
  borderBottom: `1px solid ${t.rule}`,
});
export const columnTitle = style({
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: 26,
  fontWeight: 600,
  color: t.pro,
  selectors: { [`${column}[data-side="against"] &`]: { color: t.con } },
});
export const columnHint = style({ color: t.muted, fontSize: 12 });
export const columnTotal = style({
  color: t.muted,
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
});
export const list = style({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  gap: 0,
  margin: 0,
  padding: 0,
  listStyle: "none",
});
export const row = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "7px 0",
  borderBottom: `1px solid ${t.rule}`,
  selectors: {
    [`${exportLetter} &`]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      alignItems: "start",
      gap: 12,
    },
  },
});
export const reason = style({
  display: "block",
  width: "100%",
  minWidth: 0,
  minHeight: 44,
  border: 0,
  padding: "10px 0",
  background: "transparent",
  color: t.ink,
  fontSize: 15,
  lineHeight: "22px",
  resize: "none",
  overflow: "hidden",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
  "::placeholder": { color: t.muted, opacity: 1 },
  ":focus-visible": { outline: "none", boxShadow: `0 2px 0 ${t.pro}` },
});
export const weight = style({ display: "flex", alignItems: "center", gap: 12 });
export const weightLabel = style({
  color: t.muted,
  fontSize: 12,
  whiteSpace: "nowrap",
});
export const weightNum = style({
  color: t.ink,
  fontFamily: t.headingFont,
  fontSize: 17,
  paddingTop: 10,
});
export const slider = style({
  position: "relative",
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 55,
  width: 86,
  height: 44,
  touchAction: "none",
  userSelect: "none",
});
export const track = style({
  position: "relative",
  width: "100%",
  height: 4,
  borderRadius: 2,
  background: t.paperSoft,
});
export const range = style({
  position: "absolute",
  height: "100%",
  background: t.pro,
  borderRadius: 2,
  selectors: { [`${column}[data-side="against"] &`]: { background: t.con } },
});
export const thumb = style({
  display: "block",
  width: 22,
  height: 26,
  border: `1px solid ${t.muted}`,
  borderRadius: 5,
  background: t.paper,
  boxShadow: "0 2px 4px rgba(30,37,29,.2)",
  cursor: "grab",
  ":focus-visible": focus,
  ":active": { cursor: "grabbing", background: t.brassSoft },
  "::before": { content: '""', position: "absolute", inset: "-9px -11px" },
});
export const remove = style({
  display: "grid",
  width: 44,
  height: 44,
  flexShrink: 0,
  placeItems: "center",
  border: 0,
  borderRadius: 4,
  padding: 0,
  color: t.muted,
  background: "transparent",
  ":hover": { color: t.danger, background: t.conSoft },
  ":focus-visible": focus,
});
export const empty = style({
  margin: 0,
  padding: "20px 0",
  minHeight: 84,
  color: t.muted,
  fontSize: 14,
  lineHeight: 1.6,
});
export const composer = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 44px",
  alignItems: "center",
  gap: "0 12px",
  paddingTop: 5,
});
export const addInput = style({
  gridColumn: "1 / -1",
  width: "100%",
  minWidth: 0,
  minHeight: 44,
  border: 0,
  borderBottom: `1px solid ${t.rule}`,
  padding: "10px 0",
  background: "transparent",
  fontSize: 14,
  "::placeholder": { color: t.muted, opacity: 1 },
  ":focus-visible": { outline: "none", boxShadow: `0 2px 0 ${t.pro}` },
});
export const add = style({
  display: "grid",
  width: 44,
  height: 44,
  placeItems: "center",
  border: 0,
  borderRadius: 5,
  padding: 0,
  color: t.pro,
  background: t.proSoft,
  selectors: {
    [`${column}[data-side="against"] &`]: {
      color: t.con,
      background: t.conSoft,
    },
  },
  ":hover": { boxShadow: "inset 0 1px 4px rgba(30,37,29,.15)" },
  ":focus-visible": focus,
});

// The owner records the conclusion; the arithmetic never makes the decision.
export const foot = style({
  display: "grid",
  gridTemplateColumns: "160px minmax(0, 1fr)",
  alignItems: "start",
  gap: 20,
  marginTop: "auto",
  borderTop: `1px solid ${t.rule}`,
  padding: "16px 20px",
  background: t.paperSoft,
  "@container": {
    "(max-width: 560px)": {
      gridTemplateColumns: "1fr",
      gap: 12,
      padding: "16px",
    },
  },
});
export const seal = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  minHeight: 44,
  border: `1px solid ${t.muted}`,
  borderRadius: 5,
  padding: "10px 12px",
  color: t.ink,
  background: t.paper,
  fontSize: 14,
  textAlign: "left",
  ":focus-visible": focus,
});
export const sealFace = style({ pointerEvents: "none" });
export const selectContent = style({
  zIndex: 70,
  minWidth: "var(--bits-select-anchor-width)",
  overflow: "hidden",
  borderRadius: 8,
  padding: 4,
  background: t.paper,
  color: t.ink,
  boxShadow: "0 8px 24px rgba(30,37,29,.2)",
});
export const selectItem = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 44,
  borderRadius: 4,
  padding: "0 12px",
  fontSize: 14,
  outline: 0,
  selectors: { "&[data-highlighted]": { color: t.pro, background: t.proSoft } },
});
export const verdict = style({
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  gap: 4,
});
export const verdictLabel = style({ color: t.muted, fontSize: 13 });
export const verdictText = style({
  width: "100%",
  minHeight: 48,
  border: 0,
  borderRadius: 0,
  padding: "6px 0",
  resize: "none",
  overflow: "hidden",
  background: "transparent",
  fontSize: 15,
  lineHeight: "23px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  "::placeholder": { color: t.muted, opacity: 1 },
  ":focus-visible": { outline: "none", boxShadow: `0 2px 0 ${t.pro}` },
});
export const verdictExport = style({
  margin: 0,
  minHeight: 48,
  color: t.ink,
  fontSize: 15,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
});
export const srOnly = style({
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  margin: -1,
});
export const error = style({
  margin: "0 20px 12px",
  padding: 12,
  color: t.con,
  background: t.paper,
  overflowWrap: "anywhere",
  fontSize: 14,
});
globalStyle(`${error} button`, {
  minHeight: 44,
  padding: "6px 12px",
  color: t.ink,
  background: t.paperSoft,
  border: `1px solid ${t.muted}`,
  borderRadius: 4,
});

// A miniature weighing instrument with the same two opposing beds.
export const iconSurface = style({
  display: "grid",
  width: "100%",
  height: "100%",
  placeItems: "center",
});
export const iconTile = style({
  display: "grid",
  width: 432,
  height: 432,
  placeItems: "center",
  borderRadius: 48,
  background: t.surface,
  boxShadow: "0 14px 26px rgba(30,37,29,.22)",
});
export const iconSheet = style({
  position: "relative",
  display: "flex",
  width: 358,
  height: 350,
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 14,
  background: t.paper,
});
export const iconHead = style({
  display: "flex",
  height: 126,
  alignItems: "center",
  justifyContent: "center",
  background: t.surface,
});
export const iconBeam = style({
  position: "relative",
  display: "flex",
  width: 224,
  alignItems: "flex-start",
  justifyContent: "space-between",
  transformOrigin: "center 4px",
});
export const iconBar = style({
  position: "absolute",
  top: 4,
  right: 18,
  left: 18,
  height: 6,
  borderRadius: 2,
  background: t.brass,
});
export const iconPan = style({
  width: 50,
  height: 34,
  marginTop: 18,
  border: `4px solid ${t.brass}`,
  borderTop: 0,
  borderRadius: "0 0 18px 18px",
  background: t.proSoft,
  selectors: { "&:last-child": { background: t.conSoft } },
});
export const iconCols = style({
  display: "grid",
  flex: 1,
  gridTemplateColumns: "1fr 1fr",
  gap: 26,
  padding: "24px 26px",
});
export const iconCol = style({
  display: "flex",
  flexDirection: "column",
  gap: 16,
});
export const iconLine = style({
  height: 12,
  borderRadius: 3,
  selectors: {
    '&[data-side="for"]': { background: t.pro },
    '&[data-side="against"]': { background: t.con },
  },
});
