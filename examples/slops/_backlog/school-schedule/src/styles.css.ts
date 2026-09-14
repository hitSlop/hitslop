import { globalFontFace, globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalFontFace("Outfit", {
  src: 'url("../assets/fonts/Outfit.ttf") format("truetype")',
  fontStyle: "normal",
  fontWeight: "100 900",
  fontDisplay: "swap",
});
const colors = {
  sage: t.sage,
  slate: t.slate,
  amber: t.amber,
  terracotta: t.terracotta,
  indigo: t.indigo,
  rose: t.rose,
  teal: t.teal,
};
const colorSelectors = Object.fromEntries(
  Object.entries(colors).map(([key, color]) => [
    `&[data-color="${key}"]`,
    { background: color },
  ]),
);
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html,body,#app", {
  margin: 0,
  minHeight: "100%",
  fontFamily: t.font,
  color: t.ink,
  background: t.surface,
});
globalStyle("button,input", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle(":focus-visible", {
  outline: `3px solid ${t.cobalt}`,
  outlineOffset: 2,
});
export const canvas = style({
  height: "100dvh",
  minHeight: 420,
  containerType: "inline-size",
});
export const app = style({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
});
export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
  padding: "17px 24px",
  background: t.cobalt,
  color: t.onAccent,
  boxShadow: `inset 0 -4px 0 ${t.cobaltDeep}`,
  flexShrink: 0,
  "@container": {
    "(max-width:600px)": {
      gap: 12,
      padding: "14px 16px",
      alignItems: "stretch",
      flexDirection: "column",
    },
  },
});
export const identity = style({ minWidth: 0, flex: 1 });
export const eyebrow = style({
  fontFamily: t.mono,
  fontSize: 9,
  letterSpacing: ".17em",
  fontWeight: 600,
});
export const nameButton = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: 0,
  background: "transparent",
  color: "inherit",
  padding: 0,
  textAlign: "left",
  maxWidth: "100%",
  ":focus-visible": { outlineColor: t.onAccent },
});
export const name = style({
  fontSize: 34,
  fontWeight: 650,
  lineHeight: 1.1,
  letterSpacing: "-.04em",
  margin: "5px 0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  "@container": { "(max-width:600px)": { fontSize: 28 } },
});
export const term = style({
  margin: 0,
  fontSize: 12,
  color: "#e1e9ff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const live = style({
  width: 290,
  maxWidth: "48%",
  borderLeft: "1px solid #ffffff55",
  paddingLeft: 20,
  display: "grid",
  gap: 3,
  "@container": {
    "(max-width:600px)": {
      width: "100%",
      maxWidth: "100%",
      borderLeft: 0,
      borderTop: "1px solid #ffffff40",
      paddingLeft: 0,
      paddingTop: 10,
      gridTemplateColumns: "1fr auto",
    },
  },
});
export const statusLabel = style({
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  color: "#ffdfc9",
  fontWeight: 600,
});
export const liveTitle = style({
  fontSize: 18,
  fontWeight: 600,
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  "@container": { "(max-width:600px)": { gridColumn: "1 / -1", gridRow: 2 } },
});
export const liveDetail = style({
  fontSize: 11,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const upNext = style({
  fontSize: 10,
  color: "#e1e9ff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  "@container": { "(max-width:600px)": { gridColumn: "1 / -1" } },
});
export const toolbar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 24px",
  flexShrink: 0,
  "@container": {
    "(max-width:600px)": { padding: "10px 16px", flexWrap: "wrap", gap: 8 },
  },
});
export const boardHeading = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
});
export const starMark = style({
  display: "grid",
  placeItems: "center",
  width: 28,
  height: 28,
  background: t.accent,
  borderRadius: 8,
  transform: "rotate(-9deg)",
  boxShadow: "0 2px 0 #172e6220",
});
export const heading = style({ fontSize: 13, fontWeight: 600, margin: 0 });
export const tools = style({ display: "flex", alignItems: "center", gap: 6 });
export const tool = style({
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 550,
  padding: "7px 9px",
  border: `1px solid ${t.rule}`,
  borderRadius: 7,
  background: t.paper,
  boxShadow: "0 2px 0 #172e620c",
  ":hover": { background: t.panel },
  ":active": { transform: "translateY(1px)" },
});
export const scroller = style({
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  scrollbarColor: `${t.rule} transparent`,
  padding: "0 16px 10px",
  "@container": { "(max-width:600px)": { padding: "0 8px 8px" } },
});
export const board = style({ minWidth: 730 });
const grid = {
  display: "grid",
  gridTemplateColumns: "94px repeat(5,minmax(124px,1fr))",
};
export const dayRow = style({
  ...grid,
  position: "sticky",
  top: 0,
  zIndex: 5,
  background: t.surface,
  borderBottom: `1px solid ${t.rule}`,
});
export const corner = style({
  position: "sticky",
  left: 0,
  zIndex: 6,
  background: t.surface,
  padding: "13px 8px",
  fontFamily: t.mono,
  fontSize: 8,
  color: t.muted,
});
export const dayHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "10px 3px",
  fontSize: 12,
  fontWeight: 600,
  selectors: {
    '&[data-today="true"]': {
      background: t.cobalt,
      color: t.onAccent,
      borderRadius: "9px 9px 0 0",
    },
  },
});
export const todayBadge = style({
  fontFamily: t.mono,
  fontSize: 7,
  padding: "3px 4px",
  borderRadius: 3,
  background: "#ffffff26",
});
export const periodRow = style({ ...grid, minHeight: 48 });
export const periodCell = style({
  position: "sticky",
  left: 0,
  zIndex: 3,
  border: 0,
  borderBottom: `1px solid ${t.rule}`,
  background: t.surface,
  textAlign: "left",
  padding: "6px 8px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 3,
  ":hover": { background: t.panel },
});
globalStyle(`${periodCell} strong`, {
  fontSize: 10,
  fontWeight: 600,
  overflowWrap: "anywhere",
});
globalStyle(`${periodCell} span`, {
  fontSize: 8,
  lineHeight: 1.25,
  color: t.muted,
  fontFamily: t.mono,
});
export const slot = style({
  position: "relative",
  padding: 4,
  borderBottom: `1px solid ${t.rule}`,
  minWidth: 0,
  selectors: {
    '&[data-today="true"]': { background: t.panel },
    '&[data-target="true"]': {
      background: t.cobalt,
      boxShadow: `inset 0 0 0 2px ${t.cobalt}`,
    },
  },
});
export const classTile = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "stretch",
  textAlign: "left",
  gap: 3,
  width: "100%",
  height: "100%",
  minHeight: 40,
  padding: "7px 9px",
  border: "1px solid #172e6215",
  borderRadius: 7,
  background: t.slate,
  boxShadow: "inset 0 1px 0 #ffffffaa, 0 2px 0 #172e6218",
  cursor: "grab",
  touchAction: "none",
  transition: "box-shadow 120ms, transform 120ms",
  selectors: {
    ...colorSelectors,
    '&[data-now="true"]': {
      outline: `2px solid ${t.cobalt}`,
      outlineOffset: 0,
      paddingRight: 31,
    },
    '&[data-dragging="true"]': { opacity: 0.45 },
    "&:hover": {
      boxShadow: "inset 0 1px 0 #ffffffaa, 0 3px 7px #172e6222",
      transform: "translateY(-1px)",
    },
  },
  ":active": { cursor: "grabbing" },
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transition: "none",
      transform: "none",
    },
  },
});
export const subject = style({
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.12,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
});
export const room = style({
  fontSize: 9,
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
  opacity: 0.8,
});
export const nowBadge = style({
  position: "absolute",
  right: 4,
  top: 5,
  fontSize: 7,
  fontFamily: t.mono,
  fontWeight: 700,
  background: t.cobalt,
  color: t.onAccent,
  padding: "3px 4px",
  borderRadius: 4,
});
export const emptySlot = style({
  height: "100%",
  width: "100%",
  minHeight: 40,
  display: "flex",
  gap: 5,
  alignItems: "center",
  justifyContent: "center",
  border: `1px dashed ${t.rule}`,
  borderRadius: 7,
  background: "transparent",
  color: t.muted,
  fontSize: 10,
  ":hover": { background: t.panel, color: t.cobalt },
});
export const dropLabel = style({
  position: "absolute",
  zIndex: 7,
  left: 0,
  bottom: -12,
  padding: "4px 7px",
  borderRadius: 4,
  background: t.cobalt,
  color: t.onAccent,
  fontSize: 10,
  whiteSpace: "nowrap",
  pointerEvents: "none",
});
export const emptyBoard = style({
  width: "min(100%, calc(100cqw - 16px))",
  position: "sticky",
  left: 0,
  padding: "40px 24px",
  color: t.muted,
});
globalStyle(`${emptyBoard} h2`, {
  fontSize: 24,
  color: t.ink,
  margin: "12px 0 4px",
});
export const afterHeading = style({
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  padding: "14px 8px 8px",
});
globalStyle(`${afterHeading} > span`, { fontSize: 10, color: t.muted });
export const afterGrid = style({ ...grid });
export const afterCorner = style({
  position: "sticky",
  left: 0,
  background: t.surface,
  color: t.cobalt,
  padding: "12px 8px",
  zIndex: 3,
});
export const activityColumn = style({
  padding: "0 4px",
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 0,
});
export const activityTile = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  width: "100%",
  textAlign: "left",
  padding: "8px 9px",
  border: `1px solid ${t.rule}`,
  borderRadius: 7,
  background: t.paper,
  boxShadow: "0 2px 0 #172e620a",
  ":hover": { background: t.panel },
});
globalStyle(`${activityTile} strong`, {
  fontSize: 11,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
globalStyle(`${activityTile} span`, {
  fontSize: 9,
  color: t.muted,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const addActivity = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  border: 0,
  padding: "5px 8px",
  background: "transparent",
  fontSize: 10,
  color: t.muted,
  ":hover": { color: t.cobalt },
});
export const footer = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "9px 24px",
  borderTop: `1px solid ${t.rule}`,
  fontSize: 10,
  color: t.muted,
  flexShrink: 0,
});
globalStyle(`${footer} > span`, {
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
});
export const footerButton = style({
  border: 0,
  background: "transparent",
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10,
  whiteSpace: "nowrap",
  padding: 0,
});
// Editor dialogs and accessible primitive states.
export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 20,
  background: "#172e6270",
  backdropFilter: "blur(3px)",
});
export const dialog = style({
  position: "fixed",
  left: "50%",
  top: "50%",
  transform: "translate(-50%,-50%)",
  width: "calc(100% - 32px)",
  maxWidth: 420,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  zIndex: 21,
  background: t.surface,
  padding: 24,
  borderRadius: 16,
  borderTop: `5px solid ${t.cobalt}`,
  boxShadow: "0 20px 70px #172e6240",
});
export const dialogTitle = style({
  fontSize: 26,
  fontWeight: 600,
  letterSpacing: "-.04em",
  margin: 0,
});
export const description = style({
  fontSize: 12,
  color: t.muted,
  margin: "7px 0 18px",
});
export const form = style({ display: "grid", gap: 12 });
export const formLabel = style({
  display: "grid",
  gap: 5,
  fontSize: 11,
  fontWeight: 500,
  minWidth: 0,
});
export const input = style({
  width: "100%",
  minWidth: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 5,
  border: `1px solid ${t.rule}`,
  borderRadius: 7,
  padding: "10px 11px",
  background: t.paper,
  fontSize: 13,
  textAlign: "left",
});
export const formRow = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
});
export const selectContent = style({
  zIndex: 30,
  background: t.paper,
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
  padding: 4,
  maxHeight: 240,
  overflowY: "auto",
  maxWidth: "calc(100vw - 32px)",
  boxShadow: "0 8px 26px #172e6220",
});
export const selectItem = style({
  padding: "8px 10px",
  borderRadius: 4,
  fontSize: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  selectors: {
    "&[data-highlighted]": { background: t.panel },
    "&[data-selected]": { color: t.cobalt, fontWeight: 600 },
  },
});
export const palette = style({
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  padding: 3,
});
export const colorOption = style({
  width: 32,
  height: 32,
  border: "1px solid #172e621c",
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  selectors: {
    ...colorSelectors,
    '&[data-state="checked"]': {
      outline: `2px solid ${t.cobalt}`,
      outlineOffset: 2,
    },
  },
});
export const actions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  alignItems: "center",
  marginTop: 10,
});
export const primary = style({
  padding: "10px 13px",
  fontSize: 12,
  fontWeight: 600,
  border: 0,
  borderRadius: 7,
  background: t.cobalt,
  color: t.onAccent,
});
export const secondary = style([
  primary,
  { background: t.panel, color: t.ink },
]);
export const deleteButton = style([
  secondary,
  {
    color: t.danger,
    background: "transparent",
    marginRight: "auto",
    paddingInline: 0,
  },
]);
export const reveal = style({
  display: "flex",
  gap: 5,
  alignItems: "center",
  fontSize: 11,
  background: "transparent",
  border: 0,
  padding: 0,
  color: t.muted,
});
export const notice = style({
  fontSize: 12,
  lineHeight: 1.4,
  padding: 10,
  background: t.panel,
  borderRadius: 7,
  margin: 0,
});
export const error = style({
  fontSize: 12,
  color: t.danger,
  padding: 8,
  margin: 0,
});
export const srOnly = style({
  position: "absolute",
  top: 0,
  left: 0,
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
});
// Static views expand freely and keep the full written content.
export const exportPage = style({ background: t.surface });
export const exportDays = style({
  display: "grid",
  gridTemplateColumns: "repeat(5,minmax(0,1fr))",
  gap: 10,
  padding: 20,
  "@media": { "(max-width:600px)": { gridTemplateColumns: "1fr" } },
});
export const exportDay = style({ minWidth: 0 });
export const exportDayTitle = style({
  margin: "0 0 10px",
  fontSize: 15,
  color: t.cobalt,
});
export const exportClass = style({
  borderRadius: 7,
  padding: 10,
  marginBottom: 8,
  background: t.panel,
  overflowWrap: "anywhere",
  selectors: colorSelectors,
});
export const exportSubject = style({
  fontSize: 13,
  fontWeight: 600,
  margin: "4px 0",
});
export const exportMeta = style({ fontSize: 10, lineHeight: 1.4, margin: 0 });
export const exportDetails = style({
  padding: "12px 24px",
  fontSize: 11,
  overflowWrap: "anywhere",
});
export const iconSurface = style({
  width: "100%",
  height: "100%",
  background: t.cobalt,
  display: "grid",
  placeItems: "center",
});
export const iconBoard = style({
  position: "relative",
  width: "82%",
  height: "72%",
  background: t.paper,
  borderRadius: 24,
  padding: "19% 6% 6%",
  boxShadow: "0 10px 0 #16359a",
  transform: "rotate(-3deg)",
});
export const iconLabel = style({
  position: "absolute",
  top: "6%",
  left: "8%",
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: "-.05em",
  color: t.cobalt,
});
export const iconStar = style({
  position: "absolute",
  right: "-4%",
  top: "-8%",
  width: 86,
  height: 86,
  borderRadius: 20,
  background: t.accent,
  display: "grid",
  placeItems: "center",
  color: t.ink,
  transform: "rotate(13deg)",
  boxShadow: "0 5px 0 #172e6220",
});
export const iconGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(5,1fr)",
  gap: 8,
  height: "100%",
});
export const iconColumn = style({ display: "grid", gap: 9 });
export const iconTile = style({
  borderRadius: 6,
  boxShadow: "0 3px 0 #172e6218",
  selectors: colorSelectors,
});
