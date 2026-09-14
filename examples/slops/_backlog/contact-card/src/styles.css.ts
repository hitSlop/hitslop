import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "dark", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", { background: t.surface, color: t.ink, overflow: "hidden" });
globalStyle("button, input, textarea, a", { font: "inherit", color: "inherit" });
globalStyle("button", { cursor: "pointer", WebkitTapHighlightColor: "transparent" });
globalStyle("button:disabled", { cursor: "default", opacity: 0.45 });
globalStyle("button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible, [data-tooltip-trigger]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.ink}`,
  outlineOffset: 2,
});
globalStyle("textarea", { resize: "none" });
globalStyle("::placeholder", { color: t.dim, opacity: 1 });

export const canvas = style({
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: t.canvas,
  padding: "12px 26px 12px 12px",
  overflow: "hidden",
  containerType: "inline-size",
  "@media": { "(max-width: 360px)": { padding: "10px 22px 10px 10px" } },
});

export const tray = style({
  position: "relative",
  flex: 1,
  minHeight: 0,
  display: "flex",
});

export const indexTab = style({
  position: "absolute",
  top: 86,
  right: -18,
  zIndex: 2,
  width: 22,
  height: 52,
  display: "grid",
  placeItems: "center",
  background: t.ink,
  color: t.glass,
  borderRadius: "0 7px 7px 0",
  boxShadow: "2px 3px 8px rgba(0, 0, 0, 0.28)",
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "-0.04em",
  userSelect: "none",
});

export const badge = style({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "16px 20px 18px",
  overflowY: "auto",
  position: "relative",
  background: t.glass,
  borderRadius: t.radius,
  border: `1.5px solid ${t.border}`,
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
});

export const notch = style({
  width: 50,
  height: 6,
  margin: "0 auto",
  background: `color-mix(in srgb, ${t.ink} 15%, transparent)`,
  borderRadius: 4,
});

export const stamp = style({
  margin: "-6px 0 0",
  textAlign: "center",
  color: t.dim,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.18em",
});

export const hero = style({
  display: "flex",
  alignItems: "center",
  gap: 14,
  paddingBottom: 12,
  borderBottom: `1px solid color-mix(in srgb, ${t.border} 40%, transparent)`,
});

export const avatar = style({
  position: "relative",
  width: 76,
  height: 76,
  flexShrink: 0,
  padding: 0,
  overflow: "hidden",
  border: `3px solid ${t.pill}`,
  borderRadius: "50%",
  background: t.avatarFill,
  boxShadow: "0 4px 10px rgba(18, 49, 36, 0.12)",
  cursor: "pointer",
});

export const avatarImg = style({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
});

export const monogram = style({
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  color: t.avatarInk,
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: "-0.04em",
});

export const overlay = style({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `color-mix(in srgb, ${t.ink} 40%, transparent)`,
  color: t.onAccent,
  opacity: 0,
  transition: "opacity 0.15s",
  selectors: {
    [`${avatar}:hover &`]: { opacity: 1 },
    [`${avatar}:focus-visible &`]: { opacity: 1 },
  },
});

export const profile = style({
  display: "flex",
  flexDirection: "column",
  gap: 3,
  flex: 1,
  minWidth: 0,
});

export const nameInput = style({
  width: "100%",
  padding: "1px 0",
  background: "transparent",
  border: "none",
  borderBottom: "1px dashed transparent",
  outline: "none",
  color: t.ink,
  fontSize: 20,
  fontWeight: 800,
  selectors: {
    "&:hover, &:focus-visible": { borderBottomColor: t.borderStrong },
  },
});

export const headlineInput = style({
  width: "100%",
  padding: "1px 0",
  background: "transparent",
  border: "none",
  borderBottom: "1px dashed transparent",
  outline: "none",
  color: t.muted,
  fontSize: 13,
  fontWeight: 600,
  selectors: {
    "&:hover, &:focus-visible": { borderBottomColor: t.borderStrong },
  },
});

export const locationTag = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  marginTop: 2,
  color: t.dim,
  fontSize: 11.5,
});

export const locInput = style({
  width: 140,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "inherit",
  fontSize: 11.5,
  fontFamily: "inherit",
});

export const nameText = style({
  margin: 0,
  color: t.ink,
  fontSize: 20,
  fontWeight: 800,
  overflowWrap: "anywhere",
});

export const headlineText = style({
  margin: 0,
  color: t.muted,
  fontSize: 13,
  fontWeight: 600,
  overflowWrap: "anywhere",
});

export const locationText = style({
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const bioBox = style({
  background: t.glassSubtle,
  border: `1px solid color-mix(in srgb, ${t.border} 35%, transparent)`,
  borderRadius: 12,
  padding: "10px 12px",
});

export const bioInput = style({
  width: "100%",
  minHeight: 54,
  background: "transparent",
  border: "none",
  outline: "none",
  color: t.ink,
  fontFamily: "inherit",
  fontSize: 12.5,
  lineHeight: 1.5,
});

export const bioText = style({
  margin: 0,
  color: t.ink,
  fontSize: 12.5,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});

export const channels = style({
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  flex: 1,
  margin: 0,
  padding: 0,
});

export const row = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: t.pill,
  border: `1px solid ${t.border}`,
  borderRadius: 12,
  padding: "8px 12px",
  boxShadow: "0 2px 4px rgba(18, 49, 36, 0.05)",
  transition: "box-shadow 0.1s",
  selectors: {
    "&:hover": { boxShadow: "0 3px 6px rgba(18, 49, 36, 0.1)" },
  },
});

