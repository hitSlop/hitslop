import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", minHeight: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: t.paper });
globalStyle("button, input, textarea", { font: "inherit", color: "inherit", outline: 0 });
globalStyle("button", { cursor: "pointer" });
globalStyle("input:focus-visible, textarea:focus-visible", { borderBottomColor: t.accent, boxShadow: `inset 0 -2px 0 ${t.accent}` });
globalStyle("button:focus-visible, [data-button-root]:focus-visible, [data-checkbox-root]:focus-visible", {
  outline: `3px solid color-mix(in srgb, ${t.accent} 45%, transparent)`,
  outlineOffset: 2,
});
globalStyle("::placeholder", { color: `color-mix(in srgb, ${t.muted} 70%, transparent)`, opacity: 1 });

export const canvas = style({ minHeight: "100%", containerType: "inline-size", background: t.paper });
export const memo = style({
  display: "flex",
  minHeight: "100%",
  flexDirection: "column",
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
});
export const exportMemo = style({
  display: "flex",
  flexDirection: "column",
  background: t.paper,
  fontVariantNumeric: "tabular-nums",
  containerType: "inline-size",
});

export const letterhead = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "18px 26px 16px",
  color: t.letterheadInk,
  background: t.letterhead,
  borderBottom: `2px solid color-mix(in srgb, ${t.accent} 42%, transparent)`,
});
export const metaRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
});
export const badge = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 4,
  padding: "3px 8px",
  color: t.accentInk,
  background: t.accent,
  fontSize: 10,
  fontWeight: 760,
  letterSpacing: ".08em",
  textTransform: "uppercase",
});
export const badgeDot = style({ width: 6, height: 6, borderRadius: "50%", background: t.accentInk });
export const dateRow = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: `color-mix(in srgb, ${t.letterheadInk} 78%, transparent)`,
  fontSize: 12,
});
export const metaField = style({
  minWidth: 0,
  border: 0,
  borderBottom: "1px dashed color-mix(in srgb, white 22%, transparent)",
  padding: "2px 4px",
  color: `color-mix(in srgb, ${t.letterheadInk} 92%, transparent)`,
  background: "transparent",
  fontSize: 12,
});
export const title = style({
  width: "100%",
  margin: 0,
  border: 0,
  borderBottom: "1px dashed transparent",
  padding: "2px 0",
  color: t.letterheadInk,
  background: "transparent",
  fontFamily: t.headingFont,
  fontSize: 26,
  fontWeight: 700,
  lineHeight: 1.2,
  selectors: { "&:hover, &:focus-visible": { borderBottomColor: "color-mix(in srgb, white 30%, transparent)" } },
});
export const attendees = style({ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 12 });
export const attendeesLabel = style({
  color: `color-mix(in srgb, ${t.letterheadInk} 62%, transparent)`,
  fontSize: 11,
  fontWeight: 650,
  letterSpacing: ".05em",
  textTransform: "uppercase",
});
export const pill = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  borderRadius: 12,
  padding: "2px 8px",
  color: t.letterheadInk,
  background: "color-mix(in srgb, white 12%, transparent)",
  fontSize: 12,
});
export const pillRemove = style({
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
  border: 0,
  padding: 0,
  color: `color-mix(in srgb, ${t.letterheadInk} 72%, transparent)`,
  background: "transparent",
  selectors: { "&:hover, &:active": { color: t.letterheadInk } },
});
export const attendeeInput = style({
  width: 92,
  border: "1px dashed color-mix(in srgb, white 25%, transparent)",
  borderRadius: 12,
  padding: "2px 8px",
  color: t.letterheadInk,
  background: "transparent",
  fontSize: 11,
  selectors: { "&:focus-visible": { borderColor: t.accent, boxShadow: "none" } },
});

export const body = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  padding: "20px 26px 18px",
  "@container": { "(max-width: 560px)": { gridTemplateColumns: "1fr", gap: 20 } },
});
globalStyle(`${memo} > .${body}`, { flex: 1 });
export const column = style({ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 });
export const section = style({ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 });
export const sectionHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  borderBottom: `1.5px solid ${t.ink}`,
  paddingBottom: 4,
});
export const sectionTitle = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".09em",
  textTransform: "uppercase",
});
export const sectionCount = style({ color: t.muted, fontSize: 10, fontWeight: 500, letterSpacing: 0, textTransform: "none" });
export const add = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  border: 0,
  borderRadius: 4,
  padding: 0,
  color: t.ink,
  background: "transparent",
  selectors: {
    "&:hover": { color: t.accentInk, background: t.accentSoft },
    "&:active": { color: t.accentInk, background: t.accent },
  },
});

