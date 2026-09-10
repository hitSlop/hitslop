import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
const dots = `radial-gradient(${t.dot} 1.15px, transparent 1.15px)`;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: t.surface, color: t.ink, overflow: "hidden" });
globalStyle("button, input, textarea, select", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, input:focus-visible, [data-select-trigger]:focus-visible, [data-toggle-root]:focus-visible, [data-tabs-trigger]:focus-visible, [data-tooltip-trigger]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.ink}`,
  outlineOffset: 2,
});
globalStyle("input::placeholder", { color: t.dim });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const page = style({
  position: "relative",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "18px 28px 16px",
  overflow: "hidden",
  backgroundColor: t.surface,
  backgroundImage: dots,
  backgroundSize: "20px 20px",
  backgroundPosition: "14px 10px",
  containerType: "inline-size",
  "@media": { "(max-width: 420px)": { padding: "14px 16px 12px", gap: 10 } },
});

export const ribbon = style({
  position: "absolute",
  top: 0,
  right: 40,
  width: 10,
  height: 48,
  background: t.ribbon,
  clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%)",
  boxShadow: "1px 2px 4px rgba(34, 32, 29, 0.18)",
  pointerEvents: "none",
});

export const header = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingBottom: 8,
  borderBottom: `2px solid ${t.rule}`,
});

export const tabs = style({
  display: "flex",
  alignItems: "flex-end",
  gap: 4,
});

export const tab = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 11px 7px",
  border: `1px solid ${t.border}`,
  borderBottom: 0,
  borderRadius: "6px 6px 0 0",
  background: "color-mix(in srgb, var(--slop-surface) 78%, white)",
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 11,
  letterSpacing: "0.02em",
  selectors: {
    '&[data-state="active"]': {
      background: t.surface,
      color: t.ink,
      fontWeight: 700,
      boxShadow: `inset 0 2px 0 ${t.ribbon}`,
    },
  },
});

export const legend = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "2px 10px",
  fontFamily: t.mono,
  fontSize: 10,
  color: t.muted,
});

export const legendItem = style({
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
});

export const legendSym = style({
  color: t.ink,
  fontSize: 12,
  fontWeight: 700,
});

export const spread = style({
  display: "flex",
  flex: 1,
  minHeight: 0,
  flexDirection: "column",
  gap: 8,
});

export const titleRow = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  paddingBottom: 6,
});

export const title = style({
  minWidth: 0,
  flex: 1,
  margin: 0,
  border: 0,
  padding: 0,
  background: "transparent",
  fontFamily: t.headingFont,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  lineHeight: 1.2,
});

export const pageNumWrap = style({
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  fontFamily: t.mono,
  fontSize: 10,
  color: t.dim,
  whiteSpace: "nowrap",
});

export const pageNum = style({
  width: 36,
  border: 0,
  padding: 0,
  background: "transparent",
  fontFamily: t.mono,
  fontSize: 10,
  color: t.dim,
  textAlign: "right",
});

export const srOnly = style({
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
});

export const list = style({
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
  margin: 0,
  padding: 0,
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
});

export const row = style({
  display: "grid",
  gridTemplateColumns: "18px 22px minmax(0, 1fr) 22px",
  alignItems: "center",
  gap: 6,
  minHeight: 28,
  padding: "2px 2px 2px 0",
  borderRadius: 4,
});

export const starBtn = style({
  display: "grid",
  placeItems: "center",
  width: 18,
  height: 18,
  padding: 0,
  border: 0,
  background: "transparent",
  color: t.dim,
  selectors: {
    '&[data-state="on"]': { color: t.accent },
    [`${row}:hover &:not([data-state="on"])`]: { color: t.muted },
    [`${row}:focus-within &:not([data-state="on"])`]: { color: t.muted },
  },
});

export const signifier = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  padding: 0,
  border: 0,
  background: "transparent",
  fontFamily: t.mono,
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1,
  color: t.ink,
  selectors: {
    '&[data-type="complete"]': { color: t.muted },
    '&[data-type="migrated"]': { color: t.accent },
    '&[data-type="scheduled"]': { color: t.scheduled },
    '&[data-type="event"]': { fontSize: 14 },
    '&[data-type="note"]': { color: t.muted, fontSize: 15 },
  },
});

export const entryText = style({
  minWidth: 0,
  width: "100%",
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "4px 0",
  background: "transparent",
  fontSize: 14,
  lineHeight: 1.4,
  selectors: {
    "&:focus": { borderBottomColor: t.rule },
    [`${row}[data-complete="true"] &`]: {
      textDecoration: "line-through",
      color: t.muted,
    },
  },
});

export const remove = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  padding: 0,
  border: 0,
  background: "transparent",
  color: t.dim,
  opacity: 0,
  selectors: {
    [`${row}:hover &`]: { opacity: 1 },
    [`${row}:focus-within &`]: { opacity: 1 },
    "&:hover": { color: t.danger },
  },
});

export const composer = style({
  display: "grid",
  gridTemplateColumns: "26px auto minmax(0, 1fr) 28px",
  alignItems: "center",
  gap: 6,
  marginTop: 4,
  paddingTop: 10,
  borderTop: `1px dashed ${t.rule}`,
  "@container": { "(max-width: 420px)": { gridTemplateColumns: "26px minmax(0, 1fr) 28px", gridTemplateRows: "auto auto" } },
});

export const starToggle = style({
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 26,
  padding: 0,
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  background: t.control,
  color: t.dim,
  selectors: {
    '&[data-state="on"]': { color: t.accent, borderColor: t.accent, background: "color-mix(in srgb, var(--slop-accent) 12%, var(--slop-surface))" },
  },
});

export const selectTrigger = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: t.control,
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 600,
  color: t.ink,
  padding: "4px 7px",
  whiteSpace: "nowrap",
  "@container": { "(max-width: 420px)": { gridColumn: "1 / -1" } },
});

export const selectContent = style({
  zIndex: 40,
  minWidth: 148,
  padding: 4,
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
  background: t.surface,
  color: t.ink,
  boxShadow: "0 8px 24px rgba(34, 32, 29, 0.16)",
});

globalStyle(`${selectContent} [data-select-item]`, {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "7px 9px",
  borderRadius: 5,
  fontFamily: t.mono,
  fontSize: 12,
  cursor: "pointer",
  outline: "none",
});
globalStyle(`${selectContent} [data-highlighted]`, { background: t.control });
globalStyle(`${selectContent} [data-selected]`, { fontWeight: 700 });

export const addInput = style({
  minWidth: 0,
  width: "100%",
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  padding: "5px 8px",
  background: "color-mix(in srgb, var(--slop-surface) 70%, white)",
  fontSize: 13,
});

export const add = style({
  display: "grid",
  placeItems: "center",
  width: 28,
  height: 28,
  padding: 0,
  border: `1px solid ${t.ink}`,
  borderRadius: 4,
  background: t.ink,
  color: t.onAccent,
});

export const monthRow = style({
  display: "grid",
  gridTemplateColumns: "36px 28px minmax(0, 1fr) 22px",
  alignItems: "baseline",
  gap: 8,
  minHeight: 28,
  padding: "3px 0",
  borderBottom: `1px dotted ${t.border}`,
});

export const monthDay = style({
  width: "100%",
  border: 0,
  padding: 0,
  background: "transparent",
  fontFamily: t.mono,
  fontSize: 12,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  appearance: "textfield",
});
globalStyle(`${monthDay}::-webkit-outer-spin-button, ${monthDay}::-webkit-inner-spin-button`, {
  appearance: "none",
});

export const monthWeekday = style({
  width: "100%",
  border: 0,
  padding: 0,
  background: "transparent",
  fontFamily: t.mono,
  fontSize: 10,
  color: t.muted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});

export const monthText = style({
  minWidth: 0,
  width: "100%",
  border: 0,
  padding: "2px 0",
  background: "transparent",
  fontSize: 13,
});

export const monthComposer = style({
  display: "flex",
  justifyContent: "flex-start",
  paddingTop: 10,
});

export const addDay = style({
  border: `1px dashed ${t.rule}`,
  borderRadius: 4,
  padding: "5px 10px",
  background: "transparent",
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 700,
});

export const foot = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontFamily: t.mono,
  fontSize: 10,
  color: t.muted,
});

export const empty = style({
  padding: "36px 12px 20px",
  textAlign: "center",
  color: t.muted,
});
globalStyle(`${empty} h2`, { margin: "0 0 6px", color: t.ink, fontFamily: t.headingFont, fontSize: 18, fontWeight: 400 });
globalStyle(`${empty} p`, { margin: 0, fontSize: 12, lineHeight: 1.45 });

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 6,
  background: "color-mix(in srgb, var(--slop-surface) 80%, white)",
  color: t.danger,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 4,
  padding: "3px 7px",
  background: t.control,
  color: t.ink,
  fontSize: 11,
});

export const tooltip = style({
  zIndex: 50,
  padding: "5px 8px",
  border: `1px solid ${t.rule}`,
  borderRadius: 6,
  background: t.surface,
  color: t.ink,
  fontSize: 12,
  boxShadow: "0 6px 18px rgba(34, 32, 29, 0.14)",
});

export const exportPage = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "22px 28px 20px",
  backgroundColor: t.surface,
  backgroundImage: dots,
  backgroundSize: "20px 20px",
  backgroundPosition: "14px 10px",
  color: t.ink,
});

export const exportMark = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  fontFamily: t.mono,
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1,
  color: t.ink,
  selectors: {
    '&[data-type="complete"]': { color: t.muted },
    '&[data-type="migrated"]': { color: t.accent },
    '&[data-type="scheduled"]': { color: t.scheduled },
    '&[data-type="event"]': { fontSize: 14 },
    '&[data-type="note"]': { color: t.muted, fontSize: 15 },
  },
});

export const exportText = style({
  minWidth: 0,
  fontSize: 14,
  lineHeight: 1.4,
  selectors: {
    [`${row}[data-complete="true"] &`]: {
      textDecoration: "line-through",
      color: t.muted,
    },
  },
});

export const exportStar = style({
  color: t.accent,
  fontSize: 12,
  textAlign: "center",
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${page}`, { height: "auto", minHeight: "100vh", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${list}`, { overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${row}`, { gridTemplateColumns: "18px 22px minmax(0, 1fr)" });
globalStyle(`html[data-slop-capture="static"] .${monthRow}`, { gridTemplateColumns: "36px 28px minmax(0, 1fr)" });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconPlate = style({
  position: "relative",
  width: 420,
  height: 420,
  backgroundColor: t.surface,
  backgroundImage: dots,
  backgroundSize: "28px 28px",
  borderRadius: 36,
  border: `10px solid ${t.rule}`,
  boxShadow: "0 18px 40px rgba(34, 32, 29, 0.22)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 28,
  padding: "56px 48px",
});
export const iconRibbon = style({
  position: "absolute",
  top: 0,
  right: 64,
  width: 18,
  height: 72,
  background: t.ribbon,
  clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%)",
});
export const iconRow = style({
  display: "flex",
  alignItems: "center",
  gap: 16,
});
export const iconBullet = style({
  width: 28,
  fontFamily: t.mono,
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1,
  color: t.ink,
  textAlign: "center",
});
export const iconLine = style({
  flex: 1,
  height: 10,
  background: t.border,
  borderRadius: 4,
});