export const bubble = style({
  width: 28,
  height: 28,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: t.glassSubtle,
  color: t.ink,
});

export const fields = style({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minWidth: 0,
});

export const label = style({
  color: t.dim,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
});

export const valueInput = style({
  width: "100%",
  padding: "1px 0",
  background: "transparent",
  border: "none",
  outline: "none",
  color: t.ink,
  fontSize: 13,
  fontWeight: 600,
});

export const valueText = style({
  color: t.ink,
  fontSize: 13,
  fontWeight: 600,
  overflowWrap: "anywhere",
});

export const actionBtn = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 4,
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: t.muted,
  cursor: "pointer",
  textDecoration: "none",
  transition: "color 0.15s, background 0.15s",
  selectors: {
    "&:hover": { color: t.ink, background: t.glassSubtle },
    "&:disabled, &[data-disabled], &[aria-disabled='true']": { opacity: 0.35, pointerEvents: "none" },
  },
});

export const footer = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  paddingTop: 10,
  borderTop: `1px solid color-mix(in srgb, ${t.border} 40%, transparent)`,
});

export const circles = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
});

export const circleBtn = style({
  width: 36,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: t.pill,
  border: `1px solid ${t.border}`,
  color: t.ink,
  textDecoration: "none",
  boxShadow: "0 2px 4px rgba(18, 49, 36, 0.08)",
  transition: "transform 0.12s, background 0.12s",
  selectors: {
    "&:hover": { transform: "translateY(-1px)", background: t.pill },
    '&[aria-disabled="true"]': { opacity: 0.35, pointerEvents: "none", transform: "none" },
  },
});

export const vcardBtn = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  border: "none",
  borderRadius: 18,
  background: t.ink,
  color: t.onAccent,
  fontSize: 12,
  fontWeight: 700,
  boxShadow: "0 4px 8px rgba(17, 49, 36, 0.25)",
  transition: "transform 0.12s, background 0.12s",
  selectors: {
    "&:hover": { background: `color-mix(in srgb, ${t.ink} 75%, black)`, transform: "translateY(-1px)" },
  },
});

export const empty = style({
  margin: 0,
  padding: "8px 4px",
  color: t.muted,
  fontSize: 12,
  textAlign: "center",
});

export const error = style({
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  background: t.pill,
  color: t.accent,
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.pillHover,
  color: t.ink,
  fontSize: 11,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${canvas}`, { height: "auto", minHeight: "100vh", overflow: "visible" });
globalStyle(`html[data-slop-capture="static"] .${badge}`, { overflow: "visible" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important", scrollBehavior: "auto" } },
});

export const copied = style({ color: t.accent });
export const tooltip = style({
  zIndex: 50,
  padding: "5px 8px",
  border: `1px solid ${t.border}`,
  borderRadius: 6,
  background: t.pill,
  color: t.ink,
  fontSize: 11,
  fontWeight: 600,
  boxShadow: "0 6px 18px rgba(17, 49, 36, 0.18)",
});

export const exportCanvas = style({
  display: "flex",
  background: t.canvas,
  padding: "12px 26px 12px 12px",
  position: "relative",
  overflow: "hidden",
});
globalStyle(`${exportCanvas} .${badge}`, { flex: 1, overflow: "visible" });
globalStyle(`${exportCanvas} .${indexTab}`, { right: 4 });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconPlate = style({
  width: 512,
  height: 512,
  background: t.canvas,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});
export const iconBadge = style({
  width: 420,
  height: 450,
  background: t.glass,
  borderRadius: 44,
  border: `14px solid ${t.border}`,
  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.5)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "30px 32px",
  gap: 22,
  position: "relative",
});
export const iconNotch = style({
  width: 70,
  height: 10,
  background: `color-mix(in srgb, ${t.ink} 20%, transparent)`,
  borderRadius: 5,
});
export const iconTab = style({
  position: "absolute",
  top: 92,
  right: -18,
  width: 28,
  height: 64,
  display: "grid",
  placeItems: "center",
  background: t.ink,
  color: t.glass,
  borderRadius: "0 10px 10px 0",
  fontSize: 22,
  fontWeight: 800,
});
export const iconAvatar = style({
  width: 100,
  height: 100,
  borderRadius: "50%",
  border: `8px solid ${t.pill}`,
  background: t.avatarFill,
  boxShadow: "0 4px 12px rgba(18, 49, 36, 0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: t.avatarInk,
  fontSize: 36,
  fontWeight: 800,
});
export const iconTextGroup = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  width: "100%",
});
export const iconNameBar = style({
  width: 160,
  height: 16,
  background: t.ink,
  borderRadius: 8,
});
export const iconSubBar = style({
  width: 110,
  height: 10,
  background: t.muted,
  borderRadius: 5,
});
export const iconLines = style({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "100%",
});
export const iconRow = style({
  height: 18,
  background: t.pill,
  borderRadius: 9,
  border: `2px solid ${t.avatarFill}`,
});
export const iconButtons = style({
  display: "flex",
  justifyContent: "center",
  gap: 16,
  marginTop: "auto",
});
export const iconCircle = style({
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: t.pill,
  border: `4px solid ${t.avatarFill}`,
});
