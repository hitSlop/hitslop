import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
const barcodeFill = `repeating-linear-gradient(90deg, ${t.ink} 0px, ${t.ink} 2px, transparent 2px, transparent 4px, ${t.ink} 4px, ${t.ink} 7px, transparent 7px, transparent 9px, ${t.ink} 9px, ${t.ink} 10px, transparent 10px, transparent 13px, ${t.ink} 13px, ${t.ink} 16px, transparent 16px, transparent 18px)`;
const stamps = {
  '&[data-tag="flight"]': { background: t.fltBg, color: t.flt },
  '&[data-tag="hotel"]': { background: t.htlBg, color: t.htl },
  '&[data-tag="dining"]': { background: t.dineBg, color: t.dine },
  '&[data-tag="train"]': { background: t.railBg, color: t.rail },
  '&[data-tag="explore"]': { background: t.actBg, color: t.act },
} as const;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: "transparent", color: t.ink, overflow: "hidden", fontVariantNumeric: "tabular-nums" });
globalStyle("button, input, textarea, select", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", border: 0, background: "transparent", padding: 0, WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, input:focus-visible, [data-select-trigger]:focus-visible, [data-checkbox-root]:focus-visible, [data-tabs-trigger]:focus-visible, [data-tooltip-trigger]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.focus}`,
  outlineOffset: 1,
});
globalStyle("::placeholder", { color: t.dim, opacity: 1 });

const bookletLayout = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 14px 11.5rem",
  background: t.surface,
} as const;
const stacked = {
  "@container": { "(max-width: 520px)": { gridTemplateColumns: "1fr" } },
} as const;

export const pass = style({
  position: "relative",
  height: "100vh",
  background: t.surface,
  containerType: "inline-size",
});
export const booklet = style({
  ...bookletLayout,
  ...stacked,
  height: "100%",
  minHeight: 0,
});
export const exportPass = style({
  ...bookletLayout,
  alignItems: "stretch",
  containerType: "inline-size",
  "@media": { "(max-width: 520px)": { gridTemplateColumns: "1fr" } },
  ...stacked,
});

export const main = style({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  padding: "16px 16px 14px 18px",
});
export const exportMain = style({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  gap: 14,
  padding: "16px 16px 14px 18px",
});

export const masthead = style({
  display: "grid",
  gap: 10,
  paddingBottom: 12,
  borderBottom: `2px solid ${t.ink}`,
  flexShrink: 0,
});
export const mastTop = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
});
export const airline = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: t.accent,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
});
export const tripName = style({
  minWidth: 0,
  maxWidth: "18rem",
  border: 0,
  background: "transparent",
  textAlign: "right",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  outline: 0,
  textTransform: "uppercase",
});
export const route = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
});
export const city = style({ display: "grid", gap: 2, minWidth: 0 });
export const cityEnd = style({ justifyItems: "end" });
export const iata = style({
  width: "5.2ch",
  border: 0,
  background: "transparent",
  fontSize: "2rem",
  fontWeight: 800,
  letterSpacing: "-0.04em",
  outline: 0,
  textTransform: "uppercase",
});
export const cityName = style({
  width: "16ch",
  maxWidth: "100%",
  border: 0,
  background: "transparent",
  color: t.muted,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  outline: 0,
  textTransform: "uppercase",
});
globalStyle(`${cityEnd} .${iata}, ${cityEnd} .${cityName}`, { textAlign: "right" });
export const flightArrow = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: t.accent,
});
export const flightLine = style({
  width: 28,
  height: 2,
  background: t.line,
});
export const stripe = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.6fr) minmax(0, 0.55fr) minmax(0, 0.8fr)",
  gap: 8,
  padding: "8px 10px",
  border: `1px solid ${t.line}`,
  borderRadius: 8,
  background: t.lilac,
});
export const field = style({ display: "grid", gap: 2, minWidth: 0 });
globalStyle(`${field} span`, {
  color: t.muted,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
});
globalStyle(`${field} input, ${field} strong`, {
  width: "100%",
  minWidth: 0,
  overflow: "hidden",
  border: 0,
  background: "transparent",
  fontSize: 13,
  fontWeight: 800,
  textOverflow: "ellipsis",
  outline: 0,
});

export const dayTabs = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 0",
  overflowX: "auto",
  scrollbarWidth: "none",
  flexShrink: 0,
});
export const dayTab = style({
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  padding: "6px 10px 5px",
  border: `1.5px solid ${t.ruleStrong}`,
  borderRadius: "8px 8px 6px 6px",
  background: t.paper,
  color: t.muted,
  whiteSpace: "nowrap",
  fontSize: 12,
  boxShadow: `inset 0 3px 0 ${t.lilac}`,
  selectors: {
    '&[data-state="active"]': { background: t.ink, borderColor: t.ink, color: t.onAccent, boxShadow: "none" },
  },
});
globalStyle(`${dayTab} span`, { fontSize: 11, fontVariantNumeric: "tabular-nums" });
export const addDay = style({
  display: "grid",
  placeItems: "center",
  width: 28,
  height: 28,
  border: `1.5px dashed ${t.ruleStrong}`,
  borderRadius: 8,
  color: t.muted,
  background: "transparent",
});

