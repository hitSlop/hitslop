import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", minHeight: "100%" });
globalStyle("body", { color: t.ink, background: "transparent" });
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", border: 0, background: "transparent", padding: 0, WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("::placeholder", { color: t.dim, opacity: 1 });
globalStyle("button:focus-visible, input:focus-visible, [data-radio-group-item]:focus-visible, [data-button-root]:focus-visible, [data-tooltip-trigger]:focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 1,
});

export const shell = style({
  containerType: "inline-size",
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
});

export const exportShell = style({
  containerType: "inline-size",
  display: "flex",
  flexDirection: "column",
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
});

export const tear = style({
  display: "flex",
  height: 10,
  overflow: "hidden",
  background: "transparent",
});
globalStyle(`${tear} > i`, {
  flex: 1,
  background: t.paper,
  clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
});
globalStyle(`${tear}[data-edge="bottom"] > i`, {
  clipPath: "polygon(0 0, 50% 100%, 100% 0)",
});

export const paper = style({
  display: "flex",
  flexDirection: "column",
  gap: 14,
  flex: 1,
  padding: "8px 18px 16px",
  "@container": { "(max-width: 340px)": { paddingInline: 12 } },
});

export const masthead = style({ display: "grid", gap: 6, textAlign: "center" });
export const stamp = style({
  margin: 0,
  color: t.muted,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.18em",
});
export const storeTitle = style({
  width: "100%",
  margin: 0,
  border: 0,
  background: "transparent",
  textAlign: "center",
  fontSize: "1.05rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  outline: 0,
});
export const meta = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: t.muted,
  fontSize: 12,
  fontWeight: 700,
  "@container": { "(max-width: 340px)": { flexDirection: "column", alignItems: "center" } },
});
export const terminal = style({ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 });
globalStyle(`${terminal} input`, {
  minWidth: 0,
  width: "8ch",
  border: 0,
  borderBottom: "1px dashed transparent",
  background: "transparent",
  fontWeight: 700,
  outline: 0,
});
globalStyle(`${terminal} input:hover, ${terminal} input:focus-visible`, {
  borderBottomColor: t.ruleStrong,
});

export const composer = style({
  display: "grid",
  gap: 8,
  padding: 10,
  border: `1px dashed ${t.ruleStrong}`,
  background: t.paperShade,
});
export const composerInputs = style({
  display: "grid",
  gridTemplateColumns: "1fr 7.5rem",
  gap: 8,
  "@container": { "(max-width: 340px)": { gridTemplateColumns: "1fr" } },
});
export const titleInput = style({
  border: `1px solid ${t.ruleStrong}`,
  background: t.ticket,
  padding: "6px 8px",
  outline: 0,
  fontSize: 13,
});
export const amountWrap = style({
  display: "flex",
  alignItems: "stretch",
  overflow: "hidden",
  border: `1px solid ${t.ruleStrong}`,
  background: t.ticket,
});
export const currency = style({
  width: "2.4rem",
  border: 0,
  borderRight: `1px solid ${t.rule}`,
  background: t.ticket,
  padding: "6px 4px",
  outline: 0,
  textAlign: "center",
  fontSize: 13,
  fontWeight: 800,
});
export const amountInput = style({
  width: "100%",
  border: 0,
  background: "transparent",
  padding: "6px 8px",
  outline: 0,
  textAlign: "right",
  fontSize: 13,
  fontWeight: 800,
});
export const composerBottom = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
});
export const catGroup = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
});
export const catPill = style({
  padding: "4px 7px",
  border: `1px solid ${t.ruleStrong}`,
  background: t.ticket,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.04em",
  color: t.muted,
  transition: "background-color 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease",
  selectors: {
    '&[data-state="checked"]': { background: t.ink, color: t.paper, borderColor: t.ink },
    "&:hover": { borderColor: t.ink, color: t.ink },
    '&[data-state="checked"]:hover': { color: t.paper },
    "&:active": { transform: "translateY(1px)" },
  },
  "@container": { "(max-width: 340px)": { paddingInline: 5 } },
});
export const add = style({
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  flexShrink: 0,
  background: t.ink,
  color: t.paper,
  transition: "background-color 120ms ease, transform 120ms ease",
  selectors: {
    "&:hover": { background: t.accent, color: t.onAccent },
    "&:active": { transform: "translateY(1px)" },
  },
});

