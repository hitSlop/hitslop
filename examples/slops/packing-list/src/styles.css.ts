import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
const barcodeFill = `repeating-linear-gradient(90deg, ${t.ink} 0px, ${t.ink} 2px, transparent 2px, transparent 4px, ${t.ink} 4px, ${t.ink} 7px, transparent 7px, transparent 9px, ${t.ink} 9px, ${t.ink} 10px, transparent 10px, transparent 13px, ${t.ink} 13px, ${t.ink} 16px, transparent 16px, transparent 18px)`;
const airmailFill = `repeating-linear-gradient(-45deg, ${t.airmailRed} 0px, ${t.airmailRed} 12px, #ffffff 12px, #ffffff 18px, ${t.airmailBlue} 18px, ${t.airmailBlue} 30px, #ffffff 30px, #ffffff 36px)`;
const stamps = {
  '&[data-stamp="cobalt"]': { color: t.cobalt, background: t.cobaltBg },
  '&[data-stamp="vermilion"]': { color: t.vermilion, background: t.vermilionBg },
  '&[data-stamp="emerald"]': { color: t.emerald, background: t.emeraldBg },
  '&[data-stamp="amber"]': { color: t.amber, background: t.amberBg },
  '&[data-stamp="plum"]': { color: t.plum, background: t.plumBg },
  '&[data-stamp="slate"]': { color: t.slate, background: t.slateBg },
} as const;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: "transparent", color: t.ink, overflow: "hidden", fontSize: 13, lineHeight: 1.4 });
globalStyle("button, input, textarea, select", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", border: 0, background: "transparent", padding: 0, WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, input:focus-visible, textarea:focus-visible, [data-select-trigger]:focus-visible, [data-checkbox-root]:focus-visible, [data-tabs-trigger]:focus-visible, [data-tooltip-trigger]:focus-visible, [data-popover-trigger]:focus-visible, [data-dialog-close]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 1,
});

