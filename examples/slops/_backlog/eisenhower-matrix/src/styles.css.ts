import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

const quadInk = {
  '&[data-quad="q1"]': { color: t.q1Accent, borderColor: t.q1Accent },
  '&[data-quad="q2"]': { color: t.q2Accent, borderColor: t.q2Accent },
  '&[data-quad="q3"]': { color: t.q3Accent, borderColor: t.q3Accent },
  '&[data-quad="q4"]': { color: t.q4Accent, borderColor: t.q4Accent },
} as const;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: t.surface, color: t.ink });
globalStyle("button, input, textarea, select", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", border: 0, background: "transparent", padding: 0, WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("::placeholder", { color: t.dim, opacity: 1 });
globalStyle("button:focus-visible, input:focus-visible, [data-checkbox-root]:focus-visible, [data-button-root]:focus-visible, [data-tooltip-trigger]:focus-visible, [data-dialog-close]:focus-visible, [data-radio-group-item]:focus-visible", {
  outline: `2px solid ${t.ink}`,
  outlineOffset: 2,
});
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

const sheet = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  padding: "16px 18px 14px",
  background: t.paper,
  boxShadow: `inset 0 0 0 1px ${t.border}, inset 0 0 0 3px ${t.paper}, inset 0 0 0 4px ${t.ruleStrong}`,
  fontVariantNumeric: "tabular-nums" as const,
  containerType: "inline-size",
};

export const canvas = style({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: "100%",
  background: t.surface,
});
export const blotter = style({
  ...sheet,
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
});
export const exportBlotter = style({
  ...sheet,
  overflow: "visible",
});

export const letterhead = style({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 8,
  borderBottom: `2px solid ${t.ink}`,
  "@container": { "(max-width: 520px)": { flexWrap: "wrap", alignItems: "flex-start" } },
});
export const titleGroup = style({ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: 2 });
export const title = style({
  width: "100%",
  minWidth: 0,
  margin: 0,
  border: 0,
  padding: 0,
  background: "transparent",
  fontFamily: t.headingFont,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  lineHeight: 1.15,
});
export const date = style({
  width: "100%",
  minWidth: 0,
  margin: 0,
  border: 0,
  padding: 0,
  background: "transparent",
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

export const leverage = style({
  display: "grid",
  gap: 3,
  minWidth: 132,
  color: t.q2Accent,
  fontFamily: t.mono,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
});
export const leverageRow = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
});
export const leverageValue = style({
  color: t.ink,
  fontSize: 16,
  letterSpacing: 0,
  lineHeight: 1,
});
export const meter = style({
  display: "block",
  overflow: "hidden",
  width: "100%",
  height: 6,
  border: `1px solid ${t.q2Accent}`,
  background: t.q2Bg,
});
export const meterFill = style({
  display: "block",
  height: "100%",
  background: t.q2Accent,
  transformOrigin: "left center",
  transition: "width 180ms ease",
});
export const activeCount = style({
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

export const axis = style({
  display: "flex",
  justifyContent: "space-around",
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
});

export const matrix = style({
  display: "grid",
  flex: 1,
  minHeight: 0,
  gridTemplateColumns: "1fr 1fr",
  gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 10,
  "@container": { "(max-width: 540px)": { gridTemplateColumns: "1fr", gridTemplateRows: "none" } },
});
export const exportMatrix = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  "@container": { "(max-width: 540px)": { gridTemplateColumns: "1fr" } },
});