export const timeline = style({
  display: "grid",
  gap: 10,
  alignContent: "start",
  minHeight: 0,
  flex: 1,
});
export const dayHead = style({
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  minWidth: 0,
});
export const dayTitle = style({
  width: "8rem",
  border: 0,
  background: "transparent",
  outline: 0,
  fontSize: 15,
  fontWeight: 800,
});
export const dayDate = style({
  width: "10.5rem",
  border: 0,
  background: "transparent",
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 12,
  fontWeight: 700,
  outline: 0,
});
globalStyle(`${dayDate}::-webkit-calendar-picker-indicator`, { cursor: "pointer", opacity: 0.55 });
export const daySub = style({
  flex: 1,
  minWidth: 0,
  border: 0,
  background: "transparent",
  color: t.muted,
  fontSize: 13,
  fontWeight: 700,
  outline: 0,
});

export const composer = style({
  display: "grid",
  gridTemplateColumns: "5.8rem minmax(0, 1.2fr) minmax(0, 1fr) 4.6rem 2rem",
  gap: 6,
  minWidth: 0,
  padding: 6,
  border: `1px dashed ${t.line}`,
  borderRadius: 8,
  background: t.lilac,
});
export const timeInput = style({
  width: "100%",
  minWidth: 0,
  border: 0,
  background: "transparent",
  fontFamily: t.mono,
  fontSize: 12,
  fontWeight: 800,
  color: t.ink,
  outline: 0,
});
globalStyle(`${timeInput}::-webkit-calendar-picker-indicator`, { cursor: "pointer", opacity: 0.45 });
globalStyle(`${composer} .${timeInput}`, {
  padding: "6px 7px",
  border: `1px solid ${t.ruleStrong}`,
  borderRadius: 5,
  background: t.paper,
});
export const compTitle = style({
  minWidth: 0,
  padding: "6px 7px",
  border: `1px solid ${t.ruleStrong}`,
  borderRadius: 5,
  background: t.paper,
  fontSize: 12,
});
export const compLoc = style({
  minWidth: 0,
  padding: "6px 7px",
  border: `1px solid ${t.ruleStrong}`,
  borderRadius: 5,
  background: t.paper,
  fontSize: 12,
});
export const add = style({
  display: "grid",
  placeItems: "center",
  borderRadius: 5,
  background: t.ink,
  color: t.onAccent,
});
export const selectTrigger = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  padding: "6px 5px",
  border: `1px solid ${t.ruleStrong}`,
  borderRadius: 5,
  background: t.paper,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  outline: "none",
});
export const selectContent = style({
  zIndex: 40,
  minWidth: 92,
  padding: 4,
  border: `1px solid ${t.ruleStrong}`,
  borderRadius: 6,
  background: t.paper,
  color: t.ink,
  boxShadow: "0 4px 12px rgba(30, 27, 75, 0.16)",
  outline: "none",
});
globalStyle(`${selectContent} [data-select-item]`, {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  outline: "none",
});
globalStyle(`${selectContent} [data-highlighted]`, { background: t.lilac });
globalStyle(`${selectContent} [data-selected]`, { fontWeight: 800 });

export const stops = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 6,
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
});
export const stop = style({
  display: "grid",
  gridTemplateColumns: "5.4rem minmax(0, 1fr) 22px",
  alignItems: "stretch",
  gap: 0,
  overflow: "hidden",
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
  background: t.paper,
  selectors: {
    '&[data-done="true"]': { opacity: 0.55 },
  },
});
export const timeStub = style({
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  gap: 4,
  padding: "7px 6px",
  background: t.lilac,
  borderRight: `1px dashed ${t.line}`,
});
export const stopBody = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  padding: "7px 8px",
});
export const stamp = style({
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textAlign: "center",
  flexShrink: 0,
  selectors: stamps,
});
export const stopCopy = style({ display: "grid", minWidth: 0, flex: 1 });
export const stopTitle = style({
  width: "100%",
  border: 0,
  background: "transparent",
  outline: 0,
  fontSize: 13,
  fontWeight: 800,
});
export const stopLoc = style({
  width: "100%",
  border: 0,
  background: "transparent",
  outline: 0,
  color: t.muted,
  fontSize: 12,
});
globalStyle(`${stop}[data-done="true"] .${stopTitle}, ${stop}[data-done="true"] .${stopLoc}`, {
  textDecoration: "line-through",
});

