import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
globalFontFace("Recipe Fraunces", { src: 'url("../assets/fonts/Fraunces.ttf") format("truetype")', fontWeight: 600, fontDisplay: "swap" });
globalStyle("::selection", { background: t.accentSoft, color: t.ink });
globalStyle("input, textarea", { caretColor: t.accent });

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: t.paper });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit", outline: 0 });
globalStyle("button", { cursor: "pointer" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("input[type='number']", { appearance: "textfield" });
globalStyle("input::-webkit-inner-spin-button, input::-webkit-outer-spin-button", { appearance: "none" });
globalStyle("::placeholder", { color: `color-mix(in srgb, ${t.muted} 70%, transparent)`, opacity: 1 });
globalStyle("input:focus-visible, textarea:focus-visible", { borderBottomColor: t.accent, boxShadow: `inset 0 -1px 0 ${t.accent}` });
globalStyle("button:focus-visible, [data-select-trigger]:focus-visible, [data-checkbox-root]:focus-visible, [data-dialog-trigger]:focus-visible, [data-dialog-close]:focus-visible, [data-button-root]:focus-visible", {
  outline: `3px solid color-mix(in srgb, ${t.accent} 40%, transparent)`,
  outlineOffset: 2,
});

export const canvas = style({ minHeight: "100%", containerType: "inline-size", background: t.paper });
export const card = style({ minHeight: "100%", background: t.paper });
export const srOnly = style({ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap" });

export const hero = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 180px",
  minHeight: 244,
  borderBottom: `1px solid ${t.rule}`,
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "1fr", height: "auto" } },
});
export const intro = style({
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  padding: "21px 22px 18px 24px",
  "@container": { "(max-width: 560px)": { minHeight: 220, padding: "19px 18px 15px" } },
});
export const utilityLine = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 14,
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".15em",
  textTransform: "uppercase",
});
export const difficultyTrigger = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 36,
  border: 0,
  borderRadius: 6,
  padding: "5px 10px 5px 11px",
  color: t.accent,
  background: t.accentSoft,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  cursor: "pointer",
});
export const selectContent = style({
  zIndex: 70,
  minWidth: "var(--bits-select-anchor-width)",
  overflow: "hidden",
  border: `1px solid ${t.rule}`,
  borderRadius: 10,
  padding: 4,
  background: t.paper,
  color: t.ink,
  boxShadow: `0 10px 28px color-mix(in srgb, ${t.ink} 16%, transparent)`,
  outline: 0,
});
globalStyle(`${selectContent} [data-select-item]`, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  minHeight: 40,
  borderRadius: 7,
  padding: "0 9px",
  fontSize: 14,
  outline: 0,
  cursor: "pointer",
});
globalStyle(`${selectContent} [data-highlighted]`, { color: t.onAccent, background: t.accent });

export const title = style({
  color: t.accent,
  width: "100%",
  marginTop: "auto",
  border: 0,
  borderBottom: "1px solid transparent",
  padding: 0,
  resize: "none",
  overflow: "hidden",
  background: "transparent",
  fontFamily: t.headingFont,
  fontSize: "clamp(34px, 7cqw, 48px)",
  fontWeight: 600,
  lineHeight: 1.04,
  letterSpacing: "-.03em",
});
export const titleText = style({
  color: t.accent,
  margin: "auto 0 0",
  fontFamily: t.headingFont,
  fontSize: "clamp(34px, 7cqw, 48px)",
  fontWeight: 600,
  lineHeight: 1.04,
  letterSpacing: "-.03em",
  overflowWrap: "anywhere",
});
export const description = style({
  width: "100%",
  minHeight: 38,
  marginTop: 9,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: 0,
  resize: "none",
  color: t.muted,
  background: "transparent",
  fontSize: 14,
  lineHeight: 1.45,
});
export const descriptionText = style({
  margin: "9px 0 0",
  color: t.muted,
  fontSize: 14,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});