export const quadrant = style({
  display: "flex",
  minHeight: 0,
  flexDirection: "column",
  gap: 8,
  overflow: "hidden",
  border: `1px solid ${t.border}`,
  borderTopWidth: 3,
  padding: "10px 10px 8px",
  background: t.paper,
  selectors: {
    '&[data-quad="q1"]': { borderTopColor: t.q1Accent, background: t.q1Bg },
    '&[data-quad="q2"]': { borderTopColor: t.q2Accent, background: t.q2Bg },
    '&[data-quad="q3"]': { borderTopColor: t.q3Accent, background: t.q3Bg },
    '&[data-quad="q4"]': { borderTopColor: t.q4Accent, background: t.q4Bg },
  },
});
export const exportQuadrant = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflow: "visible",
  border: `1px solid ${t.border}`,
  borderTopWidth: 3,
  padding: "10px 10px 8px",
  background: t.paper,
  selectors: {
    '&[data-quad="q1"]': { borderTopColor: t.q1Accent, background: t.q1Bg },
    '&[data-quad="q2"]': { borderTopColor: t.q2Accent, background: t.q2Bg },
    '&[data-quad="q3"]': { borderTopColor: t.q3Accent, background: t.q3Bg },
    '&[data-quad="q4"]': { borderTopColor: t.q4Accent, background: t.q4Bg },
  },
});

export const quadHeader = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 8,
  paddingBottom: 6,
  borderBottom: `1px dashed ${t.ruleStrong}`,
});
export const quadBadge = style({ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 });
export const roman = style({
  fontFamily: t.headingFont,
  fontSize: 18,
  fontWeight: 700,
  lineHeight: 1,
  selectors: quadInk,
});
export const quadText = style({ display: "grid", gap: 1, minWidth: 0 });
export const quadTitle = style({
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.15,
});
export const quadSub = style({ color: t.muted, fontSize: 10, lineHeight: 1.2 });
export const quadTag = style({
  flexShrink: 0,
  border: `1px solid ${t.border}`,
  borderRadius: 10,
  padding: "2px 6px",
  background: t.paper,
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 9,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});
export const quadAdd = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  background: t.paper,
  color: t.muted,
  selectors: {
    "&:hover": { color: t.ink, borderColor: t.ruleStrong },
  },
});

export const list = style({
  display: "flex",
  flex: 1,
  minHeight: 0,
  flexDirection: "column",
  gap: 5,
  margin: 0,
  padding: 0,
  overflowY: "auto",
  listStyle: "none",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
});
export const exportList = style({
  display: "flex",
  flexDirection: "column",
  gap: 5,
  margin: 0,
  padding: 0,
  overflow: "visible",
  listStyle: "none",
});

export const row = style({
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 7,
  border: "1px solid transparent",
  borderRadius: 4,
  padding: "4px 6px",
  background: t.paper,
  selectors: {
    "&:hover": { borderColor: t.border },
    '&[data-done="true"]': { opacity: 0.55 },
  },
});
globalStyle(`${row} [data-checkbox-root]`, {
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
  padding: 0,
  border: `1.5px solid ${t.muted}`,
  borderRadius: 3,
  background: "transparent",
  color: t.onPaper,
});
globalStyle(`${row} [data-checkbox-root][data-state="checked"]`, {
  background: t.ink,
  borderColor: t.ink,
});
export const taskText = style({
  width: "100%",
  minWidth: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "2px 0",
  background: "transparent",
  fontSize: 13,
  lineHeight: 1.35,
  selectors: {
    "&:focus": { borderBottomColor: t.ruleStrong },
    [`${row}[data-done="true"] &`]: { textDecoration: "line-through", color: t.muted },
  },
});
export const exportText = style({
  minWidth: 0,
  fontSize: 13,
  lineHeight: 1.35,
  selectors: {
    [`${row}[data-done="true"] &`]: { textDecoration: "line-through", color: t.muted },
  },
});

