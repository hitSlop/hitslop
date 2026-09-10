import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
const grain = (hi: string, lo: string) =>
  `repeating-linear-gradient(90deg, rgb(255 255 255 / 3%) 0 1px, transparent 1px 4px), linear-gradient(180deg, ${hi}, ${lo})`;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", {
  fontFamily: t.font,
  colorScheme: "dark",
  fontSynthesis: "none",
});
globalStyle("html, body, #app", { width: "100%", height: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.steel, background: t.graphiteDeep, overflow: "hidden" });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", {
  cursor: "pointer",
  border: 0,
  padding: 0,
  background: "transparent",
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled", { cursor: "default" });
globalStyle("input, textarea", { outline: 0 });
globalStyle("textarea", { resize: "none" });
globalStyle("input[type='number']", { appearance: "textfield" });
globalStyle("input::-webkit-inner-spin-button, input::-webkit-outer-spin-button", { display: "none" });
globalStyle("::placeholder", { color: "#a09781" });
globalStyle("button:focus-visible, [data-dialog-close]:focus-visible, [data-button-root]:focus-visible", {
  outline: `3px solid color-mix(in srgb, ${t.amber} 45%, transparent)`,
  outlineOffset: 1,
});
globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transitionDuration: "0s !important",
      animationDuration: "0s !important",
      scrollBehavior: "auto",
    },
  },
});

export const canvas = style({
  height: "100%",
  containerType: "inline-size",
  background: t.graphiteDeep,
});
export const exportCanvas = style({
  display: "grid",
  background: t.graphiteDeep,
  color: t.steel,
});
export const chassis = style({
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  height: "100%",
  background: `repeating-linear-gradient(90deg, rgb(255 255 255 / 2%) 0 1px, transparent 1px 3px), linear-gradient(180deg, ${t.chassisHi}, ${t.graphite} 120px)`,
  selectors: {
    [`${exportCanvas} &`]: { height: "auto" },
  },
});

export const rail = style({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 14,
  borderBottom: `1px solid ${t.edge}`,
  padding: "0 18px",
  height: 56,
  background: grain(t.brushedHigh, t.brushed),
  boxShadow: "inset 0 -1px 0 rgb(0 0 0 / 45%), inset 0 1px 0 rgb(255 255 255 / 10%)",
  "@container": {
    "(max-width: 720px)": {
      gridTemplateColumns: "auto minmax(0, 1fr)",
      paddingInline: 14,
    },
    "(max-width: 560px)": {
      height: "auto",
      paddingBlock: 9,
    },
  },
});
export const railMark = style({ display: "flex", gap: 5 });
globalStyle(`${railMark} span`, {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "radial-gradient(circle at 35% 30%, #6c727a, #24262a)",
  boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 55%)",
});
export const railName = style({
  minWidth: 0,
  display: "grid",
  gap: 2,
});
export const railTitle = style({
  width: "100%",
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "3px 0",
  color: t.railInk,
  background: "transparent",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: ".22em",
  textTransform: "uppercase",
});
export const railHint = style({
  margin: 0,
  color: t.steelDim,
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
});
export const railMeters = style({
  display: "flex",
  gap: 8,
  margin: 0,
  "@container": {
    "(max-width: 720px)": {
      gridColumn: "1 / -1",
      gridRow: 2,
    },
  },
});
globalStyle(`${railMeters} > div`, {
  display: "grid",
  justifyItems: "center",
  gap: 1,
  minWidth: 58,
  border: `1px solid ${t.edge}`,
  borderRadius: 5,
  padding: "4px 8px 5px",
  background: t.slot,
  boxShadow: "inset 0 1px 3px rgb(0 0 0 / 60%)",
  "@container": { "(max-width: 560px)": { minWidth: 52 } },
});
globalStyle(`${railMeters} dt`, {
  color: t.steelDim,
  fontFamily: t.mono,
  fontSize: 7,
  fontWeight: 800,
  letterSpacing: ".12em",
  textTransform: "uppercase",
});
globalStyle(`${railMeters} dd`, {
  margin: 0,
  color: t.meterInk,
  fontFamily: t.mono,
  fontSize: 15,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
});
export const meterWip = style({});
globalStyle(`${meterWip}[data-alert="true"] dt`, { color: t.wipAlert });
globalStyle(`${meterWip}[data-alert="true"] dd`, { color: t.amber });

