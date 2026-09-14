import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, colorScheme: "light", fontSynthesis: "none" });
globalStyle("html, body, #app", { margin: 0, width: "100%", height: "100%", minHeight: "100%" });
globalStyle("body", {
  color: t.ink,
  background: t.shell,
  overflow: "hidden",
  userSelect: "none",
  WebkitUserSelect: "none",
});
globalStyle("button", {
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  border: 0,
  background: "transparent",
  padding: 0,
  WebkitTapHighlightColor: "transparent",
});
globalStyle("button:disabled", { cursor: "default", opacity: 0.35 });
globalStyle("button:focus-visible, [data-toggle-group-item]:focus-visible, [data-tabs-trigger]:focus-visible, [data-radio-group-item]:focus-visible", {
  outline: `2px solid ${t.focus}`,
  outlineOffset: 2,
});

export const shell = style({
  containerType: "inline-size",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto auto auto",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  padding: "14px 18px 16px",
  background: `linear-gradient(180deg, ${t.shellHi}, ${t.shell} 12%, ${t.shell} 82%, ${t.shellDeep})`,
  border: `2px solid ${t.shellBorder}`,
  "@media": { "(max-width: 400px)": { paddingInline: 12 } },
});

export const brand = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
  color: t.ink,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.16em",
});
export const brandDot = style({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: t.hardware,
  boxShadow: "inset 0 1px 1px rgb(255 255 255 / 40%)",
});

export const screenBezel = style({
  minHeight: 0,
  padding: 14,
  borderRadius: "12px 12px 28px 12px",
  background: t.bezel,
  boxShadow: "inset 0 2px 0 rgb(255 255 255 / 8%), 0 8px 0 rgb(0 0 0 / 18%)",
});
export const pixelGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
  gridTemplateRows: "repeat(16, minmax(0, 1fr))",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  border: `3px solid ${t.bezelEdge}`,
  background: `repeating-conic-gradient(${t.screenLite} 0% 25%, ${t.screenMid} 0% 50%) 0 0 / 12.5% 12.5%`,
  touchAction: "none",
  cursor: "crosshair",
});
export const cell = style({ minWidth: 0, minHeight: 0 });

export const toolRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  margin: "12px 0 8px",
});
export const toolGroup = style({ display: "flex", gap: 6 });
export const tool = style({
  display: "grid",
  placeItems: "center",
  minWidth: 36,
  height: 32,
  padding: "0 8px",
  borderRadius: 8,
  background: t.control,
  boxShadow: `0 2px 0 ${t.shellBorder}`,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  border: "none",
  selectors: {
    '&[data-state="on"]': {
      background: t.purple,
      color: t.onPurple,
      boxShadow: `0 1px 0 ${t.purpleDeep}`,
    },
  },
});
export const exportTool = style({ marginLeft: "auto" });

export const paletteBlock = style({ display: "grid", gap: 8 });
export const paletteTabs = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
});
export const paletteTab = style({
  display: "grid",
  placeItems: "center",
  minWidth: 36,
  height: 32,
  padding: "0 8px",
  borderRadius: 8,
  background: t.control,
  boxShadow: `0 2px 0 ${t.shellBorder}`,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  border: "none",
  selectors: {
    '&[data-state="active"]': {
      background: t.purple,
      color: t.onPurple,
      boxShadow: `0 1px 0 ${t.purpleDeep}`,
    },
  },
});
export const swatches = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
});
export const swatch = style({
  width: 22,
  height: 22,
  border: "2px solid rgb(0 0 0 / 28%)",
  borderRadius: 4,
  selectors: {
    '&[data-state="checked"]': {
      outline: "2px solid #fff",
      outlineOffset: 1,
      borderColor: t.ink,
    },
  },
});