export const remove = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  alignSelf: "center",
  marginRight: 6,
  padding: 0,
  border: 0,
  background: "transparent",
  color: t.dim,
  opacity: 0,
  selectors: {
    [`${stop}:hover &`]: { opacity: 1 },
    [`${stop}:focus-within &`]: { opacity: 1 },
    [`${dayHead}:hover &`]: { opacity: 1 },
    [`${dayHead}:focus-within &`]: { opacity: 1 },
    "&:hover": { color: t.danger },
  },
});

export const perforation = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  background: `repeating-linear-gradient(to bottom, ${t.line} 0 8px, transparent 8px 16px) center / 2px 100% no-repeat`,
});
export const notch = style({
  position: "absolute",
  left: "50%",
  width: 18,
  height: 18,
  border: `2px solid ${t.ink}`,
  borderRadius: "50%",
  background: t.surface,
  transform: "translateX(-50%)",
  zIndex: 2,
});
export const notchTop = style({ top: -10 });
export const notchBottom = style({ bottom: -10 });

export const stub = style({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  padding: "16px 12px 14px",
  background: t.lilac,
  borderLeft: `1px solid ${t.line}`,
});
export const stubHead = style({ paddingBottom: 8, borderBottom: `1.5px solid ${t.ink}` });
export const stubLabel = style({
  display: "block",
  color: t.accent,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
});
export const stubRoute = style({
  display: "block",
  marginTop: 2,
  fontSize: 15,
  fontWeight: 800,
  textTransform: "uppercase",
});
export const stubMeta = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 6,
});
export const stubPassenger = style({});
globalStyle(`${stubMeta} span, ${stubPassenger} span`, {
  display: "block",
  color: t.muted,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
});
globalStyle(`${stubMeta} strong, ${stubPassenger} strong`, { fontSize: 13, fontWeight: 800 });
export const packing = style({
  display: "grid",
  gap: 6,
  paddingTop: 8,
  borderTop: `1px dashed ${t.line}`,
  flex: 1,
  minHeight: 0,
});
export const stubItems = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 5,
  minHeight: 0,
  overflowY: "auto",
});
export const stubRow = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
});
export const stubText = style({
  flex: 1,
  minWidth: 0,
  border: 0,
  background: "transparent",
  fontSize: 12,
  fontWeight: 700,
  outline: 0,
});
globalStyle(`${stubRow}[data-done="true"] .${stubText}`, {
  textDecoration: "line-through",
  opacity: 0.5,
});
export const stubDel = style({
  color: t.muted,
  opacity: 0.35,
  fontSize: 14,
  selectors: { "&:hover": { opacity: 1, color: t.danger } },
});
export const stubAdd = style({
  width: "100%",
  padding: "5px 7px",
  border: `1px dashed ${t.ruleStrong}`,
  borderRadius: 5,
  background: t.paper,
  fontSize: 12,
});
export const barcodeBox = style({
  display: "grid",
  justifyItems: "center",
  gap: 4,
  paddingTop: 8,
  borderTop: `1.5px solid ${t.ink}`,
});
export const barcode = style({
  width: "100%",
  height: 28,
  background: barcodeFill,
});
export const barcodeNum = style({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
});

globalStyle(`${timeStub} [data-checkbox-root], ${stubRow} [data-checkbox-root]`, {
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
  flexShrink: 0,
  padding: 0,
  border: `1.5px solid ${t.ink}`,
  borderRadius: 3,
  background: t.paper,
  color: t.onAccent,
});
globalStyle(`${timeStub} [data-checkbox-root]`, {
  width: 18,
  height: 18,
  borderRadius: 4,
});
globalStyle(`${timeStub} [data-state="checked"], ${stubRow} [data-state="checked"]`, {
  background: t.ink,
  borderColor: t.ink,
});

export const empty = style({
  display: "grid",
  justifyItems: "center",
  padding: "20px 12px 12px",
  textAlign: "center",
  color: t.muted,
});
globalStyle(`${empty} h2`, { margin: "0 0 4px", color: t.ink, fontSize: 15, fontWeight: 800 });
globalStyle(`${empty} p`, { margin: 0, fontSize: 12 });

export const error = style({
  position: "absolute",
  right: 16,
  bottom: 12,
  left: 16,
  margin: 0,
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.paper,
  color: t.error,
  textAlign: "center",
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.lilac,
  color: t.ink,
  fontSize: 11,
});

export const tooltip = style({
  zIndex: 50,
  padding: "5px 8px",
  border: `1px solid ${t.line}`,
  borderRadius: 6,
  background: t.paper,
  color: t.ink,
  fontSize: 12,
  boxShadow: "0 6px 18px rgba(30, 27, 75, 0.16)",
});