export const stats = style({
  display: "flex",
  gap: 7,
  marginTop: 11,
  "@container": { "(max-width: 380px)": { flexWrap: "wrap" } },
});
globalStyle(`${stats} label, ${stats} > div`, {
  display: "grid",
  minWidth: 72,
  borderRadius: 0,
  padding: "7px 12px 6px 0",
  background: "transparent",
});
globalStyle(`${stats} label > span:first-child, ${stats} > div > span:first-child`, {
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".12em",
  textTransform: "uppercase",
});
globalStyle(`${stats} input`, {
  width: 36,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "2px 0 0",
  background: "transparent",
  fontSize: 15,
  fontWeight: 750,
});
export const number = style({ display: "flex", alignItems: "baseline", gap: 3 });
globalStyle(`${number} small`, { color: t.muted, fontSize: 8 });

export const photoWell = style({
  position: "relative",
  minHeight: 0,
  margin: 0,
  overflow: "hidden",
  display: "grid",
  placeItems: "center",
  background: t.paperSoft,
  selectors: { '&[data-photo="false"]': { margin: "24px 18px 24px 0", minHeight: 140, borderRadius: 12 } },
  "@container": { "(max-width: 560px)": { height: 150, selectors: { '&[data-photo="false"]': { height: 64, minHeight: 64, margin: "0 18px 16px" } } } },
});
globalStyle(`${photoWell} img`, { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "cover" });
export const photoActions = style({ position: "absolute", right: 12, bottom: 12, display: "flex", gap: 6 });
globalStyle(`${photoActions} button`, {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 31,
  border: "1px solid rgb(255 255 255 / 22%)",
  borderRadius: 6,
  padding: "0 11px",
  color: t.onAccent,
  background: "rgb(16 42 35 / 88%)",
  fontSize: 11,
  fontWeight: 750,
});
export const photoRemove = style({ width: 31, justifyContent: "center", padding: "0 !important" });

export const cookingLaunch = style({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 11,
  width: "calc(100% - 32px)",
  margin: "10px 16px 0",
  border: 0,
  borderRadius: 10,
  padding: "7px 9px",
  color: t.onAccent,
  textAlign: "left",
  background: t.tomato,
  cursor: "pointer",
  selectors: {
    "&:hover": { background: `color-mix(in srgb, ${t.tomato} 85%, ${t.ink})` },
    "&:disabled": { cursor: "default", opacity: 0.45 },
  },
  "@container": { "(max-width: 560px)": { width: "calc(100% - 24px)", marginInline: 12 } },
});
export const launchMark = style({
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  color: t.onAccent,
  background: "transparent",
});
export const launchCopy = style({ display: "grid", gap: 2 });
globalStyle(`${launchCopy} strong`, { fontFamily: t.font, fontSize: 16, fontWeight: 700 });
globalStyle(`${launchCopy} small`, { color: t.onAccent, fontFamily: t.mono, fontSize: 10, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase" });
export const launchAction = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 5px 7px 12px",
  color: t.onAccent,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  "@container": {
    "(max-width: 380px)": { fontSize: 0, gap: 0, padding: 8, color: t.onAccent },
  },
});
globalStyle(`${launchAction} svg`, { flexShrink: 0 });