export const list = style({ display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" });
export const agendaItem = style({
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr) 22px",
  alignItems: "center",
  gap: 8,
  borderRadius: 6,
  padding: "4px 6px",
  selectors: {
    "&:hover": { background: t.paperSoft },
    [`${exportMemo} &`]: { gridTemplateColumns: "16px minmax(0, 1fr)" },
  },
});
export const actionItem = style({
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr) 80px 22px",
  alignItems: "center",
  gap: 8,
  border: `1px solid ${t.rule}`,
  borderRadius: 6,
  padding: "6px 8px",
  background: t.paperSoft,
  selectors: {
    "&:hover": { borderColor: `color-mix(in srgb, ${t.ink} 22%, transparent)` },
    '&[data-done="true"]': { opacity: 0.65 },
    [`${exportMemo} &`]: { gridTemplateColumns: "16px minmax(0, 1fr) 80px" },
  },
  "@container": { "(max-width: 400px)": { gridTemplateColumns: "16px minmax(0, 1fr) 22px", gridTemplateRows: "auto auto" } },
});
export const decisionItem = style({
  display: "grid",
  gridTemplateColumns: "12px minmax(0, 1fr) 22px",
  alignItems: "start",
  gap: 6,
  selectors: { [`${exportMemo} &`]: { gridTemplateColumns: "12px minmax(0, 1fr)" } },
});
export const rowText = style({
  width: "100%",
  minWidth: 0,
  border: 0,
  borderBottom: "1px solid transparent",
  padding: "2px 0",
  color: t.ink,
  background: "transparent",
  fontSize: 13.5,
  lineHeight: 1.4,
  overflowWrap: "anywhere",
});
globalStyle(`${agendaItem}[data-done="true"] .${rowText}, ${actionItem}[data-done="true"] .${rowText}`, {
  color: t.dim,
  textDecoration: "line-through",
});
export const owner = style({
  width: 80,
  border: `1px solid color-mix(in srgb, ${t.ownerInk} 15%, transparent)`,
  borderRadius: 12,
  padding: "2px 8px",
  color: t.ownerInk,
  background: t.owner,
  fontSize: 11,
  fontWeight: 650,
  textAlign: "center",
  "@container": { "(max-width: 400px)": { gridColumn: 2, width: "fit-content" } },
});
export const remove = style({
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 22,
  border: 0,
  borderRadius: 5,
  padding: 0,
  color: t.dim,
  background: "transparent",
  opacity: 0,
  selectors: {
    [`${agendaItem}:hover &, ${actionItem}:hover &, ${decisionItem}:hover &`]: { opacity: 1 },
    "&:hover, &:active": { color: t.danger },
    "&:focus-visible": { opacity: 1 },
  },
  "@media": { "(hover: none)": { opacity: 1 } },
});
globalStyle(`${agendaItem} [data-checkbox-root], ${actionItem} [data-checkbox-root]`, {
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
  flexShrink: 0,
  padding: 0,
  border: `1.5px solid ${t.letterhead}`,
  borderRadius: 3,
  color: t.accent,
  background: "transparent",
  cursor: "pointer",
});
globalStyle(`${agendaItem} [data-state="checked"], ${actionItem} [data-state="checked"]`, {
  background: t.letterhead,
  borderColor: t.letterhead,
});
export const empty = style({ margin: 0, color: t.muted, fontSize: 13, fontStyle: "italic" });

export const decisions = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  border: `1.5px solid ${t.decisionRule}`,
  borderRadius: 8,
  padding: "12px 14px",
  background: t.decision,
  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${t.decisionRule} 20%, transparent)`,
});
export const decisionsHeader = style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 });
export const decisionsTitle = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  margin: 0,
  color: "#2e3e14",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
});
export const decisionsDot = style({ width: 7, height: 7, borderRadius: "50%", background: "#9ab41b" });
export const decisionBullet = style({ color: "#8da618", fontWeight: 700, lineHeight: 1.4, userSelect: "none" });
globalStyle(`${decisionItem} .${rowText}`, { color: "#233010", fontSize: 13 });

export const notes = style({
  width: "100%",
  minHeight: 148,
  border: `1px dashed color-mix(in srgb, ${t.ink} 22%, transparent)`,
  borderRadius: 6,
  padding: "10px 12px",
  resize: "none",
  overflow: "hidden",
  fieldSizing: "content",
  color: t.ink,
  background: "transparent",
  fontSize: 13,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
});
export const notesText = style({
  width: "100%",
  minHeight: 0,
  margin: 0,
  color: t.ink,
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
});

export const footer = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginTop: "auto",
  borderTop: `1px solid ${t.rule}`,
  padding: "10px 26px",
  color: t.muted,
  background: t.paperSoft,
  fontSize: 11,
});
export const srOnly = style({ position: "absolute", width: 1, height: 1, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap" });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle('html[data-slop-capture="static"] input, html[data-slop-capture="static"] textarea', { borderBottomColor: "transparent", boxShadow: "none" });
globalStyle("*, *::before, *::after", { "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: ".01ms !important" } } });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconTile = style({
  position: "relative",
  display: "grid",
  placeItems: "center",
  width: 464,
  height: 464,
  overflow: "hidden",
  borderRadius: 96,
  background: t.letterhead,
});
export const iconSheet = style({
  position: "relative",
  display: "flex",
  width: 300,
  height: 372,
  overflow: "hidden",
  flexDirection: "column",
  borderRadius: 18,
  background: t.paper,
});
export const iconClip = style({
  position: "absolute",
  top: 0,
  left: "50%",
  width: 78,
  height: 14,
  transform: "translateX(-50%)",
  borderBottomLeftRadius: 8,
  borderBottomRightRadius: 8,
  background: t.accent,
});
export const iconHeader = style({
  height: 72,
  borderBottom: `6px solid ${t.accent}`,
  background: t.letterhead,
});
export const iconRuleA = style({
  width: 196,
  height: 14,
  margin: "28px 24px 0",
  borderRadius: 4,
  background: t.letterhead,
});
export const iconRuleB = style({
  width: 248,
  height: 12,
  margin: "14px 24px 0",
  borderRadius: 4,
  background: t.paperSoft,
});
export const iconCard = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "22px 24px 0",
  border: `3px solid ${t.decisionRule}`,
  borderRadius: 10,
  padding: 14,
  background: t.decision,
});
export const iconCardDot = style({ width: 14, height: 14, flexShrink: 0, borderRadius: "50%", background: t.decisionRule });
export const iconCardLine = style({ width: 132, height: 10, borderRadius: 4, background: t.accentInk });
