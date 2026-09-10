import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "dark", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: t.chassisInk, color: t.ink, overflow: "hidden" });
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, input:focus-visible, [data-progress-root]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.mint}`,
  outlineOffset: 2,
});
globalStyle("input", { minWidth: 0 });
globalStyle("input::-webkit-outer-spin-button, input::-webkit-inner-spin-button", { WebkitAppearance: "none", margin: 0 });
globalStyle("input[type='number']", { appearance: "textfield" });
globalStyle("ul", { listStyle: "none", margin: 0, padding: 0 });

export const canvas = style({
  height: "100vh",
  display: "flex",
  padding: 10,
  overflow: "hidden",
  background: t.surface,
  containerType: "inline-size",
});

export const chassis = style({
  flex: 1,
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(252px, 0.95fr)",
  gap: 12,
  padding: 14,
  overflow: "hidden",
  background: t.chassis,
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: 16,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.45)",
  "@container": {
    "(max-width: 660px)": {
      gridTemplateColumns: "1fr",
      overflowY: "auto",
    },
  },
});

export const ledger = style({
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minWidth: 0,
  padding: 16,
  overflowY: "auto",
  background: t.ledger,
  border: `1px solid ${t.rule}`,
  borderRadius: 14,
});

export const ledgerHead = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
});

export const month = style({
  margin: 0,
  width: "100%",
  maxWidth: "18ch",
  padding: "2px 4px",
  border: 0,
  borderBottom: "1px dashed rgba(255, 255, 255, 0.2)",
  background: "transparent",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  outline: 0,
  selectors: {
    "&:focus": { borderBottomColor: t.mint },
  },
});

export const pill = style({
  flexShrink: 0,
  color: t.muted,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

export const hero = style({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "12px 14px",
  background: t.card,
  border: `1px solid ${t.ruleStrong}`,
  borderRadius: 10,
  selectors: {
    '&[data-over="true"]': { borderColor: "color-mix(in srgb, var(--slop-danger) 45%, transparent)" },
  },
});

export const heroLabel = style({
  color: t.dim,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
});

export const heroValue = style({
  fontFamily: t.mono,
  fontSize: 26,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: t.mint,
  fontVariantNumeric: "tabular-nums",
  selectors: {
    [`${hero}[data-over="true"] &`]: { color: t.danger },
  },
});

export const heroSub = style({
  color: t.muted,
  fontSize: 11,
});

export const remainingTrack = style({
  height: 6,
  overflow: "hidden",
  marginTop: 4,
  background: "rgba(255, 255, 255, 0.08)",
  borderRadius: 3,
});

export const remainingFill = style({
  height: "100%",
  transformOrigin: "left center",
  background: t.mint,
  borderRadius: 3,
  boxShadow: `0 0 8px ${t.mintGlow}`,
  selectors: {
    [`${hero}[data-over="true"] &`]: { background: t.danger, boxShadow: "none" },
  },
});

export const stats = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
});

export const chip = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  padding: "8px 10px",
  background: "rgba(255, 255, 255, 0.03)",
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
});

export const chipLabel = style({
  color: t.dim,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});

export const chipValue = style({
  width: "100%",
  border: 0,
  background: "transparent",
  outline: 0,
  fontFamily: t.mono,
  fontSize: 13,
  fontWeight: 700,
  color: t.ink,
  fontVariantNumeric: "tabular-nums",
  selectors: {
    "&:focus": { color: t.mint },
  },
});

export const categories = style({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  flex: 1,
  minHeight: 0,
});

export const catHead = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: 6,
  borderBottom: `1px solid ${t.rule}`,
});

export const catTitle = style({
  color: t.muted,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

export const iconBtn = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 4px",
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: t.muted,
  selectors: {
    "&:hover": { color: t.mint, background: t.mintSoft },
  },
});

export const catList = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
});

export const catRow = style({
  display: "flex",
  flexDirection: "column",
  gap: 5,
  padding: "8px 10px",
  background: "rgba(255, 255, 255, 0.02)",
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
  selectors: {
    "&:hover": { background: "rgba(255, 255, 255, 0.04)" },
    '&[data-selected="true"]': {
      borderColor: t.mint,
      background: "rgba(74, 222, 128, 0.05)",
    },
  },
});

export const catMeta = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
});

export const catSelect = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 2,
  border: 0,
  background: "transparent",
});

export const catDot = style({
  width: 8,
  height: 8,
  borderRadius: "50%",
  border: `1.5px solid ${t.dim}`,
  background: "transparent",
  selectors: {
    [`${catSelect}[data-active="true"] &`]: {
      borderColor: t.mint,
      background: t.mint,
      boxShadow: `0 0 6px ${t.mintGlow}`,
    },
  },
});

export const catName = style({
  flex: 1,
  minWidth: 0,
  border: 0,
  background: "transparent",
  outline: 0,
  fontSize: 13,
  fontWeight: 600,
  color: t.ink,
});

export const catFigures = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontFamily: t.mono,
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
});

export const spent = style({
  color: "#ffffff",
  fontWeight: 700,
});

export const divider = style({ color: t.dim });

export const allocated = style({
  width: 55,
  border: 0,
  background: "transparent",
  outline: 0,
  color: t.muted,
  fontFamily: "inherit",
  fontSize: "inherit",
  textAlign: "right",
  selectors: {
    "&:focus": { color: t.mint },
  },
});

export const limit = style({
  color: t.muted,
  fontWeight: 700,
});

export const deleteCat = style({
  padding: "0 2px",
  border: 0,
  background: "transparent",
  color: t.dim,
  opacity: 0,
  selectors: {
    [`${catRow}:hover &`]: { opacity: 1 },
    [`${catRow}:focus-within &`]: { opacity: 1 },
    "&:hover": { color: t.danger },
  },
});

export const catTrack = style({
  height: 5,
  overflow: "hidden",
  position: "relative",
  background: "rgba(255, 255, 255, 0.08)",
  borderRadius: 3,
});

export const catFill = style({
  height: "100%",
  transformOrigin: "left center",
  background: t.mint,
  borderRadius: 3,
  selectors: {
    '&[data-over="true"]': { background: t.danger },
  },
});

export const empty = style({
  padding: "18px 8px",
  color: t.muted,
  fontSize: 12,
  textAlign: "center",
});
globalStyle(`${empty} strong`, { display: "block", marginBottom: 4, color: t.ink, fontSize: 13 });

export const calc = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minWidth: 0,
  padding: 14,
  background: t.calc,
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: 14,
  boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.5)",
});

export const lcd = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 2,
  padding: "10px 12px",
  background: t.lcd,
  border: `2px solid ${t.lcdBezel}`,
  borderRadius: 8,
  boxShadow: "inset 0 3px 6px rgba(0, 0, 0, 0.8)",
});

export const lcdHistory = style({
  minHeight: 14,
  fontFamily: t.mono,
  fontSize: 11,
  color: "#64748b",
  fontVariantNumeric: "tabular-nums",
});

export const lcdDigits = style({
  fontFamily: t.mono,
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: "0.03em",
  color: t.mint,
  textShadow: `0 0 10px ${t.mintGlow}`,
  fontVariantNumeric: "tabular-nums",
});

export const route = style({
  display: "flex",
});

export const routeBtn = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  padding: "8px 10px",
  border: "1px solid rgba(74, 222, 128, 0.4)",
  borderRadius: 8,
  background: "rgba(74, 222, 128, 0.15)",
  color: t.mint,
  fontSize: 12,
  fontWeight: 700,
  selectors: {
    "&:hover:not(:disabled)": { background: "rgba(74, 222, 128, 0.25)", borderColor: t.mint },
    "&:disabled": {
      opacity: 0.4,
      cursor: "not-allowed",
      borderColor: "rgba(255, 255, 255, 0.1)",
      color: t.dim,
      background: "transparent",
    },
  },
});

export const keys = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
  flex: 1,
});

export const key = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: 8,
  background: t.key,
  color: "#f1f5f9",
  fontSize: 16,
  fontWeight: 600,
  userSelect: "none",
  boxShadow: `0 3px 0 ${t.keyShadow}, 0 4px 6px rgba(0, 0, 0, 0.4)`,
  selectors: {
    "&:hover": { background: t.keyHover },
    "&:active": {
      transform: "translateY(2px)",
      boxShadow: `0 1px 0 ${t.keyShadow}, 0 1px 2px rgba(0, 0, 0, 0.3)`,
    },
    '&[data-kind="fn"]': { background: t.keyFn, color: "#94a3b8", fontSize: 13 },
    '&[data-kind="op"]': { background: t.keyOp, color: "#cbd5e1" },
    '&[data-kind="op"]:hover': { background: t.keyOpHover },
    '&[data-kind="op"][data-active="true"]': { background: "#4f5466", borderColor: t.mint },
    '&[data-kind="accent"]': {
      gridColumn: "span 4",
      background: t.orange,
      color: "#ffffff",
      fontSize: 18,
      fontWeight: 800,
      boxShadow: `0 3px 0 ${t.orangeShadow}, 0 4px 6px rgba(0, 0, 0, 0.4)`,
    },
    '&[data-kind="accent"]:hover': { background: "#fb923c" },
    '&[data-kind="accent"]:active': {
      background: t.orangeDeep,
      transform: "translateY(2px)",
      boxShadow: `0 1px 0 ${t.orangeShadow}`,
    },
  },
});

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.card,
  color: t.orange,
  overflowWrap: "anywhere",
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${canvas}`, { height: "auto", minHeight: "100%", overflow: "visible" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important", transitionDuration: "0s !important" } },
});