export const hardware = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 18px 0",
  "@container": { "(max-width: 400px)": { paddingInline: 8 } },
});
export const dpad = style({
  position: "relative",
  width: 78,
  height: 78,
  "@container": { "(max-width: 400px)": { transform: "scale(0.86)", transformOrigin: "left center" } },
});
export const dpadArm = style({
  position: "absolute",
  background: t.hardware,
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 18%)",
});
export const dpadUp = style({ left: 27, top: 0, width: 24, height: 30, borderRadius: "4px 4px 0 0" });
export const dpadDown = style({ left: 27, bottom: 0, width: 24, height: 30, borderRadius: "0 0 4px 4px" });
export const dpadLeft = style({ top: 27, left: 0, width: 30, height: 24, borderRadius: "4px 0 0 4px" });
export const dpadRight = style({ top: 27, right: 0, width: 30, height: 24, borderRadius: "0 4px 4px 0" });
export const faceButtons = style({ display: "flex", gap: 14 });
export const faceButton = style({
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: t.purple,
  color: t.onPurple,
  fontSize: 12,
  fontWeight: 800,
  boxShadow: `0 3px 0 ${t.purpleDeep}`,
});
export const faceButtonOffset = style({
  transform: "translateY(10px)",
  background: t.purpleHi,
});

export const error = style({
  position: "absolute",
  right: 16,
  bottom: 10,
  left: 16,
  margin: 0,
  color: t.danger,
  fontSize: 12,
  textAlign: "center",
  overflowWrap: "anywhere",
});
globalStyle(`${error} button`, {
  marginLeft: 8,
  border: `1px solid ${t.ink}`,
  borderRadius: 5,
  padding: "3px 7px",
  background: t.control,
  color: t.ink,
  fontSize: 11,
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle(`html[data-slop-capture="static"] .${shell}`, {
  gridTemplateRows: "auto minmax(0, 1fr) auto auto",
  height: "auto",
  minHeight: "100vh",
});
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconBody = style({
  display: "grid",
  gridTemplateRows: "1fr auto",
  width: 360,
  height: 460,
  padding: 28,
  border: `14px solid ${t.shellBorder}`,
  borderRadius: 48,
  background: `linear-gradient(180deg, ${t.shellHi}, ${t.shell})`,
  boxShadow: "0 18px 32px rgb(0 0 0 / 28%)",
});
export const iconBezel = style({
  padding: 16,
  borderRadius: "16px 16px 36px 16px",
  background: t.bezel,
});
export const iconScreen = style({
  display: "grid",
  gridTemplateColumns: "repeat(8, 1fr)",
  gridTemplateRows: "repeat(8, 1fr)",
  height: "100%",
  background: t.screen,
});
export const iconPixel = style({
  background: t.screen,
  selectors: { '&[data-on="true"]': { background: t.screenDeep } },
});
export const iconControls = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 10px 0",
});
export const iconDpad = style({
  width: 64,
  height: 64,
  background: `linear-gradient(${t.hardware}, ${t.hardware}) center / 20px 64px no-repeat, linear-gradient(${t.hardware}, ${t.hardware}) center / 64px 20px no-repeat`,
});
export const iconBtns = style({ display: "flex", gap: 12 });
export const iconBtn = style({
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: t.purple,
});
export const iconBtnOffset = style({ transform: "translateY(10px)" });

export const exportSheet = style({
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: `linear-gradient(180deg, ${t.shellHi}, ${t.shell} 12%, ${t.shell} 82%, ${t.shellDeep})`,
});
export const exportBezel = style({
  width: "min(100%, 420px)",
  aspectRatio: "1 / 1",
  padding: 14,
  borderRadius: "12px 12px 28px 12px",
  background: t.bezel,
  boxShadow: "inset 0 2px 0 rgb(255 255 255 / 8%), 0 8px 0 rgb(0 0 0 / 18%)",
});
export const exportGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
  gridTemplateRows: "repeat(16, minmax(0, 1fr))",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  border: `3px solid ${t.bezelEdge}`,
  background: `repeating-conic-gradient(${t.screenLite} 0% 25%, ${t.screenMid} 0% 50%) 0 0 / 12.5% 12.5%`,
});
