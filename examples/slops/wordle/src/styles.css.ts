import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

const popLetter = keyframes({
  "0%": { transform: "scale(0.92)" },
  "50%": { transform: "scale(1.08)" },
  "100%": { transform: "scale(1)" },
});
const shake = keyframes({
  "0%, 100%": { transform: "translateX(0)" },
  "20%, 60%": { transform: "translateX(-6px)" },
  "40%, 80%": { transform: "translateX(6px)" },
});
const toastPop = keyframes({
  from: { transform: "scale(0.85)", opacity: 0 },
  to: { transform: "scale(1)", opacity: 1 },
});

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "dark", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: "transparent", color: t.ink, overflow: "hidden" });
globalStyle("button, input, [data-button-root], [data-tabs-trigger]", {
  font: "inherit",
  color: "inherit",
});
globalStyle("button, [data-button-root], [data-tabs-trigger], [data-dialog-close]", {
  cursor: "pointer",
  border: 0,
  background: "transparent",
  padding: 0,
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled, [data-button-root]:disabled, [data-tabs-trigger]:disabled", { cursor: "default" });
globalStyle(":focus-visible, [data-button-root]:focus-visible, [data-tabs-trigger]:focus-visible, [data-dialog-close]:focus-visible", {
  outline: `2px solid ${t.focus}`,
  outlineOffset: 2,
});

export const device = style({
  position: "relative",
  containerType: "inline-size",
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  padding: "12px 14px 14px",
  color: t.ink,
  background: `radial-gradient(circle at 50% 0%, ${t.chassisMid} 0%, ${t.chassis} 75%)`,
  border: `1px solid ${t.border}`,
  userSelect: "none",
});

export const topNav = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 40,
  paddingBottom: 8,
  borderBottom: `1px solid ${t.border}`,
  flexShrink: 0,
  gap: 8,
});
export const navGroup = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
});
export const brandTitle = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: "0.14em",
  color: t.ink,
});
export const brandDot = style({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: t.correct,
  boxShadow: `0 0 8px color-mix(in srgb, ${t.correctBorder} 60%, transparent)`,
  flexShrink: 0,
});

export const modeList = style({
  display: "flex",
  background: t.panel,
  border: `1px solid ${t.border}`,
  borderRadius: 6,
  padding: 2,
});
globalStyle(`${modeList} [data-tabs-trigger]`, {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  padding: "3px 8px",
  borderRadius: 4,
  color: t.muted,
});
globalStyle(`${modeList} [data-tabs-trigger][data-state="active"]`, {
  background: t.absent,
  color: t.ink,
});

export const iconBtn = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 6,
  background: t.panel,
  border: `1px solid ${t.border}`,
  color: t.muted,
  flexShrink: 0,
  selectors: {
    "&:hover:not(:disabled)": { background: t.highlight, color: t.ink },
    "&:disabled": { opacity: 0.4 },
  },
});

export const toastWrap = style({
  position: "absolute",
  top: 52,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 50,
});
export const toast = style({
  background: t.toast,
  color: t.toastInk,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.05em",
  padding: "6px 14px",
  borderRadius: 6,
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
  animation: `${toastPop} 0.2s ease-out`,
});

