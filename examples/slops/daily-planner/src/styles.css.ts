import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";
const t = theme.vars;
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", {
  margin: 0,
  minHeight: "100%",
  background: t.surface,
  color: t.ink,
  fontFamily: t.font,
});
globalStyle("button, input, textarea", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer" });
globalStyle(":focus-visible", {
  outline: `2px solid ${t.now}`,
  outlineOffset: 2,
});
export const canvas = style({
  height: "100dvh",
  minHeight: 420,
  display: "flex",
  flexDirection: "column",
  containerType: "inline-size",
});
export const page = style({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
});
export const header = style({
  padding: "16px 22px 18px",
  background: t.teal,
  color: t.onAccent,
  boxShadow: "inset 0 -3px 0 #0002",
  flexShrink: 0,
});
export const headerTop = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});
export const eyebrow = style({
  fontFamily: t.mono,
  fontSize: 10,
  letterSpacing: ".14em",
  fontWeight: 600,
});
export const nowButton = style({
  display: "flex",
  alignItems: "center",
  gap: 5,
  border: "1px solid #ffffff40",
  borderRadius: 20,
  background: "transparent",
  color: t.onAccent,
  padding: "3px 10px",
  fontSize: 11,
  fontWeight: 600,
  selectors: {
    '&[data-following="true"]': {
      background: t.accent,
      color: t.ink,
      borderColor: t.accent,
    },
  },
  ":hover": { boxShadow: "0 2px 5px #0002" },
});
export const headerMain = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  margin: "8px 0 2px",
});
export const title = style({
  fontSize: "clamp(29px, 9cqw, 40px)",
  lineHeight: 1.1,
  letterSpacing: "-.055em",
  fontWeight: 650,
  margin: 0,
});
export const dateNumber = style({
  fontFamily: t.mono,
  fontSize: 42,
  lineHeight: 1,
  letterSpacing: "-.08em",
  color: t.accent,
});
export const dateTrigger = style({
  border: 0,
  padding: "6px 0 0",
  display: "flex",
  alignItems: "center",
  gap: 7,
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  opacity: 0.85,
});
export const priorities = style({
  padding: "14px 22px 10px",
  background: t.panel,
  borderBottom: `1px solid ${t.rule}`,
  flexShrink: 0,
  maxHeight: "30vh",
  overflowY: "auto",
});
export const sectionHead = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
});
export const heading = style({
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".07em",
  textTransform: "uppercase",
});
export const meta = style({
  fontSize: 10,
  color: t.muted,
  fontVariantNumeric: "tabular-nums",
});
export const priorityList = style({
  listStyle: "none",
  padding: 0,
  margin: "8px 0 0",
});
export const priority = style({
  display: "flex",
  gap: 10,
  alignItems: "center",
  minHeight: 29,
});
export const checkbox = style({
  width: 20,
  height: 20,
  border: `1px solid ${t.rule}`,
  borderRadius: 6,
  background: t.surface,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: t.mono,
  fontSize: 10,
  flexShrink: 0,
  selectors: {
    '&[data-state="checked"]': {
      background: t.teal,
      color: t.onAccent,
      borderColor: t.teal,
    },
  },
});
export const priorityText = style({
  width: "100%",
  minWidth: 0,
  border: 0,
  padding: "4px 0",
  background: "transparent",
  fontSize: 13,
  selectors: {
    [`${priority}[data-done="true"] &`]: {
      textDecoration: "line-through",
      color: t.muted,
    },
  },
  "::placeholder": { color: t.muted },
});
export const scheduleHead = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 22px 10px",
  flexShrink: 0,
});
export const addButton = style({
  border: `1px solid ${t.rule}`,
  borderRadius: 7,
  padding: "7px 9px",
  background: t.surface,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  boxShadow: "0 2px 0 #183d3b0d",
  ":hover": { background: t.panel },
  ":active": { transform: "translateY(1px)" },
});
export const scroll = style({
  flex: "1 1 auto",
  minHeight: 100,
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  scrollbarColor: `${t.rule} transparent`,
  borderTop: `1px solid ${t.rule}`,
});
export const rail = style({
  display: "grid",
  gridTemplateColumns: "54px minmax(0,1fr)",
  padding: "10px 16px 18px 0",
});
export const gutter = style({ display: "flex", flexDirection: "column" });
export const hour = style({
  height: t.hour,
  flexShrink: 0,
  textAlign: "right",
  paddingRight: 10,
  fontFamily: t.mono,
  fontSize: 9,
  color: t.muted,
  transform: "translateY(-5px)",
  fontVariantNumeric: "tabular-nums",
});
export const field = style({
  position: "relative",
  height: `calc(18 * ${t.hour})`,
  borderLeft: `1px solid ${t.rule}`,
  backgroundImage: `repeating-linear-gradient(to bottom, ${t.rule} 0px, ${t.rule} 1px, transparent 1px, transparent ${t.hour})`,
});
export const sheet = style({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  background: "transparent",
  border: 0,
  cursor: "crosshair",
  touchAction: "none",
});
export const empty = style({
  position: "absolute",
  top: 90,
  left: 20,
  right: 15,
  pointerEvents: "none",
  fontSize: 23,
  lineHeight: 1.3,
  letterSpacing: "-.03em",
  color: t.muted,
});
globalStyle(`${empty} small`, {
  display: "block",
  fontSize: 12,
  letterSpacing: 0,
  marginTop: 12,
});
export const block = style({
  position: "absolute",
  top: `calc(var(--top) * ${t.hour})`,
  height: `calc(var(--span) * ${t.hour} - 2px)`,
  minHeight: 16,
  left: "calc(var(--column) / var(--columns) * 100% + 4px)",
  width: "calc(100% / var(--columns) - 7px)",
  borderRadius: 6,
  background: t.tealLight,
  color: t.ink,
  border: "1px solid #164e4a20",
  boxShadow: "inset 0 1px 0 #ffffffa0, 0 2px 0 #164e4a18, 0 3px 5px #164e4a09",
  selectors: {
    '&[data-kind="meeting"]': { background: t.accent },
    '&[data-kind="break"]': { background: t.mint },
    '&[data-kind="personal"]': { background: t.lavender },
    '&[data-active="true"]': {
      zIndex: 5,
      boxShadow: `0 0 0 2px ${t.teal}, 0 5px 12px #164e4a30`,
    },
    "&:focus-within": { zIndex: 6 },
  },
});
export const blockBody = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "stretch",
  textAlign: "left",
  width: "100%",
  height: "100%",
  padding: "3px 10px",
  border: 0,
  borderRadius: "inherit",
  background: "transparent",
  overflow: "hidden",
  cursor: "grab",
  touchAction: "none",
  selectors: {
    [`${block}[data-short="true"] &`]: { padding: "0 8px" },
    [`${block}[data-tiny="true"] &`]: {
      padding: "0 8px",
    },
  },
  ":active": { cursor: "grabbing" },
});
export const blockTitle = style({
  fontSize: 12,
  fontWeight: 650,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  lineHeight: "16px",
});
export const blockDetail = style({
  fontSize: 9,
  marginTop: 2,
  lineHeight: "11px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  selectors: { [`${block}[data-short="true"] &`]: { display: "none" } },
});
export const handle = style({
  position: "absolute",
  left: 8,
  right: 8,
  height: 5,
  border: 0,
  padding: 0,
  background: "transparent",
  cursor: "ns-resize",
  touchAction: "none",
  opacity: 0,
  selectors: {
    [`${block}:hover &`]: { opacity: 1 },
    [`${block}:focus-within &`]: { opacity: 1 },
  },
  "::after": {
    content: '""',
    display: "block",
    width: 18,
    height: 2,
    borderRadius: 2,
    background: "currentColor",
    opacity: 0.35,
    margin: "auto",
  },
  ":focus-visible": { opacity: 1 },
});
export const startHandle = style({ top: -2 });
export const endHandle = style({ bottom: -2 });
export const draft = style({
  position: "absolute",
  left: 4,
  right: 3,
  top: `calc(var(--top) * ${t.hour})`,
  height: `calc(var(--span) * ${t.hour})`,
  minHeight: 10,
  background: "#164e4a15",
  border: `1px dashed ${t.teal}`,
  borderRadius: 5,
  fontSize: 10,
  padding: 3,
  pointerEvents: "none",
  zIndex: 7,
});
export const nowLine = style({
  position: "absolute",
  top: `calc(var(--top) * ${t.hour})`,
  left: 0,
  right: 0,
  height: 2,
  background: t.now,
  pointerEvents: "none",
  zIndex: 8,
  "::after": {
    content: '""',
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: t.now,
    position: "absolute",
    right: 0,
    top: -2,
  },
});
export const nowTag = style({
  position: "absolute",
  right: "100%",
  top: -7,
  background: t.now,
  color: "white",
  borderRadius: 4,
  padding: "3px 4px",
  fontFamily: t.mono,
  fontSize: 8,
  whiteSpace: "nowrap",
});
export const notesButton = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "13px 22px",
  background: t.panel,
  border: 0,
  borderTop: `1px solid ${t.rule}`,
  textAlign: "left",
  flexShrink: 0,
  width: "100%",
});
globalStyle(`${notesButton} > span:first-of-type`, { flex: 1, minWidth: 0 });
globalStyle(`${notesButton} b`, { display: "block", fontSize: 11 });
globalStyle(`${notesButton} small`, {
  display: "block",
  fontSize: 11,
  color: t.muted,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  marginTop: 3,
});
// Editing surfaces and Bits UI states.
export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 20,
  background: "#102e3a70",
  backdropFilter: "blur(3px)",
});
export const dialog = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%,-50%)",
  zIndex: 21,
  width: "calc(100% - 32px)",
  maxWidth: 380,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  background: t.surface,
  borderRadius: 14,
  padding: 22,
  boxShadow: "0 18px 60px #102e3a40",
  borderTop: `5px solid ${t.teal}`,
});
export const dialogTitle = style({
  fontSize: 24,
  fontWeight: 650,
  letterSpacing: "-.04em",
  margin: 0,
});
export const description = style({
  fontSize: 12,
  color: t.muted,
  margin: "7px 0 18px",
});
export const form = style({ display: "grid", gap: 12 });
export const label = style({
  fontSize: 11,
  fontWeight: 600,
  display: "grid",
  gap: 6,
});
export const input = style({
  width: "100%",
  minWidth: 0,
  border: `1px solid ${t.rule}`,
  borderRadius: 7,
  padding: "10px 11px",
  fontSize: 13,
  background: t.surface,
  textAlign: "left",
});
export const textarea = style([
  input,
  { resize: "vertical", minHeight: 180, lineHeight: 1.6 },
]);
export const timeRow = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
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
  background: t.teal,
  color: t.onAccent,
  fontSize: 12,
  fontWeight: 600,
});
export const secondary = style([
  primary,
  { background: t.panel, color: t.ink },
]);
export const deleteButton = style([
  secondary,
  {
    background: "transparent",
    color: t.danger,
    marginRight: "auto",
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
  background: t.surface,
  border: `1px solid ${t.rule}`,
  borderRadius: 8,
  padding: 4,
  zIndex: 30,
  minWidth: 160,
  boxShadow: "0 6px 22px #183d3b20",
});
export const selectItem = style({
  padding: "8px 12px",
  fontSize: 13,
  borderRadius: 4,
  selectors: {
    "&[data-highlighted]": { background: t.panel },
    "&[data-selected]": { fontWeight: 700 },
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
    "&[data-selected]": { background: t.teal, color: t.onAccent },
    "&[data-today]": { boxShadow: `inset 0 0 0 1px ${t.teal}` },
    "&[data-outside-month]": { opacity: 0.35 },
  },
  ":hover": { background: t.tealLight, color: t.ink },
});
// Static output keeps every title and note in flow.
export const exportPage = style({ background: t.surface, minHeight: "100%" });
export const exportList = style({
  padding: "12px 22px",
  display: "grid",
  gap: 8,
});
export const exportBlock = style({
  borderLeft: `4px solid ${t.teal}`,
  background: t.panel,
  padding: "10px 12px",
  borderRadius: 5,
  overflowWrap: "anywhere",
  selectors: {
    '&[data-kind="meeting"]': { borderColor: t.accent },
    '&[data-kind="break"]': { borderColor: "#75a965" },
    '&[data-kind="personal"]': { borderColor: "#9a84b9" },
  },
});
export const exportTitle = style({
  fontSize: 14,
  margin: "4px 0",
  fontWeight: 650,
});
export const exportNotes = style({
  padding: "14px 22px 24px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontSize: 13,
  lineHeight: 1.6,
});
export const iconSurface = style({
  width: "100%",
  height: "100%",
  background: t.teal,
  display: "grid",
  placeItems: "center",
});
export const iconPage = style({
  position: "relative",
  width: "58%",
  height: "80%",
  background: t.surface,
  borderRadius: "7%",
  boxShadow: "9px 12px 0 #0002",
  overflow: "hidden",
  borderTop: `42px solid ${t.accent}`,
});
export const iconPlate = style({
  position: "absolute",
  inset: "12% 10% 8% 23%",
  borderLeft: `2px solid ${t.rule}`,
  background: `repeating-linear-gradient(to bottom, ${t.rule} 0px, ${t.rule} 2px, transparent 2px, transparent 36px)`,
});
export const iconBlock = style({
  position: "absolute",
  left: "8%",
  right: "3%",
  borderRadius: 7,
  boxShadow: "0 3px 0 #183d3b20",
});
export const iconBlockA = style([
  iconBlock,
  { top: "8%", height: "25%", background: t.tealLight },
]);
export const iconBlockB = style([
  iconBlock,
  { top: "40%", height: "14%", background: t.accent },
]);
export const iconBlockC = style([
  iconBlock,
  { top: "64%", height: "21%", background: t.lavender },
]);
export const iconNow = style({
  position: "absolute",
  top: "51%",
  left: "10%",
  right: "6%",
  height: 4,
  background: t.now,
  "::before": {
    content: '""',
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: "50%",
    top: -4,
    left: 0,
    background: t.now,
  },
});