export const actions = style({
  display: "flex",
  alignItems: "center",
  gap: 3,
  opacity: 0,
  transition: "opacity 150ms ease",
  selectors: {
    [`${row}:hover &`]: { opacity: 1 },
    [`${row}:focus-within &`]: { opacity: 1 },
  },
});
export const stamps = style({ display: "flex", gap: 2 });
export const stamp = style({
  minWidth: 18,
  border: `1px solid ${t.border}`,
  borderRadius: 2,
  padding: "1px 4px",
  background: t.paper,
  color: t.muted,
  fontFamily: t.headingFont,
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.3,
  selectors: {
    '&:hover[data-quad="q1"]': { color: t.q1Accent, borderColor: t.q1Accent },
    '&:hover[data-quad="q2"]': { color: t.q2Accent, borderColor: t.q2Accent },
    '&:hover[data-quad="q3"]': { color: t.q3Accent, borderColor: t.q3Accent },
    '&:hover[data-quad="q4"]': { color: t.q4Accent, borderColor: t.q4Accent },
    '&[data-state="checked"][data-quad="q1"]': { color: t.q1Accent, borderColor: t.q1Accent },
    '&[data-state="checked"][data-quad="q2"]': { color: t.q2Accent, borderColor: t.q2Accent },
    '&[data-state="checked"][data-quad="q3"]': { color: t.q3Accent, borderColor: t.q3Accent },
    '&[data-state="checked"][data-quad="q4"]': { color: t.q4Accent, borderColor: t.q4Accent },
  },
});
export const remove = style({
  display: "grid",
  placeItems: "center",
  width: 20,
  height: 20,
  color: t.dim,
  selectors: {
    "&:hover": { color: t.danger },
  },
});

export const empty = style({
  margin: 0,
  padding: "10px 4px 4px",
  color: t.muted,
  fontFamily: t.headingFont,
  fontSize: 12,
  fontStyle: "italic",
});

export const tray = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  border: `1px solid ${t.border}`,
  borderLeft: `4px solid ${t.ink}`,
  padding: "8px 10px 10px",
  background: t.paperSoft,
});
export const trayHead = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
});
export const trayTitle = style({
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  minWidth: 0,
});
export const trayHeading = style({
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});
export const trayHint = style({
  overflow: "hidden",
  color: t.muted,
  fontSize: 11,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  "@container": { "(max-width: 520px)": { display: "none" } },
});
export const trayCount = style({
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 10,
  letterSpacing: "0.04em",
});
export const trayList = style({
  display: "flex",
  flexDirection: "column",
  gap: 5,
  margin: 0,
  padding: 0,
  listStyle: "none",
});
export const inboxRow = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 8,
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  padding: "5px 8px",
  background: t.paper,
});
export const dispatch = style({
  display: "flex",
  alignItems: "center",
  gap: 3,
});
export const dispatchLabel = style({
  marginRight: 2,
  color: t.dim,
  fontFamily: t.mono,
  fontSize: 9,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});
export const composer = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  alignItems: "center",
  gap: 6,
});
export const composerInput = style({
  width: "100%",
  minWidth: 0,
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  padding: "7px 9px",
  background: t.paper,
  fontSize: 13,
  outline: 0,
  selectors: {
    "&:focus": { borderColor: t.ruleStrong },
  },
});
export const add = style({
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  border: `1px solid ${t.ink}`,
  borderRadius: 4,
  background: t.ink,
  color: t.onPaper,
});
export const place = style({
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  padding: "7px 9px",
  background: t.paper,
  color: t.ink,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "rgba(35, 31, 28, 0.35)",
  backdropFilter: "blur(2px)",
});
export const dialog = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  zIndex: 101,
  display: "flex",
  width: "calc(100% - 32px)",
  maxWidth: 420,
  flexDirection: "column",
  gap: 12,
  border: `1px solid ${t.border}`,
  padding: 16,
  background: t.paper,
  boxShadow: "0 16px 36px rgba(35, 31, 28, 0.22)",
  transform: "translate(-50%, -50%)",
  outline: "none",
});
export const dialogHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
});
globalStyle(`${dialogHead} [data-dialog-title]`, {
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: 18,
  fontWeight: 700,
});
export const dialogClose = style({
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  color: t.muted,
});
export const dialogForm = style({ display: "grid", gap: 10 });
export const dialogField = style({
  display: "grid",
  gap: 4,
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});
globalStyle(`${dialogField} input`, {
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  padding: "8px 10px",
  background: t.paperSoft,
  color: t.ink,
  fontFamily: t.font,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: 0,
  textTransform: "none",
  outline: 0,
});
export const destGroup = style({
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 4,
});
export const dest = style({
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  padding: "7px 4px",
  background: t.paper,
  color: t.muted,
  fontFamily: t.headingFont,
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
  selectors: {
    "&:hover": { color: t.ink, borderColor: t.ruleStrong },
    '&[data-state="checked"]': { color: t.ink, borderColor: t.ink, background: t.paperSoft },
    '&[data-state="checked"][data-quad="q1"]': { color: t.q1Accent, borderColor: t.q1Accent, background: t.q1Bg },
    '&[data-state="checked"][data-quad="q2"]': { color: t.q2Accent, borderColor: t.q2Accent, background: t.q2Bg },
    '&[data-state="checked"][data-quad="q3"]': { color: t.q3Accent, borderColor: t.q3Accent, background: t.q3Bg },
    '&[data-state="checked"][data-quad="q4"]': { color: t.q4Accent, borderColor: t.q4Accent, background: t.q4Bg },
  },
});
export const dialogActions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
});
export const dialogCancel = style({
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  padding: "7px 10px",
  background: t.paperSoft,
  fontSize: 12,
  fontWeight: 700,
});
export const dialogSubmit = style({
  border: `1px solid ${t.ink}`,
  borderRadius: 4,
  padding: "7px 12px",
  background: t.ink,
  color: t.onPaper,
  fontSize: 12,
  fontWeight: 700,
});