export const body = style({
  display: "grid",
  gridTemplateColumns: ".94fr 1.06fr",
  gap: 22,
  margin: "8px 18px 0",
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "1fr", gap: 4, marginInline: 14 } },
});
export const section = style({ minWidth: 0, paddingTop: 7 });
export const sectionTitle = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: 31,
  marginBottom: 4,
  borderBottom: `1px solid ${t.accent}`,
  paddingBottom: 7,
});
globalStyle(`${sectionTitle} > div`, { display: "flex", alignItems: "baseline", gap: 9 });
globalStyle(`${sectionTitle} span`, { color: t.accent, fontFamily: t.mono, fontSize: 10, fontWeight: 800 });
globalStyle(`${sectionTitle} h2`, { margin: 0, color: t.accent, fontFamily: t.headingFont, fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" });
globalStyle(`${sectionTitle} > button`, {
  display: "grid",
  placeItems: "center",
  width: 36,
  height: 36,
  border: 0,
  borderRadius: 7,
  padding: 0,
  color: t.accent,
  background: t.paperSoft,
});

export const list = style({ display: "grid", margin: 0, padding: 0, listStyle: "none" });
export const ingredientRow = style({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr)",
  alignItems: "start",
  minWidth: 0,
  minHeight: 44,
  padding: "5px 0",
  borderBottom: `1px solid ${t.rule}`,
  selectors: { "&:last-child": { borderBottom: 0 } },
});
globalStyle(`${ingredientRow} [data-checkbox-root]`, {
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  marginTop: 5,
  padding: 0,
  border: `1.5px solid ${t.accent}`,
  borderRadius: 3,
  background: "transparent",
  color: t.onAccent,
});
globalStyle(`${ingredientRow} [data-state="checked"]`, { background: t.accent, borderColor: t.accent });
export const itemCopy = style({
  width: "100%",
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "4px 0",
  color: t.ink,
  background: "transparent",
  fontSize: 14,
  lineHeight: 1.4,
});
globalStyle(`${ingredientRow}[data-checked="true"] .${itemCopy}`, { color: t.muted, textDecoration: "line-through" });
export const itemText = style({
  padding: "4px 0",
  color: t.ink,
  fontSize: 14,
  lineHeight: 1.4,
  overflowWrap: "anywhere",
});
globalStyle(`${ingredientRow}[data-checked="true"] .${itemText}`, { color: t.muted, textDecoration: "line-through" });

export const stepRow = style({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "27px minmax(0, 1fr) 40px",
  alignItems: "start",
  minWidth: 0,
  minHeight: 62,
  padding: "6px 0",
  borderBottom: `1px solid ${t.rule}`,
  selectors: { "&:last-child": { borderBottom: 0 } },
  "@container": { "(max-width: 380px)": { gridTemplateColumns: "27px minmax(0, 1fr)" } },
});
export const stepNumber = style({
  display: "grid",
  placeItems: "center",
  width: 20,
  height: 20,
  marginTop: 3,
  borderRadius: "50%",
  color: t.onAccent,
  background: t.accent,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
});
export const stepCopy = style({ minWidth: 0 });
export const stepTitle = style({
  width: "100%",
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "4px 0 1px",
  color: t.ink,
  background: "transparent",
  fontFamily: t.font,
  fontSize: 14,
  fontWeight: 600,
});
export const stepTitleText = style({
  margin: 0,
  fontFamily: t.font,
  fontSize: 14,
  fontWeight: 600,
  overflowWrap: "anywhere",
});
globalStyle(`${stepCopy} textarea`, {
  width: "100%",
  minHeight: 44,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "4px 0",
  resize: "none",
  color: t.muted,
  background: "transparent",
  fontSize: 13,
  lineHeight: 1.4,
});
export const stepBodyText = style({
  margin: "2px 0 0",
  color: t.muted,
  fontSize: 13,
  lineHeight: 1.4,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});
export const stepTime = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
  gap: 2,
  marginTop: 1,
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 10,
  textTransform: "uppercase",
  "@container": { "(max-width: 380px)": { gridColumn: 2, justifyContent: "flex-start", marginTop: -3 } },
});
globalStyle(`${stepTime} input`, {
  width: 24,
  border: 0,
  borderBottom: `1px solid ${t.rule}`,
  padding: "3px 0",
  color: t.accent,
  textAlign: "right",
  background: "transparent",
  fontSize: 11,
  fontWeight: 750,
});

export const rowActions = style({
  position: "absolute",
  top: 3,
  right: 0,
  display: "flex",
  gap: 2,
  padding: 2,
  borderRadius: 6,
  background: t.paperSoft,
  opacity: 0,
  selectors: {
    [`${ingredientRow}:hover &, ${stepRow}:hover &, &:focus-within`]: { opacity: 1 },
  },
  "@media": { "(hover: none)": { opacity: 1 } },
});
globalStyle(`${rowActions} button`, {
  display: "grid",
  placeItems: "center",
  width: 20,
  height: 20,
  border: 0,
  borderRadius: 4,
  padding: 0,
  color: t.muted,
  background: "transparent",
});
globalStyle(`${rowActions} button:hover`, { color: t.accent, background: t.accentSoft });
globalStyle(`${rowActions} button:disabled`, { opacity: 0.2 });

export const empty = style({
  margin: "10px 0 14px",
  color: t.muted,
  fontSize: 14,
  lineHeight: 1.45,
});
export const error = style({
  margin: "0 18px 12px",
  color: t.accent,
  fontSize: 11,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.paperSoft,
  color: t.ink,
  fontSize: 11,
});