export const tag = style({
  containerType: "inline-size",
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  background: t.surface,
  border: `1px solid ${t.dark}`,
  position: "relative",
  overflow: "hidden",
});
export const exportTag = style({
  display: "flex",
  flexDirection: "column",
  background: t.surface,
  border: `1px solid ${t.dark}`,
});
export const airmail = style({ height: 8, width: "100%", background: airmailFill, flexShrink: 0 });
export const header = style({
  padding: "14px 20px 10px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  background: `linear-gradient(180deg, ${t.wash} 0%, ${t.surface} 100%)`,
  borderBottom: `2px dashed ${t.dark}`,
  flexShrink: 0,
});
export const eyeletRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
});
export const flagBtn = style({
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: `radial-gradient(circle at 35% 35%, ${t.paper} 0%, ${t.control} 100%)`,
  border: `2px solid ${t.dark}`,
  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.18), inset 0 1px 2px rgba(255, 255, 255, 0.9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  selectors: {
    "&:hover": { transform: "scale(1.08)", boxShadow: "0 3px 8px rgba(0, 0, 0, 0.25)", borderColor: t.accent },
  },
});
export const flagEmoji = style({ fontSize: 20, lineHeight: 1 });
export const flagPopover = style({
  zIndex: 100,
  width: 260,
  background: t.paper,
  borderRadius: 10,
  border: `1px solid ${t.dark}`,
  boxShadow: "0 12px 28px rgba(0, 0, 0, 0.25)",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
});
export const flagHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.1em",
  color: t.dim,
});
export const flagClose = style({
  fontSize: 12,
  color: t.muted,
  padding: "2px 4px",
  borderRadius: 4,
  selectors: { "&:hover": { background: t.control, color: t.ink } },
});
export const flagGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 4,
  maxHeight: 160,
  overflowY: "auto",
  padding: 2,
});
export const flagOpt = style({
  fontSize: 22,
  height: 34,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  selectors: {
    "&:hover": { background: t.wash, transform: "scale(1.15)" },
    '&[data-selected="true"]': { background: t.ready, outline: `2px solid ${t.accent}` },
  },
});
export const customFlag = style({
  display: "flex",
  gap: 4,
  borderTop: `1px solid ${t.border}`,
  paddingTop: 8,
});
export const customFlagInput = style({
  flex: 1,
  fontSize: 11,
  padding: "4px 6px",
  border: `1px solid ${t.dark}`,
  borderRadius: 4,
  background: t.paper,
});
export const applyFlag = style({
  fontSize: 11,
  fontWeight: 700,
  background: t.accent,
  color: t.onAccent,
  padding: "4px 10px",
  borderRadius: 4,
});
export const airline = style({
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.16em",
  color: t.muted,
  background: t.control,
  padding: "3px 8px",
  borderRadius: 4,
  border: `1px solid ${t.dark}`,
});
export const meta = style({ display: "flex", flexDirection: "column", gap: 10 });
export const field = style({ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 });
export const submeta = style({
  display: "grid",
  gridTemplateColumns: "1.1fr 1.5fr 1fr",
  gap: 12,
  alignItems: "end",
  "@container": {
    "(max-width: 480px)": { gridTemplateColumns: "1fr 1fr", gap: 8 },
    "(max-width: 350px)": { gridTemplateColumns: "1fr", gap: 6 },
  },
});
export const dateField = style({
  "@container": {
    "(max-width: 480px)": { gridColumn: "span 2" },
    "(max-width: 350px)": { gridColumn: "span 1" },
  },
});
export const metaLabel = style({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: t.dim,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
export const metaInput = style({
  border: 0,
  background: "transparent",
  fontSize: 13,
  fontWeight: 800,
  color: t.ink,
  letterSpacing: "0.02em",
  padding: "2px 0",
  borderBottom: "1px solid transparent",
  width: "100%",
  minWidth: 0,
  selectors: {
    "&:hover": { borderBottomColor: t.dim },
    "&:focus": { borderBottomColor: t.dim },
  },
});
export const titleInput = style({
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: t.ink,
});
export const destInput = style({
  fontFamily: t.mono,
  fontSize: 14,
  color: t.cobalt,
  textTransform: "uppercase",
});
export const passengerInput = style({ fontSize: 13, fontWeight: 800, color: t.ink });
export const dateInput = style({
  fontSize: 13,
  fontWeight: 700,
  color: t.muted,
  cursor: "pointer",
  padding: "1px 0",
});
globalStyle(`${dateInput}::-webkit-calendar-picker-indicator`, {
  cursor: "pointer",
  opacity: 0.65,
  filter: "sepia(0.8) saturate(1.8) hue-rotate(185deg)",
});

export const readiness = style({
  padding: "12px 20px",
  background: t.wash,
  borderBottom: `1px solid ${t.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  flexShrink: 0,
});
export const readinessRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
});
export const readinessStatus = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: "0.05em",
  color: t.ink,
});
export const readyBadge = style({
  fontFamily: t.mono,
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 4,
  background: t.ready,
  color: t.readyInk,
  fontWeight: 800,
  selectors: {
    '&[data-complete="true"]': { background: t.packedBg, color: t.emerald },
  },
});
export const quickActions = style({ display: "flex", gap: 6, flexWrap: "wrap" });
export const pill = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.03em",
  padding: "3px 8px",
  borderRadius: 4,
  background: t.control,
  color: t.muted,
  border: `1px solid ${t.dark}`,
  selectors: { "&:hover": { background: t.dark, color: t.ink } },
});
export const track = style({
  width: "100%",
  height: 8,
  background: t.dark,
  borderRadius: 4,
  overflow: "hidden",
  boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
});
export const fill = style({
  height: "100%",
  background: `linear-gradient(90deg, ${t.accent}, ${t.packed})`,
  transition: "width 0.3s ease",
  selectors: { '&[data-complete="true"]': { background: t.packed } },
});

export const tabs = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
  padding: "10px 20px",
  background: t.surface,
  borderBottom: `1px solid ${t.border}`,
  flexShrink: 0,
});
export const tab = style({
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 12,
  background: t.control,
  color: t.muted,
  border: 0,
  whiteSpace: "nowrap",
  selectors: {
    '&[data-state="active"]': { background: t.ink, color: t.onAccent },
  },
});
export const pillCount = style({ fontSize: 10, opacity: 0.8, marginLeft: 2 });

export const composer = style({
  display: "flex",
  gap: 6,
  padding: "10px 20px",
  background: t.paper,
  borderBottom: `1px solid ${t.border}`,
  alignItems: "center",
  flexWrap: "wrap",
  flexShrink: 0,
});
export const addInput = style({
  flex: "3 1 140px",
  minWidth: 140,
  padding: "6px 10px",
  border: `1px solid ${t.dark}`,
  borderRadius: 6,
  background: "#ffffff",
  fontSize: 13,
  color: t.ink,
});
globalStyle(`${addInput}::placeholder`, { color: t.dim });
export const selectTrigger = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: "#ffffff",
  border: `1px solid ${t.dark}`,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  color: t.ink,
  padding: "6px 8px",
  whiteSpace: "nowrap",
});
export const selectContent = style({
  zIndex: 40,
  minWidth: 140,
  padding: 4,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  background: t.paper,
  color: t.ink,
  boxShadow: "0 8px 24px rgba(23, 43, 77, 0.18)",
});
globalStyle(`${selectContent} [data-select-item]`, {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "7px 9px",
  borderRadius: 5,
  fontSize: 12,
  cursor: "pointer",
  outline: "none",
});
globalStyle(`${selectContent} [data-highlighted]`, { background: t.control });
globalStyle(`${selectContent} [data-selected]`, { fontWeight: 700 });
export const add = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 6,
  background: t.accent,
  color: t.onAccent,
  fontSize: 12,
  fontWeight: 700,
  flex: "0 0 auto",
  selectors: { "&:hover": { filter: "brightness(0.92)" } },
});

export const checklist = style({
  flex: 1,
  minHeight: 0,
  padding: "16px 20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 20,
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
});
export const exportList = style({
  padding: "16px 20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 20,
});
export const block = style({ display: "flex", flexDirection: "column", gap: 6 });
export const blockHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: 4,
  borderBottom: `1px solid ${t.border}`,
  gap: 8,
});
export const stamp = style({
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "2px 7px",
  borderRadius: 3,
  border: "1px dashed currentColor",
  boxShadow: "1px 1px 0 rgba(0, 0, 0, 0.06)",
  selectors: stamps,
});
export const blockCount = style({ fontSize: 11, fontWeight: 600, color: t.dim });
export const list = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  listStyle: "none",
  padding: 0,
  margin: 0,
});
export const row = style({
  display: "grid",
  gridTemplateColumns: "18px auto minmax(0, 1fr) 18px 22px",
  alignItems: "center",
  gap: 8,
  padding: "5px 8px",
  borderRadius: 6,
  background: t.paper,
  border: "1px solid transparent",
  selectors: {
    "&:hover": { borderColor: t.dark, background: "#ffffff" },
    '&[data-packed="true"]': { background: t.wash, opacity: 0.65 },
  },
});
globalStyle(`${exportList} .${row}`, { gridTemplateColumns: "18px auto minmax(0, 1fr) 18px" });
globalStyle(`${row} [data-checkbox-root]`, {
  width: 18,
  height: 18,
  borderRadius: 4,
  border: `1.5px solid ${t.muted}`,
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
  color: t.onAccent,
});
globalStyle(`${row} [data-checkbox-root][data-state="checked"]`, {
  background: t.packed,
  borderColor: t.emerald,
});
export const checkIcon = style({ fontSize: 12, fontWeight: 900, lineHeight: 1 });
export const qty = style({
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 700,
  color: t.dim,
  background: t.control,
  padding: "1px 5px",
  borderRadius: 3,
  flexShrink: 0,
});
export const itemText = style({
  minWidth: 0,
  width: "100%",
  border: 0,
  background: "transparent",
  fontSize: 13,
  fontWeight: 600,
  color: t.ink,
  padding: "2px 4px",
});
globalStyle(`${row}[data-packed="true"] .${itemText}`, {
  textDecoration: "line-through",
  color: t.muted,
});
export const star = style({
  color: t.faint,
  fontSize: 14,
  padding: 2,
  selectors: { '&[data-active="true"]': { color: t.star } },
});
export const remove = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  padding: 0,
  border: 0,
  background: "transparent",
  color: t.faint,
  opacity: 0,
  borderRadius: 4,
  selectors: {
    [`${row}:hover &`]: { opacity: 1 },
    [`${row}:focus-within &`]: { opacity: 1 },
    "&:hover": { color: t.stamp, background: t.vermilionBg },
  },
});

export const footer = style({
  marginTop: "auto",
  padding: "12px 20px 16px",
  background: t.wash,
  borderTop: `1px dashed ${t.dark}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexShrink: 0,
});
export const barcodeBlock = style({ display: "flex", flexDirection: "column", gap: 2 });
export const barcode = style({ height: 22, width: 140, background: barcodeFill });
export const barcodeCode = style({
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.15em",
  color: t.dim,
});
export const footerStamp = style({
  fontFamily: t.mono,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.14em",
  color: t.stamp,
  border: `2px solid ${t.stamp}`,
  borderRadius: 4,
  padding: "4px 10px",
  transform: "rotate(-3deg)",
  opacity: 0.85,
  selectors: {
    '&[data-complete="true"]': { color: t.emerald, borderColor: t.emerald },
  },
});

export const overlay = style({
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(2px)",
  zIndex: 100,
});
export const presetsCard = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "calc(100% - 32px)",
  maxWidth: 440,
  background: t.paper,
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 16px 36px rgba(0, 0, 0, 0.25)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  zIndex: 101,
  outline: "none",
});
export const presetsHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
globalStyle(`${presetsHead} h2, ${presetsHead} [data-dialog-title]`, {
  margin: 0,
  fontSize: 15,
  fontWeight: 800,
  color: t.ink,
});
export const presetList = style({ display: "flex", flexDirection: "column", gap: 8 });
export const presetItem = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${t.dark}`,
  background: t.paper,
  textAlign: "left",
  width: "100%",
  selectors: {
    "&:hover": { background: t.wash, borderColor: t.accent },
  },
});
export const presetInfo = style({ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 });
export const presetName = style({ fontWeight: 800, fontSize: 13, color: t.ink });
export const presetDesc = style({ fontSize: 11, color: t.muted });
export const presetAdd = style({
  fontSize: 11,
  fontWeight: 700,
  color: t.accent,
  background: t.cobaltBg,
  padding: "3px 8px",
  borderRadius: 4,
  whiteSpace: "nowrap",
});

export const empty = style({
  display: "grid",
  justifyItems: "center",
  padding: "28px 12px 16px",
  textAlign: "center",
  color: t.muted,
});
globalStyle(`${empty} h2`, { margin: "10px 0 4px", color: t.ink, fontSize: 16, fontWeight: 800 });
globalStyle(`${empty} p`, { margin: 0, fontSize: 12 });

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.paper,
  color: t.stamp,
  overflowWrap: "anywhere",
  margin: "0 20px 12px",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.control,
  color: t.ink,
  fontSize: 11,
});

export const tooltip = style({
  zIndex: 50,
  padding: "5px 8px",
  border: `1px solid ${t.border}`,
  borderRadius: 6,
  background: t.paper,
  color: t.ink,
  fontSize: 12,
  boxShadow: "0 6px 18px rgba(23, 43, 77, 0.16)",
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${tag}`, { height: "auto", minHeight: "100vh", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${checklist}`, { overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${row}`, { gridTemplateColumns: "18px auto minmax(0, 1fr) 18px" });
globalStyle(`html[data-slop-capture="static"] .${metaInput}`, { border: 0 });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconTag = style({
  width: 380,
  height: 480,
  background: t.surface,
  borderRadius: 20,
  border: `3px solid ${t.dark}`,
  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
  padding: "24px 24px 20px",
});
export const iconGrommet = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginBottom: 8,
});
export const iconLoop = style({
  width: 8,
  height: 36,
  borderLeft: `3px solid ${t.dark}`,
  borderRight: `3px solid ${t.dark}`,
  borderTop: `3px solid ${t.dark}`,
  borderRadius: "6px 6px 0 0",
  marginTop: -30,
});
export const iconEyelet = style({
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: `radial-gradient(circle at 35% 35%, ${t.paper} 0%, ${t.brass} 55%, ${t.brassInner} 100%)`,
  boxShadow: "0 3px 6px rgba(0, 0, 0, 0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});
export const iconHole = style({
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: t.dark,
  boxShadow: "inset 0 2px 5px rgba(0, 0, 0, 0.6)",
});
export const iconAirmail = style({
  height: 8,
  width: "100%",
  margin: "10px 0 14px",
  background: airmailFill,
});
export const iconHead = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: 16,
});
export const iconFlight = style({
  fontFamily: t.mono,
  fontSize: 16,
  fontWeight: 900,
  letterSpacing: "0.12em",
  color: t.dim,
});
export const iconDest = style({
  fontFamily: t.mono,
  fontSize: 38,
  fontWeight: 900,
  letterSpacing: "0.06em",
  color: t.cobalt,
});
export const iconChecks = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginBottom: 18,
});
export const iconRow = style({ display: "flex", alignItems: "center", gap: 10 });
export const iconBox = style({
  width: 20,
  height: 20,
  borderRadius: 4,
  border: `2px solid ${t.muted}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 900,
  selectors: {
    '&[data-done="true"]': { background: t.packed, borderColor: t.emerald, color: t.onAccent },
  },
});
export const iconLine = style({
  height: 10,
  borderRadius: 5,
  background: t.dark,
  selectors: {
    '&[data-length="long"]': { width: 140 },
    '&[data-length="med"]': { width: 100 },
    '&[data-length="short"]': { width: 80 },
  },
});
export const iconStamp = style({
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 900,
  padding: "1px 6px",
  borderRadius: 3,
  border: "1px dashed currentColor",
  marginLeft: "auto",
  selectors: stamps,
});
export const iconSeal = style({
  position: "absolute",
  right: 20,
  bottom: 58,
  border: `3px solid ${t.stamp}`,
  borderRadius: 8,
  padding: "6px 12px",
  transform: "rotate(-12deg)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  opacity: 0.85,
});
export const iconSealText = style({
  fontFamily: t.mono,
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: "0.15em",
  color: t.stamp,
});
export const iconSealSub = style({ fontSize: 9, fontWeight: 800, color: t.stamp });
export const iconBarcodeRow = style({
  marginTop: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
export const iconBarcode = style({ height: 24, width: 140, background: barcodeFill });
export const iconTagNum = style({
  fontFamily: t.mono,
  fontSize: 12,
  fontWeight: 800,
  color: t.dim,
});
