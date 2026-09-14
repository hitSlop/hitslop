import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

const toneVars = {
  "&[data-tone='cyan']": { vars: { "--slop-accent": t.toneCyan, "--slop-accent-bg": t.toneCyanBg } },
  "&[data-tone='teal']": { vars: { "--slop-accent": t.toneTeal, "--slop-accent-bg": t.toneTealBg } },
  "&[data-tone='mint']": { vars: { "--slop-accent": t.toneMint, "--slop-accent-bg": t.toneMintBg } },
  "&[data-tone='lime']": { vars: { "--slop-accent": t.toneLime, "--slop-accent-bg": t.toneLimeBg } },
  "&[data-tone='amber']": { vars: { "--slop-accent": t.toneAmber, "--slop-accent-bg": t.toneAmberBg } },
  "&[data-tone='orange']": { vars: { "--slop-accent": t.toneOrange, "--slop-accent-bg": t.toneOrangeBg } },
  "&[data-tone='coral']": { vars: { "--slop-accent": t.toneCoral, "--slop-accent-bg": t.toneCoralBg } },
  "&[data-tone='rose']": { vars: { "--slop-accent": t.toneRose, "--slop-accent-bg": t.toneRoseBg } },
  "&[data-tone='lavender']": { vars: { "--slop-accent": t.toneLavender, "--slop-accent-bg": t.toneLavenderBg } },
  "&[data-tone='indigo']": { vars: { "--slop-accent": t.toneIndigo, "--slop-accent-bg": t.toneIndigoBg } },
} as const;

const pipTones = {
  [`&[data-tab-tone="cyan"]`]: { background: t.toneCyan },
  [`&[data-tab-tone="teal"]`]: { background: t.toneTeal },
  [`&[data-tab-tone="mint"]`]: { background: t.toneMint },
  [`&[data-tab-tone="lime"]`]: { background: t.toneLime },
  [`&[data-tab-tone="amber"]`]: { background: t.toneAmber },
  [`&[data-tab-tone="orange"]`]: { background: t.toneOrange },
  [`&[data-tab-tone="coral"]`]: { background: t.toneCoral },
  [`&[data-tab-tone="rose"]`]: { background: t.toneRose },
  [`&[data-tab-tone="lavender"]`]: { background: t.toneLavender },
  [`&[data-tab-tone="indigo"]`]: { background: t.toneIndigo },
} as const;

const choiceTones = {
  '&[data-choice-tone="cyan"]': { background: t.toneCyan },
  '&[data-choice-tone="teal"]': { background: t.toneTeal },
  '&[data-choice-tone="mint"]': { background: t.toneMint },
  '&[data-choice-tone="lime"]': { background: t.toneLime },
  '&[data-choice-tone="amber"]': { background: t.toneAmber },
  '&[data-choice-tone="orange"]': { background: t.toneOrange },
  '&[data-choice-tone="coral"]': { background: t.toneCoral },
  '&[data-choice-tone="rose"]': { background: t.toneRose },
  '&[data-choice-tone="lavender"]': { background: t.toneLavender },
  '&[data-choice-tone="indigo"]': { background: t.toneIndigo },
} as const;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", {
  color: t.ink,
  background: t.shell,
  overflow: "hidden",
  fontVariantNumeric: "tabular-nums",
  userSelect: "none",
  WebkitUserSelect: "none",
});
globalStyle("button, input, [data-checkbox-root], [data-radio-group-item], [data-button-root]", { font: "inherit", color: "inherit" });
globalStyle("button, [data-checkbox-root], [data-radio-group-item], [data-button-root]", {
  cursor: "pointer",
  border: 0,
  background: "transparent",
  padding: 0,
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled, [data-checkbox-root][data-disabled], [data-radio-group-item][data-disabled], [data-button-root]:disabled", { cursor: "default" });
globalStyle(":focus-visible, [data-checkbox-root]:focus-visible, [data-radio-group-item]:focus-visible, [data-button-root]:focus-visible", { outline: `3px solid ${t.focus} !important`, outlineOffset: 2 });

export const pocketShell = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  padding: "12px 14px 14px",
  background: `radial-gradient(circle at 92% 12%, rgba(255, 255, 255, 0.28) 0, transparent 40px), linear-gradient(180deg, ${t.shellHi} 0%, ${t.shell} 14%, ${t.shell} 88%, ${t.shellRim} 100%)`,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.45)",
  overflow: "hidden",
  containerType: "inline-size",
  selectors: toneVars,
});

