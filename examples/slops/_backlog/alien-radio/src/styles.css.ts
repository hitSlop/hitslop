import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { fontFamily: t.font, color: t.ink, background: "transparent", fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", height: "100%", margin: 0, overflow: "hidden", background: "transparent" });
globalStyle("button, input", { font: "inherit", color: "inherit" });
globalStyle("button:focus-visible, input:focus-visible, [data-slider-thumb]:focus-visible, [data-popover-trigger]:focus-visible, [data-toggle-root]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.lime}`,
  outlineOffset: 2,
});

export const radio = style({ position: "relative", width: 720, height: 560, overflow: "hidden", isolation: "isolate" });
export const chrome = style({ position: "absolute", inset: 0, zIndex: 0, width: "100%", height: "100%", pointerEvents: "none", userSelect: "none" });

export const identity = style({
  position: "absolute",
  zIndex: 2,
  top: 95,
  left: 241,
  width: 238,
  display: "grid",
  gridTemplateColumns: "10px 1fr",
  columnGap: 7,
  alignItems: "center",
  color: t.plate,
  textShadow: "0 1px rgba(244,255,204,.45)",
});
export const lamp = style({
  gridRow: "1 / 3",
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#46530f",
  boxShadow: "inset 0 0 0 2px #232807",
  selectors: {
    "&[data-online='true']": { background: t.violetBright, boxShadow: "0 0 8px #853cff, inset 0 0 0 2px #e6d0ff" },
  },
});
globalStyle(`${identity} strong`, { font: `18px/1 ${t.displayFont}`, letterSpacing: ".13em" });
globalStyle(`${identity} small`, { marginTop: 3, fontSize: 7, fontWeight: 700, letterSpacing: ".16em" });