export const deck = style({
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  minHeight: 0,
  padding: "14px 16px 18px",
  overflow: "auto",
  scrollbarColor: "#3d4147 transparent",
  "@container": {
    "(max-width: 720px)": { flexDirection: "column" },
  },
  selectors: {
    [`${exportCanvas} &`]: { overflow: "visible", flexWrap: "wrap" },
  },
});
export const lane = style({
  display: "grid",
  flex: "1 1 206px",
  minWidth: 206,
  border: `1px solid ${t.edge}`,
  borderRadius: 8,
  background: t.slot,
  boxShadow: "inset 0 2px 6px rgb(0 0 0 / 55%), 0 1px 0 rgb(255 255 255 / 5%)",
  selectors: {
    '&[data-drop="true"]': { outline: `2px dashed color-mix(in srgb, ${t.amber} 70%, transparent)`, outlineOffset: -3 },
    '&[data-dragging="true"]': { opacity: 0.35 },
  },
  "@container": {
    "(max-width: 720px)": { alignSelf: "stretch" },
  },
});
export const deckAdd = style({
  display: "grid",
  flex: "0 0 32px",
  alignContent: "center",
  justifyItems: "center",
  gap: 7,
  alignSelf: "stretch",
  minHeight: 96,
  border: "1px dashed #34383f",
  borderRadius: 8,
  padding: "10px 0",
  color: "#767c84",
  background: "rgb(0 0 0 / 18%)",
  selectors: {
    "&:hover": { color: t.amber, borderColor: t.amberDeep, background: "rgb(242 166 59 / 8%)" },
  },
  "@container": {
    "(max-width: 720px)": {
      flex: "0 0 34px",
      alignSelf: "stretch",
      minHeight: 34,
      gridAutoFlow: "column",
    },
  },
});
globalStyle(`${deckAdd} span`, {
  color: "inherit",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  writingMode: "vertical-rl",
  "@container": { "(max-width: 720px)": { writingMode: "horizontal-tb" } },
});
export const laneHead = style({
  display: "flex",
  alignItems: "center",
  gap: 5,
  borderBottom: `1px solid ${t.edge}`,
  borderRadius: "7px 7px 0 0",
  padding: "0 5px",
  height: 34,
  background: grain(t.brushedHigh, "#2d3036"),
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 9%)",
  selectors: {
    [`${lane}[data-over="true"] &`]: { background: grain(t.overWarm, t.overDeep) },
    [`${lane}[data-done="true"] &`]: { background: grain(t.doneHead, t.doneHeadDeep) },
  },
});
export const laneGrip = style({
  display: "grid",
  flex: "0 0 auto",
  placeItems: "center",
  width: 13,
  height: 22,
  color: "#6f757d",
  cursor: "grab",
  selectors: {
    [`${lane}:hover &`]: { color: "#a7aeb6" },
  },
});
export const laneTitle = style({
  flex: "1 1 auto",
  minWidth: 0,
  width: "100%",
  margin: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "3px 0",
  color: t.railInk,
  background: "transparent",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".1em",
  textOverflow: "ellipsis",
  textTransform: "uppercase",
});
export const laneDoneToggle = style({
  display: "grid",
  flex: "0 0 auto",
  placeItems: "center",
  width: 18,
  height: 18,
  border: "1px solid #24272c",
  borderRadius: 4,
  color: "#7e858d",
  background: "rgb(0 0 0 / 28%)",
  opacity: 0,
  selectors: {
    [`${lane}:hover &`]: { opacity: 1 },
    "&:focus-visible": { opacity: 1 },
    '&[aria-pressed="true"]': {
      color: "#10120f",
      borderColor: t.doneFill,
      background: `linear-gradient(180deg, ${t.doneFillHi}, ${t.doneFill})`,
      opacity: 1,
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 35%)",
    },
  },
});
export const laneLimit = style({
  display: "flex",
  flex: "0 0 auto",
  alignItems: "baseline",
  gap: 2,
  borderRadius: 4,
  padding: "2px 4px",
  background: "rgb(0 0 0 / 32%)",
  fontFamily: t.mono,
  fontSize: 10,
  fontVariantNumeric: "tabular-nums",
});
export const wipLabel = style({
  marginRight: 3,
  color: t.steelDim,
  fontSize: 7,
  fontWeight: 800,
  letterSpacing: ".1em",
});
export const wipLamp = style({
  width: 7,
  height: 7,
  marginRight: 2,
  borderRadius: "50%",
  background: "radial-gradient(circle at 35% 30%, #6c727a, #24262a)",
  boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 55%)",
  selectors: {
    '&[data-alert="true"]': {
      background: `radial-gradient(circle at 35% 30%, ${t.iconLive}, ${t.amberDeep})`,
      boxShadow: `0 0 8px color-mix(in srgb, ${t.amber} 55%, transparent)`,
    },
  },
});
export const laneCount = style({
  color: t.meterInk,
  fontWeight: 700,
  selectors: {
    [`${lane}[data-over="true"] &`]: { color: t.amber },
  },
});
export const laneSlash = style({ color: t.steelDim });
export const laneLimitInput = style({
  width: 20,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: 0,
  color: t.amber,
  background: "transparent",
  font: "inherit",
  fontWeight: 700,
  textAlign: "left",
});
globalStyle(`${laneLimitInput}::placeholder`, { color: "#5f656d" });
export const laneRemove = style({
  display: "grid",
  flex: "0 0 auto",
  placeItems: "center",
  width: 18,
  height: 18,
  borderRadius: 4,
  color: "#8e959d",
  opacity: 0,
  selectors: {
    [`${lane}:hover &`]: { opacity: 1 },
    "&:focus-visible": { opacity: 1 },
    "&:hover:not(:disabled)": { color: t.danger, background: "rgb(0 0 0 / 30%)" },
    "&:disabled": { cursor: "default", opacity: 0 },
    [`${lane}:hover &:disabled`]: { opacity: 0.22 },
  },
});
export const laneSlot = style({
  display: "grid",
  alignContent: "start",
  gap: 8,
  padding: "9px 8px 10px",
});
export const laneEmpty = style({
  margin: 0,
  border: "1px dashed #2e3238",
  borderRadius: 6,
  padding: "12px 8px",
  color: "#4f545b",
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: ".14em",
  textAlign: "center",
  textTransform: "uppercase",
  display: "grid",
  gap: 4,
});
globalStyle(`${laneEmpty} span`, {
  color: "#3d4249",
  fontSize: 7,
  fontWeight: 650,
  letterSpacing: ".08em",
  textTransform: "none",
});