export const cookOverlay = style({ position: "fixed", inset: 0, zIndex: 90, background: "rgb(26 20 18 / 72%)" });
export const cookDialog = style({
  position: "fixed",
  inset: 0,
  zIndex: 91,
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr) auto",
  width: "100vw",
  height: "100vh",
  overflow: "auto",
  border: 0,
  padding: 0,
  color: t.onAccent,
  background: t.cook,
  outline: 0,
});
export const cookHeader = style({
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr) 34px",
  alignItems: "center",
  gap: 11,
  padding: "19px 24px 12px",
  "@media": { "(max-width: 560px)": { paddingInline: 18 } },
});
globalStyle(`${cookHeader} img`, { width: 42, height: 42, borderRadius: 10, objectFit: "cover" });
globalStyle(`${cookHeader} div`, { display: "grid", gap: 2, minWidth: 0 });
globalStyle(`${cookHeader} span`, { color: t.herb, fontFamily: t.mono, fontSize: 10, fontWeight: 800, letterSpacing: ".13em" });
globalStyle(`${cookHeader} strong`, {
  overflow: "hidden",
  color: t.cookMuted,
  fontFamily: t.font,
  fontSize: 14,
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const cookClose = style({
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  border: 0,
  borderRadius: 9,
  padding: 0,
  color: t.cookMuted,
  background: t.cookSoft,
});
export const cookProgress = style({
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "1fr",
  gap: 5,
  margin: "0 24px",
});
globalStyle(`${cookProgress} span`, { height: 4, borderRadius: 99, background: `color-mix(in srgb, ${t.onAccent} 16%, ${t.cook})` });
globalStyle(`${cookProgress} span[data-state="current"]`, { background: t.herb });
globalStyle(`${cookProgress} span[data-state="complete"]`, { background: t.herb });

export const cookStage = style({
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  width: "min(620px, calc(100vw - 48px))",
  margin: "auto",
  padding: "32px 0 26px",
  textAlign: "center",
});
export const stepKicker = style({
  margin: "0 0 13px",
  color: t.herb,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".15em",
});
globalStyle(`${cookStage} h2`, {
  maxWidth: 590,
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: "clamp(2.4rem, 8vw, 5rem)",
  fontWeight: 600,
  lineHeight: 1.04,
  letterSpacing: "-.03em",
});
globalStyle(`${cookStage} > p[data-dialog-description]`, {
  maxWidth: 520,
  margin: "18px 0 0",
  color: t.cookMuted,
  fontSize: "clamp(13px, 2vw, 17px)",
  lineHeight: 1.55,
});

export const stepTimer = style({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "end",
  gap: "2px 26px",
  minWidth: "min(370px, 100%)",
  marginTop: 30,
  overflow: "hidden",
  borderRadius: 14,
  padding: "13px 14px 13px 17px",
  textAlign: "left",
  background: t.cookSoft,
  "@media": {
    "(max-width: 380px)": { gridTemplateColumns: "1fr", width: "100%", minWidth: 0 },
  },
});
export const timerFill = style({
  position: "absolute",
  inset: 0,
  zIndex: 0,
  transformOrigin: "left center",
  background: `color-mix(in srgb, ${t.accent} 22%, ${t.cookSoft})`,
  pointerEvents: "none",
});
export const timerCaption = style({
  position: "relative",
  zIndex: 1,
  gridColumn: 1,
  color: t.cookMuted,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".13em",
  selectors: { [`${stepTimer}[data-expired="true"] &`]: { color: t.accent } },
});
globalStyle(`${stepTimer} output`, {
  position: "relative",
  zIndex: 1,
  gridColumn: 1,
  color: t.accentSoft,
  fontFamily: t.mono,
  fontSize: 48,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: ".04em",
  lineHeight: 1,
});
globalStyle(`${stepTimer} > div`, {
  position: "relative",
  zIndex: 1,
  gridColumn: 2,
  gridRow: "1 / span 2",
  display: "flex",
  alignItems: "center",
  gap: 7,
  "@media": { "(max-width: 380px)": { gridColumn: 1, gridRow: "auto", marginTop: 10 } },
});
globalStyle(`${stepTimer} button`, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  height: 44,
  border: 0,
  borderRadius: 9,
  padding: "0 12px",
  background: t.cook,
});
export const timerReset = style({ width: 44, padding: "0 !important", color: t.cookMuted });
export const timerMain = style({
  minWidth: 90,
  color: t.cook,
  background: `${t.herb} !important`,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  "@media": { "(max-width: 380px)": { flex: 1 } },
});

export const untimedStep = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: "min(330px, 100%)",
  marginTop: 30,
  borderRadius: 13,
  padding: "13px 16px",
  textAlign: "left",
  background: t.cookSoft,
});
globalStyle(`${untimedStep} > span`, {
  display: "grid",
  placeItems: "center",
  width: 31,
  height: 31,
  borderRadius: "50%",
  color: t.herb,
  background: `color-mix(in srgb, ${t.herb} 18%, ${t.cookSoft})`,
  fontSize: 17,
});
globalStyle(`${untimedStep} p`, { display: "grid", gap: 2, margin: 0, color: t.cookMuted, fontSize: 9 });
globalStyle(`${untimedStep} strong`, { color: t.cookMuted, fontFamily: t.headingFont, fontSize: 14, fontWeight: 600 });