export const items = style({ display: "grid", gap: 6 });
export const tableHead = style({
  display: "flex",
  justifyContent: "space-between",
  padding: "0 2px 4px",
  borderBottom: `2px solid ${t.ink}`,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: t.muted,
});
export const list = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
});
export const row = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 2px",
  borderBottom: `1px dotted ${t.ruleStrong}`,
});
export const itemInfo = style({ display: "grid", gap: 2, minWidth: 0 });
export const itemTitle = style({
  width: "100%",
  border: 0,
  background: "transparent",
  fontSize: 14,
  fontWeight: 800,
  outline: 0,
});
export const itemTag = style({
  color: t.muted,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
});
export const itemRight = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
});
export const itemCost = style({ fontSize: 14, fontWeight: 800 });
export const remove = style({
  color: t.muted,
  opacity: 0.45,
  transition: "opacity 120ms ease, color 120ms ease",
  selectors: {
    [`${row}:hover &`]: { opacity: 1 },
    [`${row}:focus-within &`]: { opacity: 1 },
    "&:hover": { opacity: 1, color: t.danger },
    "&:active": { transform: "translateY(1px)" },
  },
});

export const empty = style({
  padding: "28px 8px",
  textAlign: "center",
  color: t.muted,
});
globalStyle(`${empty} strong`, { display: "block", fontSize: 12, letterSpacing: "0.08em" });
globalStyle(`${empty} p`, { margin: "6px 0 0", fontSize: 12 });

export const footer = style({
  display: "grid",
  gap: 10,
  paddingTop: 4,
  borderTop: `2px dashed ${t.ruleStrong}`,
});
export const breakdown = style({
  display: "grid",
  gap: 3,
  color: t.muted,
  fontSize: 12,
  fontWeight: 700,
});
export const breakdownTitle = style({
  margin: "0 0 2px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
});
export const breakdownRow = style({ display: "flex", justifyContent: "space-between" });
export const grand = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  paddingTop: 8,
  borderTop: `3px double ${t.ink}`,
  fontSize: 13,
  fontWeight: 800,
});
export const totalDigits = style({ fontSize: "1.35rem", letterSpacing: "-0.03em" });
export const barcodeBlock = style({
  display: "grid",
  justifyItems: "center",
  gap: 6,
  paddingTop: 8,
});
export const barcode = style({ display: "flex", height: 28, gap: 2 });
globalStyle(`${barcode} > i`, { width: 2, background: t.ink });
globalStyle(`${barcode} > i[data-wide="true"]`, { width: 4 });
export const barcodeLabel = style({
  color: t.muted,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
});

export const error = style({
  position: "fixed",
  right: 16,
  bottom: 16,
  left: 16,
  margin: 0,
  padding: "8px 10px",
  color: t.error,
  fontSize: 12,
  textAlign: "center",
  background: t.ticket,
  border: `1px solid ${t.ruleStrong}`,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  padding: "3px 7px",
  background: t.paperShade,
  color: t.ink,
  fontSize: 11,
  fontWeight: 700,
});

export const tooltip = style({
  zIndex: 50,
  padding: "5px 8px",
  border: `1px solid ${t.ruleStrong}`,
  background: t.ticket,
  color: t.ink,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  boxShadow: "0 6px 18px rgba(28, 25, 23, 0.16)",
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${shell}`, { minHeight: 0 });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconReceipt = style({
  width: 300,
  background: t.paper,
  border: `10px solid ${t.ink}`,
  overflow: "hidden",
  boxShadow: "0 18px 36px rgb(0 0 0 / 28%)",
});
export const iconTear = style({ display: "flex", height: 18, background: t.ink });
globalStyle(`${iconTear} > i`, {
  flex: 1,
  background: t.paper,
  clipPath: "polygon(0 0, 50% 100%, 100% 0)",
});
export const iconBody = style({ display: "grid", gap: 10, padding: "18px 22px 22px" });
export const iconHeader = style({ display: "grid", justifyItems: "center", gap: 2 });
export const iconTitle = style({ fontSize: 18, fontWeight: 800, letterSpacing: "0.08em" });
export const iconSub = style({ color: t.muted, fontSize: 11, fontWeight: 800 });
export const iconDash = style({ borderBottom: `2px dashed ${t.ink}` });
export const iconItems = style({ display: "grid", gap: 6, fontSize: 15, fontWeight: 800 });
export const iconRow = style({ display: "flex", justifyContent: "space-between" });
export const iconDouble = style({ borderBottom: `4px double ${t.ink}` });
export const iconTotal = style({ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800 });
export const iconBarcode = style({ display: "flex", justifyContent: "center", gap: 4, height: 32, marginTop: 4 });
globalStyle(`${iconBarcode} > i`, { width: 4, background: t.ink });
globalStyle(`${iconBarcode} > i[data-wide="true"]`, { width: 7 });
