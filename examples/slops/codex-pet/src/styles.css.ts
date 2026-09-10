import { globalStyle, style } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;

globalStyle("*", { boxSizing: "border-box" });
globalStyle(":root", { color: t.ink, background: "transparent", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("html, body, #app", { width: "100%", height: "100%", margin: 0, overflow: "hidden", background: "transparent" });
globalStyle("button", { font: "inherit" });
globalStyle("button:focus-visible, [data-tooltip-trigger]:focus-visible, [data-button-root]:focus-visible", {
  outline: `2px solid ${t.accent}`,
  outlineOffset: 2,
});

export const shell = style({ position: "relative", width: 240, height: 180, overflow: "hidden", background: "transparent" });
export const pet = style({
  position: "absolute",
  top: 5,
  left: 72,
  width: 96,
  height: 104,
  border: 0,
  padding: 0,
  background: "transparent",
  cursor: "grab",
  touchAction: "none",
  imageRendering: "pixelated",
  userSelect: "none",
  filter: "drop-shadow(0 9px 7px rgba(41, 25, 18, .24))",
  transition: "filter 140ms ease, transform 140ms ease",
  selectors: {
    "&:hover": { filter: "drop-shadow(0 11px 8px rgba(41, 25, 18, .3))", transform: "translateY(-2px)" },
    "&:active": { cursor: "grabbing", transform: "translateY(1px) scale(.985)" },
    "&[data-still='true']": { transition: "none" },
  },
});
globalStyle(`${pet} canvas`, { display: "block", width: 96, height: 104, pointerEvents: "none" });

export const rail = style({
  position: "absolute",
  right: 8,
  bottom: 25,
  left: 8,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.25fr) max-content max-content",
  alignItems: "center",
  gap: 6,
  minHeight: 34,
  padding: "5px 6px 5px 10px",
  border: "1px solid rgba(255,255,255,.16)",
  borderRadius: 18,
  color: "#f9eee2",
  background: t.rail,
  boxShadow: "0 7px 20px rgba(35, 22, 16, .2)",
  backdropFilter: "blur(14px)",
  opacity: 0,
  transform: "translateY(5px)",
  transition: "opacity 140ms ease, transform 140ms ease",
  pointerEvents: "none",
  selectors: {
    [`${shell}:hover &`]: { opacity: 1, transform: "none", pointerEvents: "auto" },
    "&:focus-within": { opacity: 1, transform: "none", pointerEvents: "auto" },
  },
});
globalStyle(`${rail} span, ${rail} small`, { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(`${rail} span`, { fontSize: 10, fontWeight: 780 });
globalStyle(`${rail} small`, { color: t.muted, fontSize: 8 });

const chip = {
  minWidth: 30,
  height: 23,
  border: 0,
  borderRadius: 12,
  padding: "0 7px",
  cursor: "pointer",
  fontSize: 7,
  fontWeight: 850,
  letterSpacing: ".04em",
  selectors: { "&:disabled": { opacity: 0.55, cursor: "wait" } },
} as const;
export const zip = style({ ...chip, color: t.plate, background: t.accent });
export const bubu = style({ ...chip, color: t.ink, background: t.plate });
export const tooltip = style({
  zIndex: 50,
  maxWidth: 160,
  padding: "4px 7px",
  border: `1px solid ${t.accent}`,
  borderRadius: 10,
  color: t.ink,
  background: t.rail,
  boxShadow: "0 7px 18px rgba(35, 22, 16, .22)",
  backdropFilter: "blur(14px)",
  fontSize: 9,
  fontWeight: 720,
  lineHeight: 1.3,
});

export const market = style({
  position: "absolute",
  bottom: 4,
  left: "50%",
  width: "max-content",
  border: "1px solid rgba(76, 51, 41, .1)",
  borderRadius: 999,
  padding: "2px 7px",
  color: "#5a3e34",
  background: "rgba(255, 247, 235, .8)",
  boxShadow: "0 2px 8px rgba(47, 29, 22, .1)",
  backdropFilter: "blur(8px)",
  fontSize: 10,
  fontWeight: 720,
  letterSpacing: ".015em",
  textAlign: "center",
  textDecoration: "none",
  transform: "translateX(-50%)",
});
export const fileInput = style({ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none" });
export const drop = style({
  position: "absolute",
  inset: 6,
  display: "grid",
  placeItems: "center",
  border: "2px dashed rgba(255, 210, 129, .9)",
  borderRadius: 24,
  color: "#ffe2aa",
  background: "rgba(38, 27, 23, .78)",
  backdropFilter: "blur(8px)",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: ".14em",
});
export const error = style({
  position: "absolute",
  right: 14,
  bottom: 64,
  left: 14,
  maxHeight: 58,
  overflow: "hidden",
  border: "1px solid rgba(255, 183, 164, .4)",
  borderRadius: 10,
  padding: "7px 9px",
  color: "#ffe9e2",
  background: "rgba(87, 32, 27, .9)",
  boxShadow: "0 7px 18px rgba(45, 18, 15, .18)",
  cursor: "pointer",
  fontSize: 8,
  lineHeight: 1.35,
  textAlign: "left",
});

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle("*, *::before, *::after", {
  "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0s !important" } },
});

export const iconSurface = style({ display: "grid", width: "100%", height: "100%", placeItems: "center", background: "transparent" });
export const iconCanvas = style({ width: 512, height: 512 });