export const cookNav = style({
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 14,
  padding: "12px 24px 20px",
  "@media": {
    "(max-width: 560px)": { paddingInline: 18 },
    "(max-width: 380px)": { gridTemplateColumns: "1fr 1fr" },
  },
});
const cookButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minWidth: 108,
  height: 44,
  border: 0,
  borderRadius: 9,
  padding: "0 14px",
  color: t.cookMuted,
  background: t.cookSoft,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
} as const;
globalStyle(`${cookNav} button`, cookButton);
globalStyle(`${cookNav} button:disabled`, { cursor: "default", opacity: 0.28 });
globalStyle(`${cookNav} > span`, {
  color: t.cookMuted,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".08em",
  "@media": { "(max-width: 380px)": { display: "none" } },
});
export const cookNext = style({ justifySelf: "end", color: `${t.cook} !important`, background: `${t.herb} !important` });
globalStyle(`${cookNav} button`, { "@media": { "(max-width: 380px)": { width: "100%", minWidth: 0 } } });

export const cookFinished = style({
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  minHeight: 0,
  padding: "36px 24px",
  textAlign: "center",
});
export const finishedMark = style({
  display: "grid",
  placeItems: "center",
  width: 64,
  height: 64,
  marginBottom: 18,
  borderRadius: "50%",
  color: t.cook,
  background: t.herb,
  fontSize: 27,
  fontWeight: 800,
});
export const finishActions = style({ display: "flex", gap: 8, marginTop: 28 });
globalStyle(`${finishActions} button`, cookButton);
globalStyle(`${cookFinished} h2`, {
  maxWidth: 590,
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: "clamp(2.4rem, 8vw, 5rem)",
  fontWeight: 600,
  lineHeight: 1.04,
  letterSpacing: "-.03em",
});
globalStyle(`${cookFinished} > p[data-dialog-description]`, {
  maxWidth: 520,
  margin: "18px 0 0",
  color: t.cookMuted,
  fontSize: "clamp(13px, 2vw, 17px)",
  lineHeight: 1.55,
});
export const finishDone = style({ color: `${t.cook} !important`, background: `${t.herb} !important` });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle('html[data-slop-capture="static"] input, html[data-slop-capture="static"] textarea', { borderBottomColor: "transparent", boxShadow: "none" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: ".01ms !important", animationDuration: ".01ms !important", scrollBehavior: "auto" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center", background: "transparent" });
export const iconBook = style({ display: "block", width: "100%", height: "100%", color: t.accent });
export const photoInvitation = style({ display: "grid", gap: 10, placeItems: "center", border: 0, padding: 16, color: t.accent, background: "transparent", fontSize: 13, fontWeight: 600, minHeight: 44, ":focus-visible": { outline: `2px solid ${t.accent}`, outlineOffset: 2 }, "@container": { "(max-width: 560px)": { display: "flex", justifyContent: "center", width: "100%" } } });

export const cookingTitle = style({ margin: 0, fontFamily: t.headingFont, fontSize: "clamp(36px, 8vw, 64px)", fontWeight: 600, lineHeight: 1.04, letterSpacing: "-.03em", overflowWrap: "anywhere" });
export const cookingDescription = style({ maxWidth: 520, margin: "18px 0 0", color: t.cookMuted, fontSize: 17, lineHeight: 1.55 });

export const cookBookMark = style({ width: 42, height: 42 });