export const exportDay = style({ display: "grid", gap: 8 });
export const exportDayHead = style({
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  fontSize: 13,
});
globalStyle(`${exportDayHead} strong`, { fontSize: 15, fontWeight: 800 });
globalStyle(`${exportDayHead} span`, { color: t.muted, fontWeight: 700 });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${pass}`, { height: "auto", minHeight: 0, overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${booklet}`, { height: "auto" });
globalStyle(`html[data-slop-capture="static"] .${main}, html[data-slop-capture="static"] .${stub}, html[data-slop-capture="static"] .${stops}`, { overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${stop}, .${exportPass} .${stop}`, { gridTemplateColumns: "5.4rem minmax(0, 1fr)" });
globalStyle(`.${exportPass} .${stub}, .${exportPass} .${stops}, .${exportPass} .${stubItems}`, { overflow: "visible" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconPass = style({
  width: 460,
  height: 300,
  display: "grid",
  gridTemplateColumns: "1fr 18px 118px",
  overflow: "hidden",
  background: t.paper,
  border: `12px solid ${t.ink}`,
  borderRadius: 36,
  boxShadow: "0 16px 36px rgb(0 0 0 / 28%)",
});
export const iconMain = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: 22,
});
export const iconHead = style({ display: "flex", justifyContent: "space-between", alignItems: "center" });
export const iconAirline = style({
  color: t.accent,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
});
export const iconClass = style({
  padding: "3px 8px",
  borderRadius: 4,
  background: t.lilac,
  fontSize: 11,
  fontWeight: 800,
});
export const iconRoute = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
export const iconCity = style({ display: "grid" });
globalStyle(`${iconCity} strong`, {
  fontSize: 42,
  fontWeight: 800,
  lineHeight: 0.9,
  letterSpacing: "-0.04em",
  textTransform: "uppercase",
});
globalStyle(`${iconCity} span`, {
  color: t.muted,
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
});
export const iconPlane = style({ color: t.accent, fontSize: 26 });
export const iconMeta = style({
  display: "flex",
  gap: 18,
  padding: "8px 12px",
  borderRadius: 8,
  background: t.lilac,
});
globalStyle(`${iconMeta} div`, { display: "grid" });
globalStyle(`${iconMeta} span`, { color: t.muted, fontSize: 10, fontWeight: 800 });
globalStyle(`${iconMeta} strong`, { fontSize: 14, fontWeight: 800 });
export const iconPerf = style({
  position: "relative",
  background: `repeating-linear-gradient(to bottom, ${t.line} 0 8px, transparent 8px 16px) center / 2px 100% no-repeat`,
});
export const iconNotch = style({
  position: "absolute",
  left: "50%",
  width: 22,
  height: 22,
  borderRadius: "50%",
  background: t.ink,
  transform: "translateX(-50%)",
});
export const iconNotchTop = style({ top: -12 });
export const iconNotchBottom = style({ bottom: -12 });
export const iconStub = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "22px 14px",
  background: t.lilac,
});
export const iconBarcode = style({
  width: 18,
  height: 110,
  background: `repeating-linear-gradient(to bottom, ${t.ink} 0 8px, transparent 8px 12px, ${t.ink} 12px 18px, transparent 18px 22px)`,
});
export const iconCode = style({
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.06em",
});

globalStyle(`.${perforation}`, {
  "@container": {
    "(max-width: 520px)": {
      height: 14,
      background: `repeating-linear-gradient(to right, ${t.line} 0 8px, transparent 8px 16px) center / 100% 2px no-repeat`,
    },
  },
});
globalStyle(`.${notch}`, {
  "@container": {
    "(max-width: 520px)": {
      top: "50%",
      left: "auto",
      transform: "translateY(-50%)",
    },
  },
});
globalStyle(`.${notchTop}`, {
  "@container": {
    "(max-width: 520px)": { left: -10, top: "50%" },
  },
});
globalStyle(`.${notchBottom}`, {
  "@container": {
    "(max-width: 520px)": { right: -10, left: "auto", top: "50%", bottom: "auto" },
  },
});
globalStyle(`.${stub}`, {
  "@container": {
    "(max-width: 520px)": { borderLeft: 0, borderTop: `1px solid ${t.line}` },
  },
});
globalStyle(`.${stripe}`, {
  "@container": {
    "(max-width: 520px)": { gridTemplateColumns: "1fr 1fr" },
  },
});
globalStyle(`.${composer}`, {
  "@container": {
    "(max-width: 520px)": { gridTemplateColumns: "5.8rem 1fr 2rem" },
  },
});
globalStyle(`.${compLoc}, .${selectTrigger}`, {
  "@container": {
    "(max-width: 520px)": { display: "none" },
  },
});
globalStyle(`.${iata}`, {
  "@container": {
    "(max-width: 520px)": { fontSize: "1.6rem" },
  },
});
