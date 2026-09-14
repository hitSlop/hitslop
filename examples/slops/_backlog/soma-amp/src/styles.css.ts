import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { color: t.ink, background: t.surface, fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", height: "100%", margin: 0, overflow: "hidden", background: t.surface });
globalStyle("button", { font: "inherit" });

export const amp = style({
  containerType: "inline-size",
  width: 275,
  height: 438,
  overflow: "hidden",
  background: t.surface,
  selectors: { "&[data-milkdrop='true']": { width: 725 } },
});
export const player = style({ position: "relative", width: "100%", height: 406, overflow: "hidden", background: "#000" });
export const stage = style({ position: "relative", width: "100%", height: 406, overflow: "hidden" });
export const drop = style({
  position: "absolute",
  inset: 18,
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  border: `2px dashed ${t.accent}`,
  color: "#d8ffe6",
  background: "rgba(3, 14, 8, .9)",
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: ".1em",
  textShadow: `0 0 12px ${t.accent}`,
});
globalStyle(`${amp}[data-drag='true'] .${player}`, { outline: `2px solid ${t.accent}`, outlineOffset: -2 });

export const rail = style({
  display: "grid",
  gridTemplateColumns: "max-content minmax(0, 1fr) max-content",
  alignItems: "center",
  gap: 12,
  width: "100%",
  height: 32,
  padding: "0 9px",
  borderTop: `1px solid ${t.border}`,
  color: t.muted,
  background: t.panel,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: ".055em",
});
globalStyle(`${rail} a`, { color: "#8d999f", textDecoration: "none" });
export const status = style({
  overflow: "hidden",
  color: t.accent,
  textAlign: "center",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  selectors: { "&[data-error='true']": { color: t.danger } },
});
export const actions = style({ display: "flex", alignItems: "center", gap: 5 });
globalStyle(`${actions} a`, { color: t.accent, fontSize: 8, whiteSpace: "nowrap" });
export const action = style({
  height: 20,
  padding: "0 6px",
  border: `1px solid ${t.border}`,
  borderRadius: 1,
  color: t.ink,
  background: t.surface,
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: ".04em",
  cursor: "pointer",
  selectors: {
    "&:disabled, &[data-disabled]": { opacity: 0.45, cursor: "wait" },
    '&[data-state="on"]': { borderColor: t.accent, color: t.accent, background: t.panel },
    "&:focus-visible": { outline: `1px solid ${t.accent}`, outlineOffset: 1 },
  },
});
export const compact = style({ display: "none" });
export const wide = style({ display: "inline" });

globalStyle("#webamp", { top: "0 !important", left: "0 !important" });
globalStyle("#webamp .window", { imageRendering: "pixelated" });
globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle("html[data-slop-capture='static'] #webamp *", { animation: "none !important" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important" } },
});

export const facsimile = style({ width: 275, height: 406, overflow: "hidden", background: "#050607" });
export const stack = style({ width: 550, height: 812, overflow: "hidden", color: "#b9c1c6", background: "#050607", transform: "scale(.5)", transformOrigin: "top left" });
export const panel = style({ position: "relative", border: "4px ridge #333b41", background: "#111519", boxShadow: "inset 0 0 0 2px #050607" });
export const title = style({ display: "grid", gridTemplateColumns: "1fr max-content 1fr", alignItems: "center", gap: 12, height: 34, padding: "0 12px", color: "#d9dfe2", fontSize: 13, letterSpacing: ".08em" });
globalStyle(`${title} i`, { height: 4, borderBlock: "1px solid #7b858b", background: "#242c31" });
export const mainPanel = style({ height: 232 });
export const readout = style({ position: "absolute", top: 42, left: 16, right: 16, height: 84, border: "3px inset #242d32", color: "#2ee97b", background: "#070b0d" });
globalStyle(`${readout} b`, { position: "absolute", top: 19, left: 20, fontSize: 38 });
globalStyle(`${readout} span`, { position: "absolute", top: 16, left: 82, fontSize: 18, letterSpacing: ".06em" });
globalStyle(`${readout} em`, { position: "absolute", right: 16, bottom: 10, color: "#8a959a", fontSize: 11, fontStyle: "normal" });
export const controls = style({ position: "absolute", left: 30, right: 30, bottom: 18, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 });
globalStyle(`${controls} button`, { height: 44, border: "3px outset #65727a", color: "#dbe2e5", background: "#3a444b", fontSize: 22 });
export const eq = style({ height: 232 });
export const eqHead = style({ display: "flex", justifyContent: "space-between", padding: "6px 26px", color: "#25e978", fontSize: 15 });
globalStyle(`${eqHead} b, ${eqHead} span`, { border: "2px outset #58636a", padding: "2px 9px", background: "#252d32" });
export const sliders = style({ display: "flex", justifyContent: "space-between", height: 136, margin: "3px 36px 0" });
globalStyle(`${sliders} i`, { position: "relative", width: 6, height: 122, background: "#050708", boxShadow: "inset 0 0 0 1px #30383d" });
globalStyle(`${sliders} i::after`, { content: "", position: "absolute", top: "var(--top)", left: -8, width: 22, height: 14, border: "2px outset #647179", background: "#30383d" });
export const playlist = style({ height: 348 });
globalStyle(`${playlist} ol`, { height: 246, margin: "0 12px", padding: "11px 11px 8px 38px", border: "3px inset #263036", overflow: "hidden", color: "#41ed80", background: "#050708", font: "18px/1.45 Arial, sans-serif" });
export const playlistControls = style({ position: "absolute", right: 18, bottom: 11, left: 18, display: "flex", alignItems: "center", gap: 10 });
globalStyle(`${playlistControls} b`, { border: "2px outset #657179", padding: "6px 10px", background: "#303a40", fontSize: 11 });
globalStyle(`${playlistControls} span`, { marginLeft: "auto", color: "#40e97d", fontSize: 16 });

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center" });
export const iconScreen = style({
  position: "relative",
  display: "flex",
  alignItems: "end",
  justifyContent: "center",
  gap: 11,
  width: 392,
  height: 300,
  padding: "72px 44px 45px",
  border: "18px solid #303940",
  borderRadius: 54,
  color: t.accent,
  background: t.surface,
  boxShadow: "inset 0 0 0 7px #151b1e, 0 22px 32px rgba(0,0,0,.28)",
});
globalStyle(`${iconScreen} span`, { position: "absolute", top: 43, left: 52, fontSize: 72, lineHeight: 1 });
globalStyle(`${iconScreen} i`, { width: 35, background: t.accent });
globalStyle(`${iconScreen} i:nth-of-type(1)`, { height: 62 });
globalStyle(`${iconScreen} i:nth-of-type(2)`, { height: 106 });
globalStyle(`${iconScreen} i:nth-of-type(3)`, { height: 152 });
globalStyle(`${iconScreen} i:nth-of-type(4)`, { height: 121 });
globalStyle(`${iconScreen} i:nth-of-type(5)`, { height: 82 });