export const boardWrap = style({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "8px 0",
  minHeight: 0,
});
export const statusLine = style({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: t.muted,
  fontVariantNumeric: "tabular-nums",
});
export const grid = style({
  display: "grid",
  gridTemplateRows: "repeat(6, 1fr)",
  gap: 6,
  width: 270,
  height: 324,
  "@container": { "(max-width: 380px)": { width: 236, height: 284 } },
});
export const row = style({
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 6,
});
export const rowShake = style({
  animation: `${shake} 0.4s ease-in-out`,
});
export const tile = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  fontSize: 22,
  fontWeight: 800,
  textTransform: "uppercase",
  background: t.tileEmpty,
  border: `2px solid ${t.tileEmptyBorder}`,
  borderRadius: 6,
  color: t.ink,
  boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.04), 0 2px 4px rgba(0, 0, 0, 0.3)",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  selectors: {
    '&[data-filled="true"]': { borderColor: t.tileActive },
    '&[data-pop="true"]': { animation: `${popLetter} 0.1s ease-out` },
    '&[data-state="correct"]': {
      background: t.correct,
      borderColor: t.correctBorder,
      color: "#ffffff",
      boxShadow: `0 2px 6px color-mix(in srgb, ${t.correct} 35%, transparent)`,
    },
    '&[data-state="present"]': {
      background: t.present,
      borderColor: t.presentBorder,
      color: "#ffffff",
      boxShadow: `0 2px 6px color-mix(in srgb, ${t.present} 35%, transparent)`,
    },
    '&[data-state="absent"]': {
      background: t.absent,
      borderColor: t.absentBorder,
      color: t.muted,
      boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.04), 0 2px 4px rgba(0, 0, 0, 0.3)",
    },
  },
});

export const keyboard = style({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  width: "100%",
  maxWidth: 412,
  margin: "0 auto",
  flexShrink: 0,
  paddingTop: 4,
});
export const keyboardRow = style({
  display: "flex",
  justifyContent: "center",
  gap: 4,
  touchAction: "manipulation",
});
export const key = style({
  flex: 1,
  height: 48,
  borderRadius: 5,
  background: t.key,
  color: t.ink,
  fontSize: 14,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textTransform: "uppercase",
  border: `1px solid ${t.keyBorder}`,
  borderBottom: `3px solid ${t.keyShadow}`,
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.25)",
  selectors: {
    "&:active, &[data-pressed='true']": {
      transform: "translateY(2px)",
      borderBottomWidth: 1,
      background: t.keyActive,
    },
    "&:disabled": { opacity: 1 },
    '&[data-state="correct"]': {
      background: t.correct,
      borderColor: t.correctBorder,
      borderBottomColor: t.correctDeep,
      color: "#ffffff",
    },
    '&[data-state="present"]': {
      background: t.present,
      borderColor: t.presentBorder,
      borderBottomColor: t.presentDeep,
      color: "#ffffff",
    },
    '&[data-state="absent"]': {
      background: t.absent,
      borderColor: t.absentBorder,
      borderBottomColor: t.absentDeep,
      color: t.dim,
      opacity: 0.6,
    },
    '&[data-wide="true"]': {
      flex: 1.5,
      fontSize: 11,
      letterSpacing: "0.04em",
    },
  },
  "@container": { "(max-width: 380px)": { height: 42, fontSize: 13 } },
});

export const dialogOverlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: t.overlay,
  backdropFilter: "blur(4px)",
});
export const dialogCard = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 101,
  width: "calc(100% - 32px)",
  maxWidth: 380,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 20,
  background: t.surface,
  border: `1px solid ${t.border}`,
  borderRadius: 12,
  boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6)",
  outline: "none",
  color: t.ink,
});
export const dialogHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
});
globalStyle(`${dialogHead} h2, ${dialogHead} [data-dialog-title]`, {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});
export const dialogClose = style({
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  borderRadius: 6,
  background: t.panel,
  border: `1px solid ${t.border}`,
  color: t.muted,
  selectors: { "&:hover": { background: t.highlight, color: t.ink } },
});
export const dialogCopy = style({
  margin: 0,
  fontSize: 13,
  color: t.muted,
  letterSpacing: "0.02em",
});

export const statsGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  textAlign: "center",
});
export const statItem = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
});
export const statValue = style({
  fontSize: 24,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  color: t.focus,
});
export const statLabel = style({
  fontSize: 10,
  color: t.dim,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});

export const distTitle = style({
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: t.muted,
  textTransform: "uppercase",
  marginBottom: 8,
});
export const distRows = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
});
export const distRow = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
});
export const distIdx = style({
  width: 12,
  color: t.dim,
  fontWeight: 700,
});
export const distTrack = style({
  flex: 1,
  height: 18,
  background: t.chassis,
  borderRadius: 4,
  overflow: "hidden",
  display: "flex",
});
export const distBar = style({
  background: t.absent,
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingRight: 6,
  fontSize: 10,
  fontWeight: 700,
  color: t.ink,
  minWidth: 18,
  selectors: {
    '&[data-highlight="true"]': { background: t.correct },
  },
});