export const exportChassis = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(220px, 0.85fr)",
  gap: 12,
  padding: 14,
  background: t.chassis,
  color: t.ink,
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: 16,
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconDevice = style({
  width: 440,
  height: 440,
  display: "flex",
  flexDirection: "column",
  gap: 20,
  padding: 24,
  background: t.ledger,
  borderRadius: 36,
  border: `14px solid ${t.lcdBezel}`,
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
});
export const iconScreen = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 70,
  padding: "0 16px",
  background: t.lcd,
  border: `4px solid ${t.key}`,
  borderRadius: 12,
});
export const iconSymbol = style({
  color: t.mint,
  fontFamily: t.mono,
  fontSize: 30,
  fontWeight: 800,
});
export const iconDigits = style({
  width: 140,
  height: 20,
  background: t.mint,
  borderRadius: 6,
  boxShadow: `0 0 12px ${t.mintGlow}`,
});
export const iconSplit = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  flex: 1,
});
export const iconLedger = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 14,
  padding: 16,
  background: t.surface,
  border: "2px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 12,
});
export const iconBar = style({
  height: 12,
  width: "100%",
  background: t.key,
  borderRadius: 4,
  selectors: {
    "&:first-child": { width: "60%", background: t.mint },
  },
});
export const iconPad = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
});
export const iconKey = style({
  background: t.key,
  borderRadius: 10,
  borderBottom: `4px solid ${t.keyShadow}`,
  selectors: {
    "&:last-child": { background: t.orange, borderBottomColor: t.orangeShadow },
  },
});
