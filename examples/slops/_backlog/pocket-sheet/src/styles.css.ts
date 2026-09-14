import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "dark", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", {
  color: t.cellInk,
  background: t.canvas,
  overflow: "hidden",
  userSelect: "none",
  WebkitUserSelect: "none",
});
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button", {
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, input:focus-visible, [data-radio-group-item]:focus-visible, [data-dialog-close]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.focus}`,
  outlineOffset: 2,
});

export const canvas = style({
  width: "100%",
  height: "100%",
  display: "flex",
  background: t.canvas,
  padding: 10,
  overflow: "hidden",
  containerType: "inline-size",
});

export const chassis = style({
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  background: t.chassis,
  borderRadius: t.radius,
  border: `2px solid ${t.chassisBorder}`,
  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
});

export const topbar = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 14px",
  background: t.chassisHi,
  borderBottom: `1px solid ${t.chassisLine}`,
  gap: 12,
});

export const title = style({
  fontSize: 13.5,
  fontWeight: 700,
  color: t.titleInk,
  background: "transparent",
  border: "none",
  outline: "none",
  flex: 1,
  minWidth: 0,
  userSelect: "text",
});

export const toolbar = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
});

export const toolBtn = style({
  background: t.toolBg,
  border: `1px solid ${t.toolBorder}`,
  color: t.toolInk,
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  gap: 4,
  selectors: {
    "&:hover": { background: t.toolHover, color: t.titleInk, borderColor: t.accentMint },
    "&[data-active='true']": { background: t.accent, color: t.onAccent, borderColor: t.accent },
  },
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s" } },
});

export const formulaBar = style({
  display: "flex",
  alignItems: "center",
  background: t.chassisDeep,
  borderBottom: `2px solid ${t.chassisLine}`,
  padding: "4px 12px",
  gap: 8,
});

export const cellPill = style({
  fontFamily: t.mono,
  fontSize: 12,
  fontWeight: 800,
  color: t.accentMint,
  background: t.chassisInset,
  padding: "2px 8px",
  borderRadius: 4,
  border: `1px solid ${t.toolBorder}`,
  minWidth: 44,
  textAlign: "center",
  whiteSpace: "nowrap",
});

export const fxLabel = style({
  fontStyle: "italic",
  fontWeight: 900,
  fontSize: 13,
  color: t.statusInk,
  userSelect: "none",
});

export const formulaInput = style({
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  fontFamily: t.mono,
  fontSize: 12.5,
  fontWeight: 600,
  color: t.titleInk,
  userSelect: "text",
});

export const gridViewport = style({
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  background: t.sheet,
  position: "relative",
});

export const table = style({
  borderCollapse: "collapse",
  tableLayout: "fixed",
  width: "max-content",
});

export const cornerHeader = style({
  background: t.corner,
  borderRight: `2px solid ${t.headerRule}`,
  borderBottom: `2px solid ${t.headerRule}`,
  width: 42,
  minWidth: 42,
  height: 26,
  position: "sticky",
  top: 0,
  left: 0,
  zIndex: 3,
});

export const colHeader = style({
  background: t.headerBg,
  borderRight: `1px solid ${t.sheetBorder}`,
  borderBottom: `2px solid ${t.headerRule}`,
  fontSize: 11,
  fontWeight: 800,
  color: t.headerInk,
  textAlign: "center",
  height: 26,
  width: 108,
  minWidth: 108,
  userSelect: "none",
  position: "sticky",
  top: 0,
  zIndex: 2,
});

export const rowHeader = style({
  background: t.headerBg,
  borderBottom: `1px solid ${t.sheetBorder}`,
  borderRight: `2px solid ${t.headerRule}`,
  fontSize: 10.5,
  fontWeight: 800,
  color: t.headerInk,
  textAlign: "center",
  width: 42,
  minWidth: 42,
  userSelect: "none",
  position: "sticky",
  left: 0,
  zIndex: 2,
});

export const gridCell = style({
  borderRight: `1px solid ${t.sheetBorder}`,
  borderBottom: `1px solid ${t.sheetBorder}`,
  height: 24,
  width: 108,
  minWidth: 108,
  maxWidth: 108,
  padding: "0 6px",
  fontSize: 12,
  fontWeight: 500,
  color: t.cellInk,
  background: t.sheet,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  userSelect: "none",
  position: "relative",
});

export const stripe = style({ background: t.sheetStripe });
export const selected = style({ background: t.selectBg });
export const activeCell = style({
  outline: `2px solid ${t.accent}`,
  outlineOffset: -2,
  background: t.cellEdit,
  zIndex: 1,
});
export const bold = style({ fontWeight: 800 });
export const alignLeft = style({ textAlign: "left" });
export const alignCenter = style({ textAlign: "center" });
export const alignRight = style({ textAlign: "right" });
export const cellError = style({ color: t.error, fontWeight: 700 });

export const cellEditInput = style({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: "none",
  outline: "none",
  fontFamily: "inherit",
  fontSize: 12,
  padding: "0 6px",
  background: t.cellEdit,
  color: "#000000",
  zIndex: 3,
  userSelect: "text",
});

export const visualTag = style({
  display: "inline-block",
  background: t.tagBg,
  color: t.tagInk,
  border: `1px solid ${t.tagBorder}`,
  borderRadius: 10,
  padding: "1px 8px",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1.2,
});

export const visualProgress = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  width: "100%",
});

export const progressTrack = style({
  flex: 1,
  height: 6,
  background: t.progressTrack,
  borderRadius: 3,
  overflow: "hidden",
});

export const progressFill = style({
  height: "100%",
  background: t.accent,
  borderRadius: 3,
});

export const progressLabel = style({ fontSize: 10, fontVariantNumeric: "tabular-nums" });

export const visualRating = style({
  color: t.rating,
  fontSize: 11,
});

export const statusbar = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 14px",
  background: t.chassisDeep,
  borderTop: `1px solid ${t.chassisLine}`,
  fontSize: 11,
  color: t.statusInk,
  gap: 12,
});

export const stats = style({
  display: "flex",
  gap: 12,
  fontFamily: t.mono,
});

export const statItem = style({
  color: t.titleInk,
  fontWeight: 700,
});

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  color: t.accentMint,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.toolBorder}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.toolBg,
  color: t.titleInk,
  fontSize: 11,
});

export const overlay = style({
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
  border: `1px solid ${t.chassisLine}`,
  borderRadius: 12,
  background: t.chassisHi,
  color: t.titleInk,
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
  outline: "none",
});

export const dialogHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
});
globalStyle(`${dialogHead} h2, ${dialogHead} [data-dialog-title]`, {
  margin: 0,
  fontSize: 15,
  fontWeight: 800,
});

export const dialogClose = style({
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 26,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: t.statusInk,
  selectors: {
    "&:hover": { color: t.titleInk, background: t.toolBg },
  },
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s" } },
});

export const dialogCopy = style({
  margin: 0,
  fontSize: 12,
  color: t.statusInk,
  lineHeight: 1.4,
});

export const formField = style({
  display: "grid",
  gap: 6,
});
globalStyle(`${formField} > span`, {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: t.statusInk,
});

export const radioRow = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
});

export const radioItem = style({
  border: `1px solid ${t.toolBorder}`,
  borderRadius: 8,
  background: t.toolBg,
  color: t.toolInk,
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 10px",
  textAlign: "center",
  selectors: {
    '&[data-state="checked"]': {
      background: t.accent,
      color: t.onAccent,
      borderColor: t.accent,
    },
  },
});

export const dialogActions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 4,
});

export const btnGhost = style({
  border: `1px solid ${t.toolBorder}`,
  borderRadius: 8,
  background: "transparent",
  color: t.toolInk,
  fontSize: 12,
  fontWeight: 700,
  padding: "7px 12px",
  selectors: {
    "&:hover": { color: t.titleInk, borderColor: t.accentMint },
  },
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s" } },
});

export const btnPrimary = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: `1px solid ${t.accent}`,
  borderRadius: 8,
  background: t.accent,
  color: t.onAccent,
  fontSize: 12,
  fontWeight: 700,
  padding: "7px 12px",
  selectors: {
    "&:hover": { background: t.accentMint, borderColor: t.accentMint, color: t.chassis },
  },
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s" } },
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconBody = style({
  width: 440,
  height: 440,
  background: t.chassis,
  borderRadius: 40,
  border: `12px solid ${t.chassisBorder}`,
  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
  display: "flex",
  flexDirection: "column",
  padding: 16,
  gap: 12,
  overflow: "hidden",
});
export const iconFx = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: t.chassisHi,
  borderRadius: 12,
  padding: "8px 12px",
  border: `2px solid ${t.toolBorder}`,
});
export const iconFxTag = style({
  color: t.accentMint,
  fontWeight: 900,
  fontStyle: "italic",
  fontSize: 16,
});
export const iconFxText = style({
  fontFamily: t.mono,
  fontSize: 15,
  fontWeight: 700,
  color: t.onAccent,
});
export const iconGrid = style({
  flex: 1,
  background: t.sheet,
  borderRadius: 16,
  border: `3px solid ${t.headerRule}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
});
export const iconRow = style({
  display: "flex",
  flex: 1,
  borderBottom: `2px solid ${t.sheetBorder}`,
  selectors: {
    "&:last-child": { borderBottom: "none" },
  },
});
export const iconHeaderRow = style({
  background: t.headerBg,
  borderBottom: `3px solid ${t.headerRule}`,
});
export const iconCell = style({
  flex: 1,
  borderRight: `2px solid ${t.sheetBorder}`,
  display: "flex",
  alignItems: "center",
  padding: "0 8px",
  fontFamily: t.mono,
  fontSize: 13,
  fontWeight: 700,
  color: t.cellInk,
  selectors: {
    "&:last-child": { borderRight: "none" },
  },
});
export const iconCorner = style({ width: 36, flex: "none", background: t.corner });
export const iconColHdr = style({ justifyContent: "center", color: t.headerInk, fontWeight: 900 });
export const iconRowHdr = style({
  width: 36,
  flex: "none",
  justifyContent: "center",
  background: t.headerBg,
  color: t.headerInk,
});
export const iconLeft = style({ justifyContent: "flex-start" });
export const iconRight = style({ justifyContent: "flex-end" });
export const iconCenter = style({ justifyContent: "center", color: t.rating });
export const iconBold = style({ fontWeight: 900 });
export const iconSelected = style({
  outline: `3px solid ${t.accent}`,
  outlineOffset: -3,
  background: t.cellEdit,
  position: "relative",
});
export const iconHandle = style({
  position: "absolute",
  bottom: -4,
  right: -4,
  width: 8,
  height: 8,
  background: t.accent,
  border: `1px solid ${t.onAccent}`,
});
export const iconPill = style({
  justifyContent: "center",
  fontSize: 10,
  color: t.tagInk,
  background: t.tagBg,
  borderRadius: 6,
  margin: 4,
  height: "calc(100% - 8px)",
});
export const iconPillLive = style({
  color: "#1e40af",
  background: "#dbeafe",
});
export const iconBar = style({
  justifyContent: "center",
  padding: "0 10px",
});
export const iconBarFill = style({
  width: "72%",
  height: 8,
  borderRadius: 4,
  background: t.accent,
});
export const iconStatus = style({
  display: "flex",
  justifyContent: "space-between",
  fontFamily: t.mono,
  fontSize: 11.5,
  fontWeight: 800,
  color: t.statusInk,
  padding: "0 4px",
});

export const exportRoot = style({
  display: "flex",
  flexDirection: "column",
  gap: 0,
  padding: 16,
  background: t.canvas,
});
export const exportChassis = style({
  background: t.chassis,
  borderRadius: 16,
  border: `2px solid ${t.chassisBorder}`,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
});
export const exportHead = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  background: t.chassisHi,
  color: t.titleInk,
});
export const exportTitle = style({
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
});
export const exportMeta = style({
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 700,
  color: t.accentMint,
});
export const exportGrid = style({
  overflow: "auto",
  background: t.sheet,
});