export const ticket = style({
  display: "grid",
  gridTemplateColumns: "26px minmax(0, 1fr)",
  borderRadius: "4px 6px 6px 4px",
  background: `linear-gradient(180deg, #f1ebde, ${t.paper})`,
  boxShadow: "0 1px 2px rgb(0 0 0 / 45%), inset 0 -1px 0 rgb(0 0 0 / 8%)",
  cursor: "grab",
  selectors: {
    '&[data-dragging="true"]': { opacity: 0.4 },
    [`${lane}[data-done="true"] &`]: { background: `linear-gradient(180deg, ${t.donePaper}, ${t.donePaperDeep})` },
  },
});
globalStyle(`${exportCanvas} .${ticket}`, { cursor: "default" });
export const ticketStub = style({
  display: "grid",
  justifyItems: "center",
  gap: 5,
  borderRight: "1px dashed #b8ae99",
  padding: "9px 0 8px",
  background: t.paperShade,
  borderRadius: "4px 0 0 4px",
  selectors: {
    [`${lane}[data-done="true"] &`]: { borderRightColor: t.doneRule, background: t.doneStub },
  },
});
export const punch = style({
  width: 9,
  height: 9,
  borderRadius: "50%",
  background: t.slot,
  boxShadow: "inset 0 1px 1px rgb(0 0 0 / 80%), 0 1px 0 rgb(255 255 255 / 55%)",
  selectors: {
    [`${lane}[data-done="true"] &`]: { boxShadow: "inset 0 1px 1px rgb(0 0 0 / 80%), 0 1px 0 rgb(255 255 255 / 40%)" },
  },
});
export const ticketNo = style({
  color: t.ticketNo,
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
});
export const ticketBody = style({
  display: "grid",
  gap: 2,
  minWidth: 0,
  padding: "7px 8px 7px 9px",
});
export const ticketTitle = style({
  width: "100%",
  margin: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "0 0 2px",
  color: t.ink,
  background: "transparent",
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.25,
  fieldSizing: "content",
  selectors: {
    [`${lane}[data-done="true"] &`]: {
      color: t.doneInk,
      textDecoration: "line-through",
      textDecorationColor: "rgb(77 80 73 / 45%)",
    },
  },
});
export const ticketNote = style({
  width: "100%",
  margin: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: 0,
  color: t.inkSoft,
  background: "transparent",
  fontSize: 10,
  lineHeight: 1.35,
  fieldSizing: "content",
  selectors: {
    [`${lane}[data-done="true"] &`]: { color: t.doneMuted },
  },
});
export const ticketFoot = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 6,
  marginTop: 3,
});
export const ticketTag = style({
  width: "100%",
  minWidth: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  borderRadius: 3,
  padding: "2px 5px",
  color: t.tagInk,
  background: "rgb(242 166 59 / 26%)",
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  selectors: {
    "&:placeholder-shown": { background: "rgb(0 0 0 / 6%)" },
    [`${lane}[data-done="true"] &`]: { color: t.doneTag, background: "rgb(127 153 104 / 32%)" },
  },
});
export const ticketActions = style({
  display: "flex",
  gap: 1,
  opacity: 0,
  selectors: {
    [`${ticket}:hover &`]: { opacity: 1 },
    [`${ticket}:focus-within &`]: { opacity: 1 },
  },
  "@media": { "(hover: none)": { opacity: 1 } },
});
globalStyle(`${ticketActions} button`, {
  display: "grid",
  placeItems: "center",
  width: 19,
  height: 19,
  borderRadius: 4,
  color: t.ticketNo,
});
globalStyle(`${ticketActions} button:hover:not(:disabled)`, {
  color: t.ink,
  background: "rgb(0 0 0 / 9%)",
});
globalStyle(`${ticketActions} button:disabled`, { opacity: 0.25 });
export const ticketRemove = style({});
globalStyle(`${ticketActions} .${ticketRemove}:hover`, { color: t.remove });
export const laneAdd = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  height: 27,
  border: "1px solid #2f333a",
  borderRadius: 6,
  padding: "0 9px",
  color: "#8d949c",
  background: "linear-gradient(180deg, #2b2e34, #232629)",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  selectors: {
    "&:hover": { color: t.amber, borderColor: t.amberDeep },
  },
});