export const chassisHeader = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginBottom: 8,
});

export const brandRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 4px",
});

export const deviceScrew = style({
  width: 9,
  height: 9,
  borderRadius: "50%",
  background: "radial-gradient(circle, #bfa05d 0%, #826a35 80%)",
  boxShadow: "inset 0 1px 1px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.3)",
  position: "relative",
  selectors: {
    "&::before": {
      content: '""',
      position: "absolute",
      top: 4,
      left: 1,
      width: 7,
      height: 1,
      background: "rgba(0, 0, 0, 0.4)",
    },
  },
});

export const speakerGrill = style({
  display: "flex",
  gap: 3.5,
  alignItems: "center",
});
globalStyle(`${speakerGrill} i`, {
  width: 3.5,
  height: 8,
  borderRadius: 2,
  background: "rgba(41, 34, 24, 0.22)",
});

export const habitTabs = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  overflowX: "auto",
  padding: "2px 2px 4px",
  scrollbarWidth: "none",
  selectors: { "&::-webkit-scrollbar": { display: "none" } },
});

export const habitTab = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "rgba(41, 34, 24, 0.09)",
  border: "1px solid rgba(41, 34, 24, 0.14)",
  color: t.ink,
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  transition: "transform 0.1s ease, background-color 0.12s ease",
  selectors: {
    "&:hover": { background: "rgba(41, 34, 24, 0.14)" },
    '&[data-active="true"]': {
      background: t.ink,
      borderColor: t.ink,
      color: t.onAccent,
      boxShadow: "0 2px 4px rgba(41, 34, 24, 0.22)",
    },
  },
});

export const tabPip = style({
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "rgba(41, 34, 24, 0.35)",
  selectors: {
    [`${habitTab}[data-active="true"] &`]: {
      background: t.accent,
      boxShadow: `0 0 5px ${t.accent}`,
    },
  },
});
globalStyle(`${habitTab}[data-tab-tone="cyan"] .${tabPip}`, pipTones['&[data-tab-tone="cyan"]']);
globalStyle(`${habitTab}[data-tab-tone="teal"] .${tabPip}`, pipTones['&[data-tab-tone="teal"]']);
globalStyle(`${habitTab}[data-tab-tone="mint"] .${tabPip}`, pipTones['&[data-tab-tone="mint"]']);
globalStyle(`${habitTab}[data-tab-tone="lime"] .${tabPip}`, pipTones['&[data-tab-tone="lime"]']);
globalStyle(`${habitTab}[data-tab-tone="amber"] .${tabPip}`, pipTones['&[data-tab-tone="amber"]']);
globalStyle(`${habitTab}[data-tab-tone="orange"] .${tabPip}`, pipTones['&[data-tab-tone="orange"]']);
globalStyle(`${habitTab}[data-tab-tone="coral"] .${tabPip}`, pipTones['&[data-tab-tone="coral"]']);
globalStyle(`${habitTab}[data-tab-tone="rose"] .${tabPip}`, pipTones['&[data-tab-tone="rose"]']);
globalStyle(`${habitTab}[data-tab-tone="lavender"] .${tabPip}`, pipTones['&[data-tab-tone="lavender"]']);
globalStyle(`${habitTab}[data-tab-tone="indigo"] .${tabPip}`, pipTones['&[data-tab-tone="indigo"]']);

export const addHabitBtn = style({
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "rgba(41, 34, 24, 0.12)",
  border: "1px solid rgba(41, 34, 24, 0.18)",
  color: t.ink,
  transition: "transform 0.1s ease, background 0.1s ease",
  selectors: {
    "&:hover": { background: "rgba(41, 34, 24, 0.2)", transform: "scale(1.06)" },
  },
});

export const lcdWell = style({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  background: t.screen,
  border: `3px solid ${t.ink}`,
  borderRadius: 16,
  boxShadow: "inset 0 2px 4px rgba(41, 34, 24, 0.12), 0 3px 0 rgba(255, 255, 255, 0.4)",
  padding: "12px 14px 10px",
  minHeight: 0,
  overflow: "hidden",
});

