import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html,body,#app", {
  margin: 0,
  minHeight: "100%",
  background: t.surface,
  color: t.ink,
  fontFamily: t.font,
});
globalStyle("button,input,textarea", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle(":focus-visible", {
  outline: `2px solid ${t.plum}`,
  outlineOffset: 3,
});
export const pad = style({
  height: "100dvh",
  minHeight: 400,
  containerType: "inline-size",
});
export const app = style({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
});
export const header = style({
  background: t.plum,
  color: t.onAccent,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  padding: "24px 26px 22px",
  boxShadow: `inset 0 -4px 0 ${t.plumDeep}`,
  flexShrink: 0,
  "@container": {
    "(max-width:440px)": { padding: "20px 18px", gap: 10, flexWrap: "wrap" },
  },
});
export const identity = style({ flex: 1, minWidth: 0 });
export const eyebrow = style({
  fontSize: 9,
  letterSpacing: ".15em",
  fontFamily: t.mono,
  color: t.lilac,
});
export const student = style({
  display: "block",
  width: "100%",
  minWidth: 0,
  fontSize: 30,
  fontWeight: 650,
  letterSpacing: "-.04em",
  background: "transparent",
  border: 0,
  padding: "7px 0 2px",
  color: t.onAccent,
  ":focus-visible": { outlineColor: t.lilac },
  "@container": { "(max-width:440px)": { fontSize: 26 } },
});
export const term = style({
  display: "block",
  width: "100%",
  border: 0,
  padding: 0,
  fontSize: 12,
  color: t.lilac,
  background: "transparent",
  ":focus-visible": { outlineColor: t.lilac },
});
export const summary = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 5,
  "@container": {
    "(max-width:440px)": {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      justifyContent: "space-between",
    },
  },
});
export const readout = style({
  display: "inline-block",
  fontSize: 12,
  fontWeight: 650,
  padding: "8px 11px",
  borderRadius: 9,
  background: t.lilac,
  color: t.plum,
  selectors: {
    '&[data-urgent="true"]': { background: t.coral, color: t.plumDeep },
  },
});
export const summaryDetail = style({ fontSize: 10, color: t.lilac });
export const toolbar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "17px 26px",
  borderBottom: `1px solid ${t.rule}`,
  flexShrink: 0,
  "@container": { "(max-width:440px)": { padding: "14px 18px" } },
});
export const tabs = style({
  display: "flex",
  gap: 4,
  background: t.panel,
  padding: 3,
  borderRadius: 9,
});
export const tab = style({
  display: "flex",
  gap: 6,
  alignItems: "center",
  border: 0,
  borderRadius: 6,
  padding: "7px 9px",
  background: "transparent",
  fontSize: 11,
  fontWeight: 600,
  color: t.muted,
  selectors: {
    '&[data-state="active"]': {
      color: t.plum,
      background: t.paper,
      boxShadow: "0 1px 3px #32223f15",
    },
  },
});
globalStyle(`${tab} span`, { fontSize: 9, opacity: 0.7 });
export const add = style({
  display: "flex",
  alignItems: "center",
  gap: 5,
  border: 0,
  borderRadius: 8,
  padding: "9px 11px",
  background: t.plum,
  color: t.onAccent,
  fontSize: 11,
  fontWeight: 600,
  boxShadow: "0 2px 0 #32223f25",
});
export const stacks = style({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "5px 26px 20px",
  scrollbarWidth: "thin",
  scrollbarColor: `${t.rule} transparent`,
  "@container": { "(max-width:440px)": { padding: "4px 18px 16px" } },
});
export const stack = style({ marginTop: 19 });
export const stackHead = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 4,
});
export const stackLabel = style({
  fontSize: 10,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 700,
  margin: 0,
  color: t.muted,
  selectors: {
    '&[data-urgency="today"], &[data-urgency="overdue"]': { color: t.accent },
    '&[data-urgency="done"]': { color: t.done },
  },
});
export const stackCount = style({
  fontSize: 9,
  color: t.muted,
  background: t.panel,
  borderRadius: 12,
  padding: "2px 6px",
});
export const list = style({ listStyle: "none", margin: 0, padding: 0 });
export const row = style({
  display: "grid",
  gridTemplateColumns: "22px minmax(0,1fr) auto",
  alignItems: "start",
  gap: 12,
  padding: "14px 0",
  borderBottom: `1px solid ${t.rule}`,
  "@container": {
    "(max-width:440px)": {
      gap: "8px 10px",
      gridTemplateColumns: "22px minmax(0,1fr)",
    },
  },
});
export const checkbox = style({
  width: 21,
  height: 21,
  marginTop: 2,
  border: `1.5px solid ${t.rule}`,
  borderRadius: 6,
  background: t.paper,
  display: "grid",
  placeItems: "center",
  padding: 0,
  selectors: {
    '&[data-state="checked"]': {
      background: t.mint,
      borderColor: t.mint,
      color: t.done,
    },
  },
});
export const itemBody = style({
  border: 0,
  padding: 0,
  textAlign: "left",
  background: "transparent",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
});
export const itemTitle = style({
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.35,
  letterSpacing: "-.015em",
  overflowWrap: "anywhere",
  selectors: {
    [`${row}[data-done="true"] &`]: {
      textDecoration: "line-through",
      color: t.muted,
    },
  },
});
export const itemMeta = style({
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
  fontSize: 10,
  color: t.muted,
});
export const courseChip = style({
  display: "inline-block",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: ".03em",
  background: t.lilac,
  color: t.plum,
  padding: "3px 5px",
  borderRadius: 4,
  maxWidth: "100%",
  overflowWrap: "anywhere",
});
export const category = style({
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const notePreview = style({
  fontSize: 11,
  color: t.muted,
  display: "block",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
});
export const rowEnd = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  paddingTop: 2,
  "@container": {
    "(max-width:440px)": {
      gridColumn: 2,
      paddingTop: 0,
      justifyContent: "space-between",
    },
  },
});
export const editArrow = style({
  border: 0,
  background: "transparent",
  color: t.muted,
  padding: 3,
  display: "grid",
  placeItems: "center",
});
export const due = style({
  border: 0,
  background: t.panel,
  color: t.muted,
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: "nowrap",
  selectors: {
    '&[data-urgency="today"], &[data-urgency="overdue"]': {
      color: t.accent,
      background: "#fff0eb",
    },
    '&[data-urgency="done"]': { color: t.done, background: t.mint },
  },
});
export const footer = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "14px 26px",
  borderTop: `1px solid ${t.rule}`,
  color: t.muted,
  fontSize: 10,
  flexShrink: 0,
});
export const empty = style({ padding: "45px 12px", textAlign: "center" });
globalStyle(`${empty} h2`, {
  fontSize: 23,
  fontWeight: 600,
  letterSpacing: "-.04em",
  margin: "18px 0 8px",
});
globalStyle(`${empty} p`, { fontSize: 12, color: t.muted });
export const emptyCheck = style({
  display: "inline-grid",
  placeItems: "center",
  width: 58,
  height: 58,
  borderRadius: 18,
  background: t.mint,
  color: t.done,
  transform: "rotate(-7deg)",
});
// Shared editing surfaces and calendar.
export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 20,
  background: "#32223f70",
  backdropFilter: "blur(3px)",
});
export const dialog = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%,-50%)",
  width: "calc(100% - 32px)",
  maxWidth: 430,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  background: t.paper,
  padding: 24,
  borderRadius: 14,
  borderTop: `5px solid ${t.plum}`,
  zIndex: 21,
  boxShadow: "0 20px 60px #32223f40",
});
export const dialogTitle = style({
  fontSize: 25,
  fontWeight: 650,
  letterSpacing: "-.035em",
  margin: 0,
});
export const description = style({
  fontSize: 12,
  color: t.muted,
  margin: "7px 0 20px",
});
export const form = style({ display: "grid", gap: 12 });
export const formLabel = style({
  display: "grid",
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  minWidth: 0,
});
export const input = style({
  width: "100%",
  minWidth: 0,
  border: `1px solid ${t.rule}`,
  borderRadius: 7,
  padding: "9px 10px",
  fontSize: 13,
  background: t.paper,
  textAlign: "left",
});
export const titleField = style([
  input,
  { resize: "vertical", minHeight: 58, lineHeight: 1.4 },
]);
export const notesField = style([
  input,
  { resize: "vertical", minHeight: 96, lineHeight: 1.5 },
]);
export const formRow = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
});
export const clearDate = style({
  border: 0,
  padding: 0,
  background: "transparent",
  color: t.muted,
  textAlign: "left",
  fontSize: 10,
});
export const actions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  alignItems: "center",
  marginTop: 8,
});
export const primary = style({
  border: 0,
  borderRadius: 7,
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  background: t.plum,
  color: t.onAccent,
});
export const secondary = style([
  primary,
  { background: t.panel, color: t.plum },
]);
export const deleteButton = style([
  secondary,
  {
    marginRight: "auto",
    color: t.danger,
    background: "transparent",
    paddingInline: 0,
  },
]);
export const error = style({
  fontSize: 12,
  color: t.danger,
  padding: 8,
  margin: 0,
});
export const selectContent = style({
  zIndex: 40,
  background: t.paper,
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
  padding: 5,
  maxHeight: 250,
  overflowY: "auto",
  boxShadow: "0 8px 28px #32223f20",
});
export const selectItem = style({
  padding: "8px 10px",
  fontSize: 12,
  borderRadius: 4,
  selectors: {
    "&[data-highlighted]": { background: t.panel },
    "&[data-selected]": { fontWeight: 700, color: t.plum },
  },
});
export const calendarPopover = style([
  selectContent,
  { width: 268, padding: 12 },
]);
export const calHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
});
export const calNav = style([secondary, { padding: 7 }]);
export const calTitle = style({ fontSize: 13, fontWeight: 600 });
export const calGrid = style({ width: "100%", borderCollapse: "collapse" });
export const calRow = style({});
export const calCell = style({ padding: 1, textAlign: "center" });
export const calHeadCell = style({
  fontSize: 10,
  color: t.muted,
  padding: "5px 0",
});
export const calDay = style({
  border: 0,
  borderRadius: 6,
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  background: "transparent",
  selectors: {
    "&[data-selected]": { background: t.plum, color: t.onAccent },
    "&[data-today]": { boxShadow: `inset 0 0 0 1px ${t.plum}` },
    "&[data-outside-month]": { opacity: 0.35 },
  },
  ":hover": { background: t.lilac, color: t.ink },
});
// Full-content export and a silhouette that reads at 32px.
export const exportPad = style({ background: t.paper });
export const exportStacks = style({ padding: "5px 26px 24px" });
export const exportRow = style({
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "14px 0",
  borderBottom: `1px solid ${t.rule}`,
  overflowWrap: "anywhere",
});
export const exportBody = style({ flex: 1, minWidth: 0 });
export const exportNotes = style({
  whiteSpace: "pre-wrap",
  fontSize: 12,
  color: t.muted,
  lineHeight: 1.5,
  margin: "8px 0 0",
  overflowWrap: "anywhere",
});
export const iconSurface = style({
  width: "100%",
  height: "100%",
  background: t.plum,
  display: "grid",
  placeItems: "center",
});
export const iconSheet = style({
  width: "60%",
  height: "74%",
  position: "relative",
  background: t.paper,
  borderRadius: "8%",
  boxShadow: "14px 14px 0 #32223f40",
  transform: "rotate(-6deg)",
});
export const iconTab = style({
  position: "absolute",
  left: "12%",
  top: "-5%",
  width: "50%",
  height: "12%",
  borderRadius: 10,
  background: t.lilac,
});
export const iconRule = style({
  position: "absolute",
  left: "14%",
  right: "14%",
  top: "20%",
  height: "7%",
  borderRadius: 8,
  background: t.lilac,
});
export const iconCheck = style({
  position: "absolute",
  right: "-18%",
  bottom: "6%",
  width: "87%",
  aspectRatio: "1",
  borderRadius: "26%",
  background: t.mint,
  color: t.done,
  display: "grid",
  placeItems: "center",
  boxShadow: "0 8px 0 #32223f20",
  transform: "rotate(6deg)",
});
