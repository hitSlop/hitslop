import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import loraUrl from "../assets/fonts/Lora.ttf?url";
import theme from "../theme";

const t = theme.vars;
globalFontFace("Journal Lora", {
  src: `url("${loraUrl}") format("truetype")`,
  fontWeight: "400 700",
  fontStyle: "normal",
  fontDisplay: "swap",
});
globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", {
  colorScheme: "light",
  fontFamily: t.font,
  fontSynthesis: "none",
  scrollbarColor: `${t.dim} ${t.paper}`,
});
globalStyle("html, body, #app", {
  width: "100%",
  minHeight: "100%",
  margin: 0,
});
globalStyle("body", { color: t.ink, background: t.surface });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle("::selection", { color: t.ink, background: t.morningDeep });
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transitionDuration: "0s !important",
      animationDuration: "0s !important",
      scrollBehavior: "auto",
    },
  },
});

const focus = { outline: `2px solid ${t.eveningAccent}`, outlineOffset: 3 };
const padding = {
  paddingInline: "44px 32px",
  "@container": { "(max-width: 420px)": { paddingInline: "28px 20px" } },
};

// The binding belongs to the object boundary; the writing surface stays unboxed.
export const book = style({
  position: "relative",
  minHeight: "100dvh",
  width: "100%",
  maxWidth: 760,
  marginInline: "auto",
  display: "flex",
  flexDirection: "column",
  containerType: "inline-size",
  background: t.paper,
  boxShadow: `inset 14px 0 0 ${t.morningAccent}, inset 17px 0 7px -5px rgba(78, 53, 25, 0.24)`,
  "::before": {
    content: '""',
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 7,
    width: 1,
    background: "rgba(255,255,255,0.3)",
    pointerEvents: "none",
  },
});
export const exportBook = style([
  book,
  { minHeight: 0, maxWidth: "none", paddingBottom: 20 },
]);
export const masthead = style({ ...padding, paddingTop: 20, paddingBottom: 0 });
export const title = style({
  margin: 0,
  fontFamily: t.headingFont,
  fontWeight: 500,
  fontSize: 26,
  lineHeight: 1.35,
  letterSpacing: "-0.035em",
  "@container": { "(max-width: 420px)": { fontSize: 23 } },
});
export const journal = style({
  flex: 1,
  display: "flex",
  flexDirection: "column",
});
export const tabs = style({
  ...padding,
  display: "flex",
  alignItems: "stretch",
  gap: 9,
  borderBottom: `1px solid ${t.rule}`,
});
export const tab = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  flex: 1,
  minWidth: 0,
  minHeight: 46,
  padding: "8px 12px",
  border: 0,
  borderRadius: "7px 7px 0 0",
  color: t.muted,
  background: t.surface,
  fontSize: 14,
  fontWeight: 500,
  position: "relative",
  transition: "background-color 160ms ease, box-shadow 160ms ease",
  ":focus-visible": focus,
  selectors: {
    '&[data-period="am"][data-state="active"]': {
      background: t.morningDeep,
      color: t.morningInk,
      boxShadow: `inset 0 3px 0 ${t.morningAccent}`,
    },
    '&[data-period="pm"][data-state="active"]': {
      background: t.eveningDeep,
      color: t.eveningInk,
      boxShadow: `inset 0 3px 0 ${t.eveningAccent}`,
    },
    '&:hover:not([data-state="active"])': { background: t.morning },
  },
  "@container": { "(max-width: 420px)": { paddingInline: 8, gap: 5 } },
});
export const dayTab = style([
  tab,
  {
    flex: "0 0 auto",
    background: "transparent",
    paddingInline: 16,
    selectors: {
      '&[data-state="active"]': {
        color: t.ink,
        boxShadow: `inset 0 -2px 0 ${t.ink}`,
      },
    },
  },
]);
export const panel = style({
  flex: 1,
  ":focus-visible": { ...focus, outlineOffset: -4 },
});