export const lcdHead = style({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingBottom: 10,
  borderBottom: `2px solid ${t.ruleStrong}`,
});

export const habitTitleRow = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
});

export const titleWrap = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
});

export const lcdCategory = style({
  fontSize: 8.5,
  fontWeight: 800,
  letterSpacing: "0.12em",
  color: t.inkMuted,
});

export const habitTitle = style({
  margin: 0,
  fontSize: 18,
  fontWeight: 850,
  letterSpacing: "-0.02em",
  color: t.ink,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const editHabitBtn = style({
  padding: "3px 9px",
  borderRadius: 6,
  border: `1.5px solid ${t.ruleStrong}`,
  fontSize: 10,
  fontWeight: 800,
  color: t.inkMuted,
  background: t.screenDeep,
  transition: "color 0.1s ease, border-color 0.1s ease",
  selectors: {
    "&:hover": { color: t.ink, borderColor: t.ink },
  },
});

export const punchAndStats = style({
  display: "grid",
  gridTemplateColumns: "1.3fr 1fr",
  gap: 8,
  alignItems: "stretch",
});

export const todayPunch = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 12,
  border: `2px solid ${t.ink}`,
  background: t.screenDeep,
  boxShadow: `0 3px 0 ${t.ink}`,
  transformOrigin: "center",
  transition: "box-shadow 0.08s ease, background-color 0.12s ease",
  textAlign: "left",
  selectors: {
    "&:hover": { transform: "translateY(-1px)", boxShadow: `0 4px 0 ${t.ink}` },
    "&:active": { transform: "translateY(2px)", boxShadow: `0 1px 0 ${t.ink}` },
    '&[data-checkbox-root][data-state="checked"]': { background: t.accent, borderColor: t.ink, color: t.onAccent },
  },
});

export const punchIconCircle = style({
  display: "grid",
  placeItems: "center",
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: `2.5px solid ${t.ink}`,
  background: t.onAccent,
  color: t.ink,
  flexShrink: 0,
  boxShadow: "inset 0 2px 2px rgba(0, 0, 0, 0.12)",
  selectors: {
    [`${todayPunch}[data-checkbox-root][data-state="checked"] &`]: { background: t.onAccent, color: t.accent },
  },
});

export const punchUncheckRing = style({
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: `2.5px dashed ${t.inkMuted}`,
});

export const punchText = style({
  display: "flex",
  flexDirection: "column",
  gap: 1,
});

export const punchSub = style({
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: "0.08em",
  opacity: 0.85,
});

export const punchMain = style({
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: "-0.01em",
});

export const statsCluster = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  justifyContent: "center",
});

export const statPill = style({
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "4px 8px",
  borderRadius: 8,
  background: t.screenDeep,
  border: `1px solid ${t.ruleStrong}`,
});

export const streakPill = style({
  background: t.accentBg,
  borderColor: t.accent,
});

export const statIconWrap = style({
  display: "grid",
  placeItems: "center",
  color: t.ink,
  opacity: 0.75,
  selectors: {
    [`${streakPill} &`]: { color: t.accent, opacity: 1 },
  },
});

export const statDetails = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  width: "100%",
});

export const statLabel = style({
  fontSize: 7.5,
  fontWeight: 850,
  letterSpacing: "0.06em",
  color: t.inkMuted,
});

export const statValue = style({
  fontSize: 12,
  fontWeight: 850,
  color: t.ink,
});
globalStyle(`${statValue} small`, {
  fontSize: 8,
  fontWeight: 750,
  color: t.inkMuted,
});

export const matrixContainer = style({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingTop: 10,
  minHeight: 0,
});

export const matrixHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 8.5,
  fontWeight: 850,
  letterSpacing: "0.08em",
  color: t.inkMuted,
});

export const matrixLegend = style({
  display: "flex",
  gap: 8,
});

export const legendItem = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
});

export const sampleCircle = style({
  display: "inline-block",
  width: 9,
  height: 9,
  borderRadius: "50%",
  border: `1.5px solid ${t.ink}`,
  background: t.onAccent,
  selectors: {
    '&[data-on="true"]': { background: t.accent, borderColor: t.accent },
  },
});

export const weekdayLabels = style({
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 6,
  textAlign: "center",
  fontSize: 8.5,
  fontWeight: 850,
  letterSpacing: "0.06em",
  color: t.inkMuted,
  padding: "0 4px",
});