export const display = style({
  position: "absolute",
  zIndex: 2,
  top: 153,
  left: 207,
  width: 306,
  height: 155,
  padding: "9px 13px 11px",
  overflow: "hidden",
  color: t.lime,
  background: "radial-gradient(circle at 50% 120%, #293d0a 0, #0a0d07 52%, #050505 100%)",
  borderRadius: 8,
  boxShadow: "inset 0 0 24px #000, inset 0 0 0 1px #536b20",
});
globalStyle(`${display}::after`, {
  content: "",
  position: "absolute",
  inset: 0,
  zIndex: 8,
  pointerEvents: "none",
  opacity: 0.16,
  background: "repeating-linear-gradient(to bottom, transparent 0 2px, #dfff8b 3px)",
  mixBlendMode: "screen",
});
export const topline = style({ display: "flex", justifyContent: "space-between", gap: 8, color: "#9a72cc", fontSize: 7, fontWeight: 700, letterSpacing: ".13em" });
globalStyle(`${topline} span:first-child`, { color: t.lime });
export const station = style({
  position: "relative",
  display: "block",
  width: "100%",
  margin: "8px 0 0",
  padding: "0 43px 0 0",
  border: 0,
  textAlign: "left",
  background: "none",
  cursor: "pointer",
});
globalStyle(`${station} span`, { display: "block", color: t.limeDim, fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".17em" });
globalStyle(`${station} strong`, { display: "block", maxWidth: 230, marginTop: 1, overflow: "hidden", color: t.limeSoft, fontSize: 18, lineHeight: 1.05, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(`${station} i`, { position: "absolute", top: 11, right: 0, color: t.violet, fontSize: 7, fontStyle: "normal", fontWeight: 700 });
export const track = style({ margin: "5px 0 0", overflow: "hidden", color: "#9caf7e", fontSize: 9, lineHeight: 1, textOverflow: "ellipsis", whiteSpace: "nowrap" });
export const spectrum = style({ position: "absolute", right: 13, bottom: 10, left: 13, width: "calc(100% - 26px)", height: 31, opacity: 0.82 });

export const browser = style({
  position: "absolute",
  inset: 0,
  zIndex: 6,
  padding: "10px 12px",
  overflow: "hidden",
  color: t.lime,
  background: `color-mix(in srgb, ${t.screen} 96%, black)`,
  selectors: {
    "&[data-popover-content]": { pointerEvents: "auto" },
  },
});
globalStyle(`${browser} label span`, { display: "block", marginBottom: 4, color: t.violet, fontSize: 7, fontWeight: 700, letterSpacing: ".16em" });
globalStyle(`${browser} input`, {
  width: "100%",
  height: 25,
  padding: "0 8px",
  border: `1px solid ${t.limeDim}`,
  outline: "none",
  color: t.limeSoft,
  background: t.screen,
  fontSize: 10,
});
export const channels = style({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 5px", marginTop: 6 });
export const channel = style({
  minWidth: 0,
  padding: "4px 5px",
  overflow: "hidden",
  border: 0,
  textAlign: "left",
  background: "transparent",
  cursor: "pointer",
  selectors: {
    "&:hover": { background: "#28350f" },
    "&[data-selected='true']": { background: "#28350f" },
  },
});
globalStyle(`${channel} strong, ${channel} span`, { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(`${channel} strong`, { fontSize: 9 });
globalStyle(`${channel} span`, { color: "#75815e", fontSize: 7 });
globalStyle(`${channels} p`, { margin: "10px 4px", color: "#8b9875", fontSize: 9 });

export const transport = style({ position: "absolute", zIndex: 2, top: 351, left: 270, display: "flex", alignItems: "center", gap: 11 });
export const round = style({
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  padding: 0,
  border: 0,
  borderRadius: "50%",
  color: "#d8ff6c",
  background: "linear-gradient(#393837, #111)",
  boxShadow: "inset 0 1px #706f69, 0 3px 5px rgba(21,21,8,.35)",
  fontSize: 11,
  cursor: "pointer",
  selectors: { "&:disabled": { opacity: 0.72 } },
});
export const play = style({
  width: 54,
  height: 54,
  color: "#171708",
  background: "radial-gradient(circle at 38% 30%, #f3ffd1 0 8%, #caff42 30%, #789c16 73%, #273207 100%)",
  boxShadow: "inset 0 0 0 4px #252517, inset 0 0 0 6px #a9d72d, 0 5px 8px rgba(21,21,8,.45)",
  fontSize: 18,
});
export const favorite = style({
  width: 27,
  height: 27,
  marginLeft: 3,
  padding: 0,
  border: 0,
  borderRadius: "50%",
  color: "#4e4425",
  background: "#1b1a16",
  boxShadow: "inset 0 0 0 2px #5e641f",
  cursor: "pointer",
  selectors: {
    "&[data-state='on']": { color: "#f1d56d", textShadow: "0 0 6px #ffd036" },
  },
});

export const gain = style({
  position: "absolute",
  zIndex: 2,
  top: 447,
  left: 296,
  width: 128,
  display: "grid",
  gridTemplateColumns: "31px 1fr 22px",
  alignItems: "center",
  gap: 6,
  color: "#bfff39",
  fontSize: 7,
  fontWeight: 700,
});
globalStyle(`${gain} > button`, { padding: 0, border: 0, color: "inherit", background: "none", cursor: "pointer" });
export const slider = style({ position: "relative", display: "flex", alignItems: "center", width: "100%", height: 15, touchAction: "none", userSelect: "none" });
export const sliderTrack = style({ position: "relative", width: "100%", height: 5, background: "#10120b", boxShadow: "inset 0 0 0 1px #586617" });
export const sliderRange = style({ position: "absolute", height: "100%", background: "#586617" });
export const sliderThumb = style({
  display: "block",
  width: 8,
  height: 15,
  border: "1px solid #16160d",
  borderRadius: 1,
  background: t.lime,
  boxShadow: "0 0 4px rgba(202,255,66,.55)",
  cursor: "grab",
});
globalStyle(`${gain} output`, { color: "#342b3f", textAlign: "right" });

export const error = style({
  position: "absolute",
  top: 315,
  left: 213,
  zIndex: 5,
  width: 294,
  padding: "5px 7px",
  border: "1px solid #6e264c",
  color: "#ffd6e9",
  background: "#381124",
  fontSize: 8,
  cursor: "pointer",
});
globalStyle(`${error} strong`, { float: "right", color: t.lime });
export const soma = style({
  position: "absolute",
  zIndex: 2,
  top: 322,
  left: 246,
  width: 228,
  color: "#27320a",
  fontSize: 7,
  fontWeight: 700,
  letterSpacing: ".03em",
  textAlign: "center",
  textDecoration: "none",
});

globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important", animationDuration: "0s !important" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconTile = style({
  display: "grid",
  placeItems: "center",
  width: 464,
  height: 464,
  border: "14px solid #28291f",
  borderRadius: 88,
  background: "radial-gradient(circle at 50% 18%, #dfff8b, #789c16 42%, #242807 76%)",
  boxShadow: `inset 0 0 0 8px ${t.violet}`,
});
export const iconScreen = style({
  position: "relative",
  display: "flex",
  alignItems: "end",
  gap: 18,
  width: 338,
  height: 246,
  padding: "50px 42px 42px",
  border: `12px solid ${t.plate}`,
  borderRadius: 34,
  background: "#090c06",
  boxShadow: "inset 0 0 28px #000",
});
globalStyle(`${iconScreen} i`, { width: 32, borderRadius: "5px 5px 0 0", background: t.lime, boxShadow: "0 0 12px #789c16" });
globalStyle(`${iconScreen} i:nth-child(1)`, { height: 58 });
globalStyle(`${iconScreen} i:nth-child(2)`, { height: 112 });
globalStyle(`${iconScreen} i:nth-child(3)`, { height: 154 });
globalStyle(`${iconScreen} i:nth-child(4)`, { height: 92 });
globalStyle(`${iconScreen} i:nth-child(5)`, { height: 132 });
globalStyle(`${iconScreen} span`, { position: "absolute", top: 22, right: 28, color: t.violet, fontSize: 36 });