export const dialogActions = style({
  display: "flex",
  gap: 8,
  marginTop: 4,
});
export const actionBtn = style({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: 10,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});
export const actionPrimary = style({
  background: t.correct,
  color: "#ffffff",
  selectors: { "&:hover:not(:disabled)": { background: t.correctDeep } },
});
export const actionSecondary = style({
  background: t.highlight,
  color: t.ink,
  selectors: { "&:hover:not(:disabled)": { background: t.absent } },
});

export const error = style({
  margin: "8px 0 0",
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.panel,
  color: t.danger,
  overflowWrap: "anywhere",
});
globalStyle(`${error} [data-button-root]`, {
  marginLeft: 8,
  border: `1px solid ${t.border}`,
  borderRadius: 5,
  padding: "3px 7px",
  color: t.ink,
  fontSize: 11,
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

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important", transitionDuration: "0s !important" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconBezel = style({
  width: 472,
  height: 472,
  borderRadius: 48,
  background: `radial-gradient(circle at 50% 20%, ${t.chassisMid} 0%, ${t.chassis} 80%)`,
  border: `4px solid ${t.highlight}`,
  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7), inset 0 2px 2px rgba(255, 255, 255, 0.1)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "34px 28px 30px",
});
export const iconBrandStrip = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
});
export const iconBrandTitle = style({
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: "0.22em",
  color: "#ffffff",
  textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
});
export const iconBrandDot = style({
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: t.correctBorder,
  boxShadow: `0 0 12px color-mix(in srgb, ${t.correctBorder} 80%, transparent)`,
});
export const iconGrid = style({
  display: "flex",
  flexDirection: "column",
  gap: 10,
});
export const iconRow = style({
  display: "flex",
  gap: 10,
});
export const iconTile = style({
  width: 68,
  height: 68,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 36,
  fontWeight: 900,
  color: "#ffffff",
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.4), inset 0 2px 2px rgba(255, 255, 255, 0.25)",
  border: "2px solid rgba(255, 255, 255, 0.15)",
  selectors: {
    '&[data-tone="correct"]': {
      background: `linear-gradient(180deg, ${t.correctBorder} 0%, ${t.correct} 100%)`,
      borderColor: t.correctBorder,
    },
    '&[data-tone="present"]': {
      background: `linear-gradient(180deg, ${t.presentBorder} 0%, ${t.present} 100%)`,
      borderColor: t.presentBorder,
    },
    '&[data-tone="absent"]': {
      background: `linear-gradient(180deg, ${t.absentBorder} 0%, ${t.absent} 100%)`,
      borderColor: t.tileActive,
      color: t.muted,
    },
    '&[data-tone="empty"]': {
      background: t.surface,
      borderColor: t.highlight,
      boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.5)",
    },
  },
});
export const iconIndicator = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "0 8px",
});
export const iconBar = style({
  flex: 1,
  height: 6,
  background: t.correctBorder,
  borderRadius: 3,
  marginRight: 14,
  boxShadow: `0 0 10px color-mix(in srgb, ${t.correctBorder} 50%, transparent)`,
});
export const iconBadge = style({
  fontSize: 14,
  fontWeight: 800,
  color: t.muted,
  letterSpacing: "0.08em",
});

export const exportDevice = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "14px 16px 16px",
  color: t.ink,
  background: `radial-gradient(circle at 50% 0%, ${t.chassisMid} 0%, ${t.chassis} 75%)`,
  border: `1px solid ${t.border}`,
});
export const exportHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  paddingBottom: 8,
  borderBottom: `1px solid ${t.border}`,
});
export const exportMeta = style({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: t.muted,
  fontVariantNumeric: "tabular-nums",
});
export const exportBoard = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "8px 0 4px",
});