export const bubbleGrid = style({
  flex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gridTemplateRows: "repeat(7, 1fr)",
  gap: 5,
  padding: "2px 4px",
  alignContent: "stretch",
});

export const bubbleCell = style({
  position: "relative",
  display: "grid",
  placeItems: "center",
  width: "100%",
  aspectRatio: "1 / 1",
  maxWidth: 42,
  margin: "0 auto",
  borderRadius: "50%",
  border: `2px solid ${t.ink}`,
  background: t.onAccent,
  color: t.inkMuted,
  boxShadow: "inset 0 2px 3px rgba(41, 34, 24, 0.08), 0 1px 0 rgba(255, 255, 255, 0.6)",
  transition: "transform 0.06s ease, background 0.1s ease, border-color 0.1s ease",
  selectors: {
    "&:hover:not(:disabled):not([data-disabled])": { transform: "scale(1.08)", borderColor: t.accent },
    "&:active:not(:disabled):not([data-disabled])": { transform: "scale(0.94)" },
    '&[data-checkbox-root][data-state="checked"]': {
      background: t.accent,
      borderColor: t.ink,
      color: t.onAccent,
      boxShadow: "0 2px 4px rgba(41, 34, 24, 0.25)",
    },
    '&[data-future="true"]': {
      opacity: 0.22,
      cursor: "default",
      borderStyle: "dashed",
      boxShadow: "none",
    },
    '&[data-today="true"]': {
      borderWidth: 2.5,
      borderColor: t.focus,
      boxShadow: "0 0 0 2px rgba(194, 94, 0, 0.35)",
    },
  },
});

export const cellNum = style({
  fontSize: 10.5,
  fontWeight: 800,
  lineHeight: 1,
});

export const todayMarker = style({
  position: "absolute",
  bottom: 2,
  width: 4,
  height: 4,
  borderRadius: "50%",
  background: t.focus,
});

export const overviewRail = style({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 10,
  padding: "0 4px",
});

export const railHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 8,
  fontWeight: 850,
  letterSpacing: "0.12em",
  color: t.ink,
  opacity: 0.8,
});

export const railList = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
});

export const railHabitChip = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 8px 3px 4px",
  borderRadius: 8,
  background: "rgba(41, 34, 24, 0.08)",
  border: "1.5px solid rgba(41, 34, 24, 0.15)",
});

export const chipToggle = style({
  display: "grid",
  placeItems: "center",
  width: 20,
  height: 20,
  borderRadius: 5,
  border: `1.5px solid ${t.ink}`,
  background: t.onAccent,
  color: "transparent",
  transition: "background 0.1s ease, color 0.1s ease",
  selectors: {
    '&[data-checkbox-root][data-state="checked"]': { background: t.ink, color: t.onAccent },
  },
});

export const chipNameBtn = style({
  fontSize: 11,
  fontWeight: 750,
  color: t.ink,
  selectors: { "&:hover": { textDecoration: "underline" } },
});

globalStyle("[data-dialog-overlay]", {
  position: "fixed",
  inset: 0,
  background: "rgba(41, 34, 24, 0.65)",
  backdropFilter: "blur(2px)",
  zIndex: 100,
});

export const modalCard = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "calc(100% - 40px)",
  maxWidth: 360,
  background: t.screen,
  border: `3px solid ${t.ink}`,
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.35)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  zIndex: 101,
  outline: "none",
});

export const modalHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
globalStyle(`${modalHead} h2, ${modalHead} [data-dialog-title]`, { margin: 0, fontSize: 16, fontWeight: 850 });

export const modalClose = style({
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 26,
  borderRadius: 6,
  color: t.inkMuted,
  selectors: {
    "&:hover": { color: t.ink, background: t.screenDeep },
  },
});

globalStyle(`${modalCard} form`, {
  display: "flex",
  flexDirection: "column",
  gap: 12,
});

export const formField = style({
  display: "flex",
  flexDirection: "column",
  gap: 5,
});
globalStyle(`${formField} span`, {
  fontSize: 8,
  fontWeight: 850,
  letterSpacing: "0.1em",
  color: t.inkMuted,
});
globalStyle(`${formField} input`, {
  padding: "8px 10px",
  borderRadius: 8,
  border: `2px solid ${t.ink}`,
  background: t.onAccent,
  fontSize: 13,
  fontWeight: 700,
});
globalStyle(`${formField} input:focus-visible`, { outline: `2px solid ${t.focus}` });

