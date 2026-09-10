import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: t.surface, color: t.ink, overflow: "hidden" });
globalStyle("button, input, textarea, select", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle("button:disabled", { cursor: "default", opacity: .45 });
globalStyle("button:focus-visible, input:focus-visible, textarea:focus-visible, [data-select-trigger]:focus-visible, [data-checkbox-root]:focus-visible, [data-tabs-trigger]:focus-visible, [data-tooltip-trigger]:focus-visible", {
  outline: `2px solid ${t.ink}`,
  outlineOffset: 2,
});
globalStyle("textarea", { resize: "none" });
globalStyle("button", { WebkitTapHighlightColor: "transparent" });

export const door = style({
  position: "relative",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  overflow: "hidden",
  background: t.surface,
  border: `2px solid ${t.border}`,
  boxShadow: "inset 0 2px 0 rgba(255, 255, 255, 0.6)",
  containerType: "inline-size",
  "@media": { "(max-width: 360px)": { padding: 12, gap: 10 } },
});

export const magnet = style({
  position: "absolute",
  zIndex: 10,
  filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.22))",
  userSelect: "none",
  pointerEvents: "none",
});
export const banana = style({
  top: 8,
  right: 28,
  width: 44,
  height: 38,
  transform: "rotate(-12deg)",
});
export const bananaBody = style({
  width: 40,
  height: 20,
  borderBottom: `9px solid ${t.banana}`,
  borderRight: `5px solid ${t.banana}`,
  borderBottomRightRadius: 20,
  borderBottomLeftRadius: 14,
  position: "relative",
});
globalStyle(`${bananaBody} > span:first-child`, {
  position: "absolute",
  bottom: -4,
  left: -3,
  width: 4,
  height: 4,
  background: t.bananaTip,
  borderRadius: "50%",
});
globalStyle(`${bananaBody} > span:last-child`, {
  position: "absolute",
  top: 8,
  right: -3,
  width: 4,
  height: 4,
  background: t.bananaTip,
  borderRadius: "50%",
});
export const smiley = style({
  top: 110,
  right: 14,
  width: 32,
  height: 32,
  background: t.banana,
  borderRadius: "50%",
  border: "1.5px solid #ca8a04",
  boxShadow: "inset 0 -2px 0 rgba(0, 0, 0, 0.15)",
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  lineHeight: 1,
});
export const star = style({
  top: 160,
  right: 18,
  color: t.star,
  fontSize: 28,
  lineHeight: 1,
  textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
  transform: "rotate(15deg)",
});

export const notepad = style({
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginRight: 48,
  padding: "14px 16px 12px",
  overflow: "hidden",
  background: t.paper,
  borderRadius: 6,
  borderTop: `5px solid ${t.accent}`,
  boxShadow: "0 4px 14px rgba(40, 35, 30, 0.15), 0 1px 2px rgba(40, 35, 30, 0.1)",
  "@container": { "(max-width: 360px)": { marginRight: 40, padding: "12px 12px 10px" } },
});

export const titleRow = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  borderBottom: `2px solid ${t.ink}`,
  paddingBottom: 4,
});
export const title = style({
  minWidth: 0,
  flex: 1,
  border: 0,
  padding: 0,
  background: "transparent",
  fontFamily: t.headingFont,
  fontSize: 24,
  fontWeight: 700,
  lineHeight: 1.15,
});
export const count = style({
  fontSize: 11,
  fontWeight: 700,
  color: t.muted,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

export const tabs = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  overflowX: "auto",
  paddingBottom: 2,
  scrollbarWidth: "none",
});
export const tab = style({
  background: "transparent",
  border: "1px solid rgba(0, 0, 0, 0.08)",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 700,
  color: t.muted,
  padding: "4px 10px",
  whiteSpace: "nowrap",
  selectors: {
    '&[data-state="active"]': { background: t.ink, color: t.onAccent, borderColor: t.ink },
  },
});

