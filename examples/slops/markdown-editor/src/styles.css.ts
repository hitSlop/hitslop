import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", height: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: t.desk });
globalStyle("button, input, textarea, [data-button-root], [data-tabs-trigger]", { font: "inherit", color: "inherit" });
globalStyle("button, [data-button-root], [data-tabs-trigger]", { cursor: "pointer", WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled, [data-button-root]:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, input:focus-visible, textarea:focus-visible, [data-button-root]:focus-visible, [data-tabs-trigger]:focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 2,
});
globalStyle("textarea", { resize: "none" });
globalStyle("::placeholder", { color: t.dim, opacity: 1 });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important", transitionDuration: "0s !important", scrollBehavior: "auto" } },
});

const settle = {
  transitionProperty: "background-color, color, border-color, box-shadow, opacity",
  transitionDuration: "120ms",
  transitionTimingFunction: "ease",
} as const;

export const canvas = style({
  display: "flex",
  width: "100%",
  height: "100%",
  padding: 10,
  overflow: "hidden",
  color: t.ink,
  background: t.desk,
  colorScheme: "light",
  containerType: "inline-size",
  selectors: {
    '&[data-theme="dark"]': {
      colorScheme: "dark",
      vars: {
        "--slop-desk": t.darkDesk,
        "--slop-paper": t.darkPaper,
        "--slop-ink": t.darkInk,
        "--slop-muted": t.darkMuted,
        "--slop-dim": t.darkDim,
        "--slop-rule": t.darkRule,
        "--slop-rule-muted": t.darkRuleMuted,
        "--slop-accent": t.darkAccent,
        "--slop-caret": t.darkCaret,
        "--slop-code": t.darkCode,
        "--slop-quote": t.darkQuote,
        "--slop-on-accent": t.darkOnAccent,
        "--slop-shadow": t.darkShadow,
      },
    },
  },
});

export const sheet = style({
  display: "flex",
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  flexDirection: "column",
  overflow: "hidden",
  background: t.paper,
  border: `1.5px solid ${t.rule}`,
  borderRadius: 18,
  boxShadow: t.shadow,
});

export const header = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  background: `color-mix(in srgb, ${t.ink} 3%, ${t.paper})`,
  borderBottom: `1px solid ${t.ruleMuted}`,
});
export const title = style({
  minWidth: 120,
  flex: 1,
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  padding: "2px 0",
  background: "transparent",
  color: t.ink,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  selectors: { "&:focus": { borderBottomColor: t.caret } },
});
export const actions = style({ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 });

export const tabs = style({
  display: "flex",
  padding: 2,
  background: `color-mix(in srgb, ${t.ink} 6%, transparent)`,
  border: `1px solid ${t.ruleMuted}`,
  borderRadius: 8,
});
export const tab = style({
  ...settle,
  border: 0,
  borderRadius: 6,
  padding: "4px 10px",
  background: "transparent",
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 650,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  selectors: {
    '&[data-state="active"]': {
      background: t.paper,
      color: t.ink,
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    },
  },
});

export const iconBtn = style({
  ...settle,
  display: "grid",
  placeItems: "center",
  width: 28,
  height: 28,
  padding: 0,
  color: t.muted,
  background: "transparent",
  border: `1px solid ${t.ruleMuted}`,
  borderRadius: 8,
  selectors: {
    "&:hover": { color: t.ink, borderColor: t.rule },
    '&[data-copied="true"]': { color: t.accent, borderColor: t.accent },
  },
});

export const toolbar = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 16px",
  background: `color-mix(in srgb, ${t.ink} 2%, ${t.paper})`,
  borderBottom: `1px solid ${t.ruleMuted}`,
});
export const toolBtn = style({
  ...settle,
  display: "grid",
  placeItems: "center",
  width: 28,
  height: 26,
  padding: 0,
  color: t.ink,
  background: "transparent",
  border: 0,
  borderRadius: 6,
  selectors: { "&:hover": { background: `color-mix(in srgb, ${t.ink} 8%, transparent)` } },
});
export const toolSep = style({
  width: 1,
  height: 14,
  margin: "0 4px",
  background: t.rule,
});