export const colorPickerRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
});
globalStyle(`${colorPickerRow}[data-radio-group-root]`, {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
});

export const colorChoice = style({
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: "2px solid transparent",
  transition: "transform 0.1s ease",
  selectors: {
    ...choiceTones,
    '&[data-radio-group-item][data-state="checked"]': {
      borderColor: t.ink,
      transform: "scale(1.15)",
      boxShadow: `0 0 0 2px ${t.onAccent}`,
    },
  },
});

export const modalActions = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 6,
});

export const spacer = style({ flex: 1 });

export const btnPrimary = style({
  padding: "8px 14px",
  borderRadius: 8,
  border: `2px solid ${t.ink}`,
  background: t.ink,
  color: t.onAccent,
  fontSize: 12,
  fontWeight: 800,
  boxShadow: "0 2px 0 rgba(0, 0, 0, 0.25)",
});

export const btnSecondary = style({
  padding: "8px 12px",
  borderRadius: 8,
  border: `1.5px solid ${t.ruleStrong}`,
  background: t.screenDeep,
  color: t.ink,
  fontSize: 12,
  fontWeight: 750,
});

export const btnDanger = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1.5px solid ${t.toneCoral}`,
  background: t.toneCoralBg,
  color: t.toneCoral,
  fontSize: 11.5,
  fontWeight: 800,
});

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.screen,
  color: t.toneCoral,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button, ${error} [data-button-root]`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.screenDeep,
  color: t.ink,
  fontSize: 11,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${pocketShell}`, { overflow: "visible", height: "auto", minHeight: "100%" });
globalStyle(`html[data-slop-capture="static"] .${todayPunch}`, { cursor: "default", boxShadow: "none" });
globalStyle(`html[data-slop-capture="static"] .${bubbleCell}`, { cursor: "default" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const habitIcon = style({
  position: "relative",
  width: 440,
  height: 440,
  borderRadius: 70,
  border: `16px solid ${t.ink}`,
  background: `linear-gradient(180deg, ${t.shellHi} 0%, ${t.shell} 20%, ${t.shellRim} 100%)`,
  boxShadow: "inset 0 0 0 10px rgba(255, 255, 255, 0.4)",
  padding: "24px 28px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
});
export const iconHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
export const iconLens = style({
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: t.ink,
});
export const iconLabel = style({
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.16em",
  color: t.ink,
});
export const iconSpeaker = style({ display: "flex", gap: 4 });
globalStyle(`${iconSpeaker} i`, {
  width: 4,
  height: 14,
  borderRadius: 2,
  background: "rgba(41, 34, 24, 0.3)",
});
export const iconScreen = style({
  flex: 1,
  background: t.screen,
  border: `10px solid ${t.ink}`,
  borderRadius: 28,
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
});
export const iconScreenTop = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
export const iconBadge = style({
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  padding: "4px 10px",
  borderRadius: 6,
  background: t.toneCyan,
  color: t.onAccent,
});
export const iconRate = style({
  fontSize: 16,
  fontWeight: 900,
  color: t.ink,
});
export const iconGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 12,
  justifyItems: "center",
  padding: "6px 0",
});
export const iconCell = style({
  width: 24,
  height: 24,
  borderRadius: "50%",
  border: `3.5px solid ${t.ink}`,
  background: t.onAccent,
  selectors: {
    '&[data-on="true"]': { background: t.toneCyan, borderColor: t.ink },
  },
});
export const iconButtons = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 10px",
});
export const iconBtnBig = style({
  display: "grid",
  placeItems: "center",
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: `8px solid ${t.ink}`,
  background: t.toneCyan,
  color: t.onAccent,
  fontSize: 24,
  fontWeight: 900,
});
export const iconBtnPair = style({ display: "flex", gap: 10 });
export const iconBtnSmall = style({
  width: 24,
  height: 24,
  borderRadius: "50%",
  border: `5px solid ${t.ink}`,
  background: t.onAccent,
});

export const exportPocket = style([pocketShell, {
  height: "auto",
  overflow: "visible",
}]);