export const composer = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto 28px",
  alignItems: "center",
  gap: 6,
  borderBottom: `1px dashed ${t.rule}`,
  paddingBottom: 6,
});
globalStyle(`${composer} input`, {
  minWidth: 0,
  width: "100%",
  background: "transparent",
  border: 0,
  padding: "4px 0",
  fontSize: 13,
});
globalStyle(`${composer} input::placeholder`, { color: t.dim });
export const add = style({
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  border: 0,
  borderRadius: 6,
  background: t.ink,
  color: t.onAccent,
});
export const selectTrigger = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: t.control,
  border: "1px solid rgba(0, 0, 0, 0.1)",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  color: t.muted,
  padding: "3px 6px",
  whiteSpace: "nowrap",
});
export const selectContent = style({
  zIndex: 40,
  minWidth: 120,
  padding: 4,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  background: t.paper,
  color: t.ink,
  boxShadow: "0 8px 24px rgba(35, 34, 32, 0.18)",
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

export const list = style({
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 4,
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
  gridTemplateColumns: "18px minmax(0, 1fr) auto 22px",
  alignItems: "center",
  gap: 8,
  padding: "4px 0",
  borderBottom: `1px solid ${t.rule}`,
});
globalStyle(`${row} [data-checkbox-root]`, {
  display: "grid",
  placeItems: "center",
  width: 18,
  height: 18,
  padding: 0,
  border: `1.5px solid ${t.ink}`,
  borderRadius: 4,
  background: "transparent",
  color: t.onAccent,
});
globalStyle(`${row} [data-state="checked"]`, { background: t.ink, borderColor: t.ink });
export const itemText = style({
  minWidth: 0,
  width: "100%",
  border: 0,
  padding: 0,
  background: "transparent",
  fontSize: 15,
  lineHeight: 1.35,
});
globalStyle(`${row}[data-done="true"] input`, {
  textDecoration: "line-through",
  color: t.dim,
});
export const badge = style({
  fontSize: 9.5,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 700,
  background: t.control,
  color: t.muted,
  padding: "2px 6px",
  borderRadius: 8,
  whiteSpace: "nowrap",
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
    "&:hover": { color: t.pin },
  },
});

export const foot = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  fontSize: 10,
  color: t.muted,
});
globalStyle(`${foot} button`, {
  border: 0,
  padding: "4px 8px",
  borderRadius: 6,
  background: t.control,
  color: t.ink,
  fontSize: 10,
  fontWeight: 700,
});

export const sticky = style({
  position: "relative",
  marginRight: 48,
  padding: "12px 12px 8px",
  background: t.sticky,
  border: `1px solid ${t.stickyBorder}`,
  borderRadius: 8,
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
  transform: "rotate(-1deg)",
  "@container": { "(max-width: 360px)": { marginRight: 40 } },
});
export const pin = style({
  position: "absolute",
  top: -6,
  left: "50%",
  transform: "translateX(-50%)",
  width: 10,
  height: 10,
  background: t.pin,
  borderRadius: "50%",
  border: "1px solid #b91c1c",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.25)",
});
export const memo = style({
  width: "100%",
  minHeight: 40,
  border: 0,
  background: "transparent",
  fontSize: 12,
  fontWeight: 600,
  fontStyle: "italic",
  color: t.stickyInk,
  lineHeight: 1.4,
});

export const empty = style({
  display: "grid",
  justifyItems: "center",
  padding: "28px 12px 16px",
  textAlign: "center",
  color: t.muted,
});
globalStyle(`${empty} h2`, { margin: "10px 0 4px", color: t.ink, fontFamily: t.headingFont, fontSize: 18, fontWeight: 400 });
globalStyle(`${empty} p`, { margin: 0, fontSize: 12 });

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.paper,
  color: t.accent,
  overflowWrap: "anywhere",
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

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${door}`, { height: "auto", minHeight: "100vh", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${notepad}`, { height: "auto", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${list}`, { overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${row}`, { gridTemplateColumns: "15px minmax(0, 1fr) auto" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconPlate = style({
  width: 440,
  height: 440,
  background: t.surface,
  borderRadius: 40,
  border: `14px solid ${t.border}`,
  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.55)",
  position: "relative",
  display: "grid",
  placeItems: "center",
});
export const iconPad = style({
  width: 290,
  height: 330,
  background: t.paper,
  borderRadius: 10,
  borderTop: `10px solid ${t.accent}`,
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
  padding: "24px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 18,
});
export const iconTitle = style({ width: 140, height: 16, background: t.ink, borderRadius: 8 });
export const iconLines = style({ display: "flex", flexDirection: "column", gap: 16 });
export const iconRow = style({ display: "flex", alignItems: "center", gap: 12 });
export const iconBox = style({
  width: 18,
  height: 18,
  border: `3px solid ${t.ink}`,
  borderRadius: 4,
  selectors: {
    '&[data-done="true"]': { background: t.ink },
  },
});
export const iconLine = style({ flex: 1, height: 10, background: t.control, borderRadius: 5 });
export const iconBanana = style({
  position: "absolute",
  top: 36,
  right: 48,
  width: 60,
  height: 34,
  borderBottom: `14px solid ${t.banana}`,
  borderRight: `10px solid ${t.banana}`,
  borderBottomRightRadius: 36,
  borderBottomLeftRadius: 24,
  filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
});
export const iconStar = style({
  position: "absolute",
  bottom: 50,
  right: 50,
  color: t.star,
  fontSize: 38,
  filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25))",
});

export const tooltip = style({
  zIndex: 50,
  padding: "5px 8px",
  border: `1px solid ${t.border}`,
  borderRadius: 6,
  background: t.paper,
  color: t.ink,
  fontSize: 12,
  boxShadow: "0 6px 18px rgba(35, 34, 32, 0.16)",
});
export const exportDoor = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  background: t.surface,
});