export const body = style({
  display: "flex",
  position: "relative",
  minHeight: 0,
  flex: 1,
  overflow: "hidden",
});

export const overtype = style({
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
});
const typeFace = {
  fontFamily: t.mono,
  fontSize: 14,
  lineHeight: 1.65,
  tabSize: 2,
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  padding: "20px 24px",
} as const;
export const textarea = style({
  ...typeFace,
  position: "absolute",
  inset: 0,
  zIndex: 2,
  width: "100%",
  height: "100%",
  margin: 0,
  border: 0,
  color: "transparent",
  caretColor: t.caret,
  background: "transparent",
  overflowY: "auto",
  scrollbarGutter: "stable",
});
export const backdrop = style({
  ...typeFace,
  position: "absolute",
  inset: 0,
  zIndex: 1,
  overflowY: "auto",
  color: t.ink,
  pointerEvents: "none",
  scrollbarGutter: "stable",
  scrollbarWidth: "none",
  selectors: { "&::-webkit-scrollbar": { width: 0, height: 0 } },
});
export const placeholder = style({
  position: "absolute",
  top: 20,
  left: 24,
  right: 24,
  zIndex: 1,
  margin: 0,
  color: t.dim,
  fontFamily: t.mono,
  fontSize: 14,
  lineHeight: 1.65,
  fontStyle: "italic",
  pointerEvents: "none",
});

export const syntaxHash = style({ color: t.accent, fontWeight: 800 });
export const syntaxHeading = style({ color: t.ink, fontWeight: 800 });
export const syntaxBold = style({ fontWeight: 800 });
export const syntaxItalic = style({ fontStyle: "italic" });
export const syntaxCode = style({
  padding: "1px 4px",
  color: t.accent,
  background: t.code,
  borderRadius: 4,
});
export const syntaxQuote = style({ color: t.muted });
export const syntaxToken = style({ color: t.accent, opacity: 0.75 });

export const split = style({
  display: "flex",
  width: "100%",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  "@container": { "(max-width: 560px)": { flexDirection: "column" } },
});
export const pane = style({
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: "auto",
  padding: "20px 24px",
});
export const source = style({
  display: "block",
  width: "100%",
  height: "100%",
  minHeight: 160,
  margin: 0,
  border: 0,
  padding: 0,
  color: t.ink,
  background: "transparent",
  fontFamily: t.mono,
  fontSize: 13.5,
  lineHeight: 1.6,
  tabSize: 2,
  overflowY: "auto",
});
export const divider = style({
  width: 1,
  background: t.rule,
  "@container": { "(max-width: 560px)": { width: "100%", height: 1 } },
});

export const preview = style({
  display: "flex",
  width: "100%",
  height: "100%",
  justifyContent: "center",
  overflow: "auto",
  padding: "24px 32px",
});