export const tooltip = style({
  zIndex: 50,
  border: `1px solid ${t.border}`,
  borderRadius: 6,
  padding: "5px 8px",
  background: t.paper,
  color: t.ink,
  fontSize: 12,
  boxShadow: "0 6px 18px rgba(35, 31, 28, 0.16)",
});

export const error = style({
  overflowWrap: "anywhere",
  borderRadius: 6,
  padding: "8px 10px",
  background: t.paperSoft,
  color: t.danger,
  fontSize: 12,
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 4,
  padding: "3px 7px",
  background: t.paper,
  color: t.ink,
  fontSize: 11,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${canvas}`, { height: "auto", minHeight: 0 });
globalStyle(`html[data-slop-capture="static"] .${blotter}`, { height: "auto", minHeight: 0, overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${matrix}`, { height: "auto", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${list}`, { overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${actions}`, { display: "none" });
globalStyle(`html[data-slop-capture="static"] .${row}`, { gridTemplateColumns: "16px minmax(0, 1fr)" });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconSheet = style({
  display: "flex",
  width: 420,
  height: 420,
  flexDirection: "column",
  gap: 18,
  border: `14px solid ${t.border}`,
  borderRadius: 36,
  padding: 28,
  background: t.paper,
  boxShadow: "0 18px 40px rgba(35, 31, 28, 0.28)",
});
export const iconHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: `4px solid ${t.ink}`,
  paddingBottom: 12,
});
export const iconTitle = style({ width: 168, height: 16, borderRadius: 4, background: t.ink });
export const iconMeter = style({
  overflow: "hidden",
  width: 88,
  height: 10,
  border: `2px solid ${t.q2Accent}`,
  background: t.q2Bg,
});
export const iconMeterFill = style({
  display: "block",
  height: "100%",
  background: t.q2Accent,
});
export const iconGrid = style({
  display: "grid",
  flex: 1,
  gridTemplateColumns: "1fr 1fr",
  gridTemplateRows: "1fr 1fr",
  gap: 14,
});
export const iconQuad = style({
  border: "4px solid transparent",
  borderRadius: 12,
  selectors: {
    '&[data-quad="q1"]': { background: t.q1Bg, borderColor: t.q1Accent },
    '&[data-quad="q2"]': { background: t.q2Bg, borderColor: t.q2Accent },
    '&[data-quad="q3"]': { background: t.q3Bg, borderColor: t.q3Accent },
    '&[data-quad="q4"]': { background: t.q4Bg, borderColor: t.q4Accent },
    '&[data-filled="false"]': { opacity: 0.42 },
  },
});