export const error = style({
  margin: "0 18px 14px",
  color: t.error,
  fontSize: 11,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.amberDeep}`,
  borderRadius: 4,
  padding: "3px 7px",
  color: t.amber,
  fontSize: 11,
  fontWeight: 700,
});
export const srOnly = style({
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  clipPath: "inset(50%)",
});

globalStyle(`${ticket} input:focus-visible, ${ticket} textarea:focus-visible`, {
  borderBottomColor: t.amberDeep,
  boxShadow: `inset 0 -1px 0 ${t.amberDeep}`,
});
globalStyle(`${laneTitle}:focus-visible, ${laneLimitInput}:focus-visible, ${railTitle}:focus-visible`, {
  borderBottomColor: t.amber,
  boxShadow: `inset 0 -1px 0 ${t.amber}`,
});

export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "rgba(14, 15, 17, 0.72)",
  backdropFilter: "blur(2px)",
});
export const dialog = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 101,
  width: "calc(100% - 40px)",
  maxWidth: 360,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 0,
  border: `1px solid ${t.edge}`,
  borderRadius: 8,
  background: t.slot,
  boxShadow: "0 18px 40px rgb(0 0 0 / 55%), inset 0 1px 0 rgb(255 255 255 / 6%)",
  outline: "none",
  color: t.steel,
  overflow: "hidden",
});
export const dialogHead = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 14px 10px",
  background: grain(t.brushedHigh, t.brushed),
  borderBottom: `1px solid ${t.edge}`,
});
export const dialogEyebrow = style({
  margin: 0,
  color: t.amber,
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: ".16em",
  textTransform: "uppercase",
});
globalStyle(`${dialogHead} [data-dialog-title]`, {
  margin: "3px 0 0",
  color: t.railInk,
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
});
globalStyle(`${dialogHead} [data-dialog-description]`, {
  margin: "4px 0 0",
  color: t.steelDim,
  fontSize: 11,
  lineHeight: 1.35,
});
export const dialogClose = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  borderRadius: 4,
  color: t.steelDim,
  selectors: {
    "&:hover": { color: t.railInk, background: "rgb(0 0 0 / 30%)" },
  },
});
export const dialogForm = style({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 14px 14px",
  background: `linear-gradient(180deg, #f1ebde, ${t.paper})`,
  color: t.ink,
});
export const formField = style({ display: "grid", gap: 4 });
globalStyle(`${formField} span`, {
  color: t.inkSoft,
  fontFamily: t.mono,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: ".12em",
  textTransform: "uppercase",
});
globalStyle(`${formField} input, ${formField} textarea`, {
  width: "100%",
  border: 0,
  borderBottom: `1px solid color-mix(in srgb, ${t.ink} 18%, transparent)`,
  borderRadius: 0,
  padding: "4px 0 6px",
  background: "transparent",
  color: t.ink,
  fontSize: 13,
});
globalStyle(`${formField} textarea`, { minHeight: 56, fontSize: 12, lineHeight: 1.4 });
globalStyle(`${formField} input:focus-visible, ${formField} textarea:focus-visible`, {
  borderBottomColor: t.amberDeep,
  boxShadow: `inset 0 -1px 0 ${t.amberDeep}`,
});
export const dialogActions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 4,
});
export const btnSecondary = style({
  height: 28,
  padding: "0 10px",
  border: "1px solid #b8ae99",
  borderRadius: 5,
  color: t.inkSoft,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
});
export const btnPrimary = style({
  height: 28,
  padding: "0 12px",
  borderRadius: 5,
  background: `linear-gradient(180deg, ${t.iconLive}, ${t.amber})`,
  color: "#1a1208",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 35%)",
  selectors: {
    "&:disabled": { opacity: 0.45 },
  },
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${deck}`, { flexWrap: "wrap", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${lane}`, { flexBasis: 168, minWidth: 168 });
globalStyle(`html[data-slop-capture="static"] .${laneLimit}:has(input:placeholder-shown) .${laneSlash}`, { display: "none" });
globalStyle(`html[data-slop-capture="static"] .${laneLimit} input:placeholder-shown`, { display: "none" });
globalStyle(`html[data-slop-capture="static"] .${chassis}`, { height: "auto" });
globalStyle(`html[data-slop-capture="static"] input, html[data-slop-capture="static"] textarea`, {
  borderBottomColor: "transparent",
  boxShadow: "none",
});
globalStyle('html[data-slop-capture="static"] ::placeholder', { color: "transparent" });
globalStyle(`html[data-slop-capture="static"] .${ticketNote}:placeholder-shown, html[data-slop-capture="static"] .${ticketTag}:placeholder-shown`, {
  display: "none",
});