export const prose = style({
  width: "100%",
  maxWidth: 680,
  color: t.ink,
  fontFamily: t.font,
  fontSize: 16,
  lineHeight: 1.7,
});
globalStyle(`${prose} > :first-child`, { marginTop: 0 });
globalStyle(`${prose} > :last-child`, { marginBottom: 0 });
globalStyle(`${prose} h1`, {
  margin: "1.2em 0 0.6em",
  paddingBottom: 6,
  borderBottom: `1px solid ${t.ruleMuted}`,
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1.25,
  letterSpacing: "-0.02em",
});
globalStyle(`${prose} h2`, { margin: "1.2em 0 0.5em", fontSize: 20, fontWeight: 700, lineHeight: 1.3 });
globalStyle(`${prose} h3, ${prose} h4`, { margin: "1em 0 0.4em", fontSize: 16, fontWeight: 700 });
globalStyle(`${prose} p`, { margin: "0 0 1em" });
globalStyle(`${prose} ul, ${prose} ol`, { margin: "0 0 1em", paddingLeft: "1.6em" });
globalStyle(`${prose} li`, { marginBottom: "0.25em" });
globalStyle(`${prose} blockquote`, {
  margin: "1.2em 0",
  paddingLeft: 14,
  borderLeft: `4px solid ${t.quote}`,
  color: t.muted,
  fontStyle: "italic",
});
globalStyle(`${prose} pre`, {
  margin: "1em 0",
  padding: "12px 14px",
  overflowX: "auto",
  background: t.code,
  borderRadius: 8,
  fontFamily: t.mono,
  fontSize: 13,
  lineHeight: 1.5,
});
globalStyle(`${prose} code`, {
  fontFamily: t.mono,
  fontSize: "0.9em",
  background: t.code,
  padding: "2px 4px",
  borderRadius: 4,
});
globalStyle(`${prose} pre code`, { padding: 0, background: "transparent" });
globalStyle(`${prose} a`, { color: t.accent });
globalStyle(`${prose} hr`, { border: 0, height: 1, margin: "2em 0", background: t.rule });
globalStyle(`${prose} img`, { maxWidth: "100%", height: "auto" });
globalStyle(`${prose} table`, { width: "100%", margin: "1em 0", borderCollapse: "collapse", fontSize: 14 });
globalStyle(`${prose} th, ${prose} td`, { padding: "6px 8px", borderBottom: `1px solid ${t.ruleMuted}`, textAlign: "left" });

export const empty = style({ margin: 0, color: t.dim, fontStyle: "italic" });

export const footer = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 16px",
  borderTop: `1px solid ${t.ruleMuted}`,
  background: `color-mix(in srgb, ${t.ink} 3%, ${t.paper})`,
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 650,
});
export const hint = style({
  color: t.dim,
  fontWeight: 500,
  letterSpacing: "0.02em",
  "@container": { "(max-width: 520px)": { display: "none" } },
});

export const error = style({
  position: "absolute",
  right: 22,
  bottom: 18,
  left: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 10px",
  color: t.accent,
  background: t.paper,
  border: `1px solid ${t.accent}`,
  borderRadius: 8,
  fontFamily: t.mono,
  fontSize: 12,
});
globalStyle(`${error} [data-button-root]`, {
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.paper,
  color: t.ink,
  fontSize: 11,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });

export const exportSheet = style({
  display: "flex",
  flexDirection: "column",
  gap: 20,
  padding: "32px 36px 40px",
  color: t.ink,
  background: t.paper,
  containerType: "inline-size",
});
export const exportEyebrow = style({
  margin: "0 0 8px",
  color: t.accent,
  fontFamily: t.mono,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
});
export const exportTitle = style({
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.2,
});
export const exportMeta = style({
  margin: "8px 0 0",
  color: t.muted,
  fontFamily: t.mono,
  fontSize: 12,
});
export const exportProse = style({ maxWidth: "none" });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconPage = style({
  display: "flex",
  width: 300,
  height: 392,
  flexDirection: "column",
  gap: 18,
  padding: "28px 26px 22px",
  background: t.paper,
  borderRadius: 10,
  boxShadow: "0 18px 40px rgba(70, 50, 20, 0.22)",
});
export const iconRule = style({
  width: 72,
  height: 4,
  background: t.accent,
  borderRadius: 2,
});
export const iconHeading = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: t.ink,
  fontFamily: t.mono,
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.04em",
});
export const iconHash = style({ color: t.accent });
export const iconCaret = style({
  width: 3,
  height: 26,
  marginLeft: 2,
  background: t.caret,
  borderRadius: 2,
  boxShadow: `0 0 8px color-mix(in srgb, ${t.caret} 50%, transparent)`,
});
export const iconLines = style({ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 });
export const iconLine = style({
  height: 8,
  borderRadius: 4,
  background: t.quote,
  selectors: {
    "&:nth-child(2)": { width: "92%" },
    "&:nth-child(3)": { width: "64%" },
    "&:nth-child(4)": { width: "80%" },
  },
});
export const iconFoot = style({
  display: "flex",
  justifyContent: "space-between",
  marginTop: "auto",
  paddingTop: 12,
  borderTop: `2px solid ${t.ruleMuted}`,
  color: t.dim,
  fontFamily: t.mono,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
});