// Ritual pages and shared editor/export writing lines.
export const page = style({
  ...padding,
  paddingTop: 20,
  paddingBottom: 0,
  color: t.morningInk,
  selectors: {
    '&[data-period="pm"]': { color: t.eveningInk },
    "& + &": { borderTop: `1px solid ${t.rule}`, marginTop: 12 },
  },
});
export const pageHeading = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 16,
});
export const heading = style({
  margin: 0,
  fontFamily: t.headingFont,
  fontSize: 36,
  fontWeight: 500,
  lineHeight: 1.15,
  letterSpacing: "-0.03em",
});
export const intro = style({
  margin: "6px 0 0",
  fontSize: 14,
  lineHeight: 1.5,
  color: t.muted,
});
export const periodMark = style({
  color: t.morningInk,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: t.morning,
  selectors: {
    [`${page}[data-period="pm"] &`]: {
      color: t.eveningInk,
      background: t.evening,
    },
  },
  "@container": { "(max-width: 420px)": { width: 52, height: 52 } },
});
export const prompt = style({ marginBottom: 14 });
export const promptLabel = style({
  margin: "0 0 2px",
  fontFamily: t.headingFont,
  fontSize: 17,
  fontWeight: 500,
  lineHeight: "23px",
  color: t.ink,
});
export const line = style({
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  minWidth: 0,
  borderBottom: `1px solid ${t.rule}`,
});
export const linePrefix = style({
  flexShrink: 0,
  minWidth: 14,
  fontFamily: t.headingFont,
  color: t.muted,
  fontSize: 14,
  lineHeight: "44px",
});
export const writingField = style({
  display: "block",
  width: "100%",
  minWidth: 0,
  minHeight: 44,
  flex: 1,
  margin: 0,
  border: 0,
  borderRadius: 0,
  padding: "11px 0 10px",
  resize: "none",
  overflow: "hidden",
  background: "transparent",
  fontFamily: t.font,
  color: t.ink,
  caretColor: t.morningInk,
  fontSize: 16,
  lineHeight: "23px",
  overflowWrap: "anywhere",
  "::placeholder": { color: t.dim, opacity: 1, fontSize: 14 },
  ":focus-visible": { outline: "none", boxShadow: `0 2px 0 ${t.morningInk}` },
  selectors: {
    [`${page}[data-period="pm"] &`]: { caretColor: t.eveningInk },
    [`${page}[data-period="pm"] &:focus-visible`]: {
      boxShadow: `0 2px 0 ${t.eveningInk}`,
    },
  },
});
export const lineText = style({
  flex: 1,
  minWidth: 0,
  minHeight: 44,
  paddingBlock: "11px 10px",
  margin: 0,
  color: t.ink,
  fontSize: 16,
  lineHeight: "23px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});
export const pageFooter = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "4px 12px",
  marginTop: 0,
  paddingBottom: 0,
});
export const completion = style({
  display: "inline-flex",
  gap: 9,
  alignItems: "center",
  minHeight: 44,
  border: 0,
  padding: "6px 0",
  background: "transparent",
  color: "inherit",
  fontSize: 14,
  ":focus-visible": focus,
  ":hover": { color: t.ink },
});
export const checkBox = style({
  display: "grid",
  placeItems: "center",
  width: 21,
  height: 21,
  border: "1px solid currentColor",
  borderRadius: 3,
  transition: "background-color 180ms ease, box-shadow 180ms ease",
  selectors: {
    [`${completion}[data-state="checked"] &`]: {
      background: t.morningDeep,
      boxShadow: "inset 0 1px 3px rgba(78,53,25,0.15)",
    },
    [`${page}[data-period="pm"] ${completion}[data-state="checked"] &`]: {
      background: t.eveningDeep,
    },
  },
});
export const closing = style({ fontSize: 12, color: t.muted, lineHeight: 1.5 });
export const writtenNote = style({
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 13,
});

// Optional thought and recovery controls stay out of the main writing rhythm.
export const thought = style({ ...padding, paddingBottom: 12 });
export const thoughtTrigger = style({
  display: "flex",
  alignItems: "center",
  gap: 7,
  border: 0,
  padding: 0,
  minHeight: 44,
  background: "transparent",
  color: t.muted,
  fontSize: 13,
  ":hover": { color: t.ink },
  ":focus-visible": focus,
});
export const hideLabel = style({
  fontSize: 12,
  marginLeft: 12,
  textDecoration: "underline",
  textUnderlineOffset: 3,
});
export const authorField = style({
  width: "100%",
  minHeight: 44,
  border: 0,
  borderRadius: 0,
  padding: "10px 0",
  background: "transparent",
  color: t.muted,
  fontSize: 14,
  "::placeholder": { color: t.dim, opacity: 1 },
  ":focus-visible": focus,
});
export const error = style({
  ...padding,
  margin: "12px 0",
  color: t.ink,
  fontSize: 14,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
});
export const retry = style({
  display: "block",
  minHeight: 44,
  padding: "6px 12px",
  background: t.morning,
  color: t.morningInk,
  border: `1px solid ${t.morningInk}`,
  borderRadius: 4,
  marginTop: 8,
  ":focus-visible": focus,
});
export const exportDate = style({
  color: t.muted,
  fontSize: 14,
  margin: "12px 0 8px",
});
export const exportThought = style({ ...padding, margin: "12px 0 0" });
export const quoteText = style({
  fontFamily: t.headingFont,
  fontSize: 17,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  margin: "0 0 8px",
});
export const authorText = style({
  color: t.muted,
  fontSize: 13,
  overflowWrap: "anywhere",
});

// A bound-paper silhouette with two bookmarks, legible at Finder sizes.
export const iconSurface = style({
  display: "grid",
  width: "100%",
  height: "100%",
  placeItems: "center",
});
export const iconPlate = style({
  position: "relative",
  width: 350,
  height: 418,
  padding: "75px 32px 32px 53px",
  borderRadius: "6px 20px 20px 6px",
  background: t.paper,
  color: t.morningInk,
  boxShadow: `inset 21px 0 0 ${t.morningAccent}, inset 25px 0 8px -4px rgba(78,53,25,0.25), 0 16px 28px rgba(51,38,22,0.2)`,
});
export const iconBookmarks = style({
  position: "absolute",
  display: "flex",
  gap: 10,
  top: 0,
  right: 34,
});
const iconBookmark = style({
  display: "grid",
  placeItems: "center",
  width: 49,
  height: 62,
  borderRadius: "0 0 6px 6px",
});
export const iconMorning = style([
  iconBookmark,
  { background: t.morningDeep, color: t.morningInk },
]);
export const iconEvening = style([
  iconBookmark,
  { background: t.eveningDeep, color: t.eveningInk },
]);
export const iconTitle = style({
  display: "block",
  color: t.ink,
  fontFamily: t.headingFont,
  fontSize: 43,
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: "-0.035em",
  marginBottom: 31,
});
export const iconEntry = style({
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginTop: 17,
});
export const iconRule = style({ flex: 1, height: 1, background: t.rule });