export const iconSurface = style({
  display: "grid",
  width: "100%",
  height: "100%",
  placeItems: "center",
  overflow: "hidden",
  background: "transparent",
});
export const iconTile = style({
  display: "grid",
  placeItems: "center",
  width: 464,
  height: 464,
  borderRadius: 96,
  background: grain("#3a3e45", "#1c1e22"),
  boxShadow: "inset 0 3px 0 rgb(255 255 255 / 10%), inset 0 -4px 0 rgb(0 0 0 / 55%)",
});
export const iconDeck = style({
  display: "grid",
  gridAutoFlow: "column",
  gap: 20,
});
export const iconSlot = style({
  width: 96,
  height: 292,
  borderRadius: 18,
  background: `linear-gradient(180deg, ${t.iconSlot}, ${t.iconSlotDeep})`,
  boxShadow: "inset 0 3px 0 rgb(255 255 255 / 22%), inset 0 -5px 0 rgb(0 0 0 / 28%)",
});
export const iconSlotLive = style({
  background: `linear-gradient(180deg, ${t.iconLive}, ${t.amber})`,
  boxShadow: "inset 0 3px 0 rgb(255 255 255 / 35%), inset 0 -6px 0 rgb(0 0 0 / 22%), 0 0 26px rgb(242 166 59 / 40%)",
});
