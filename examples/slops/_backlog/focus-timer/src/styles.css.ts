import { globalStyle } from "@vanilla-extract/css";
import { theme as t } from "./theme-contract.css";

globalStyle(":root", { colorScheme: "light", fontFamily: t.font, fontSynthesis: "none" });
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", { width: "100%", height: "100%", margin: 0 });
globalStyle("body", { color: t.panel, background: "transparent" });
globalStyle("button", { font: "inherit", color: "inherit", cursor: "pointer" });
globalStyle("button:focus-visible", { outline: `3px solid ${t.focus}`, outlineOffset: 2 });

globalStyle(".tomato-timer", {
  position: "relative", display: "grid", gridTemplateRows: "minmax(0, 1fr) auto",
  width: "100%", height: "100%", overflow: "hidden", padding: "43px 58px 48px",
  color: t.ink, background: `radial-gradient(circle at 28% 23%, #ffffff4a 0 3px, transparent 4px), radial-gradient(circle at 28% 23%, #ffffff29 0 30px, transparent 31px), radial-gradient(circle at 77% 10%, #fff4d924 0 98px, transparent 99px), ${t.surface}`,
  fontVariantNumeric: "tabular-nums", containerType: "inline-size",
});
globalStyle('.tomato-timer[data-kind="rest"]', { background: `radial-gradient(circle at 28% 23%, #ffffff4a 0 3px, transparent 4px), radial-gradient(circle at 28% 23%, #ffffff29 0 30px, transparent 31px), ${t.surfaceRest}` });
globalStyle('.tomato-timer[data-kind="rest"] .dial-progress', { stroke: t.restAccent });
globalStyle('.tomato-timer[data-kind="rest"] .run-button', { background: t.restAccent, color: t.panel });

globalStyle(".leaf-mark", { position: "absolute", zIndex: 2, top: 29, left: "50%", width: 43, height: 34, transform: "translateX(-50%)" });
globalStyle(".leaf-mark i, .icon-leaf i", { position: "absolute", width: 22, height: 33, borderRadius: "100% 0 100% 0", background: t.restAccent, transformOrigin: "bottom center" });
globalStyle(".leaf-mark i:nth-child(1), .icon-leaf i:nth-child(1)", { left: 11, transform: "rotate(-2deg)" });
globalStyle(".leaf-mark i:nth-child(2), .icon-leaf i:nth-child(2)", { left: 0, transform: "rotate(-45deg) scale(.82)" });
globalStyle(".leaf-mark i:nth-child(3), .icon-leaf i:nth-child(3)", { right: 0, transform: "rotate(43deg) scale(.82)" });
globalStyle(".completed-count", { position: "absolute", zIndex: 2, bottom: 23, left: "50%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 39, height: 25, border: `2px solid ${t.ink}`, borderRadius: 999, padding: "0 7px", color: t.ink, background: t.panel, boxShadow: "2px 3px 0 #352a2933", transform: "translateX(-50%)", fontSize: 10, fontWeight: 900 });
globalStyle(".completed-count span", { fontSize: 11, lineHeight: 1 });

globalStyle(".timer-stage", { display: "grid", gridTemplateRows: "1fr auto auto", justifyItems: "center", minHeight: 0 });
globalStyle(".dial-wrap", { position: "relative", alignSelf: "center", width: "min(216px, 61cqw)", aspectRatio: "1", marginTop: 15, border: `8px solid ${t.ink}`, borderRadius: "50%", background: t.panel, boxShadow: "7px 9px 0 #352a2933" });
globalStyle(".timer-dial", { display: "block", width: "100%", height: "100%", padding: 14, overflow: "visible" });
globalStyle(".timer-dial line", { stroke: "#352a296e", strokeWidth: .55 });
globalStyle(".dial-track, .dial-progress", { fill: "none", strokeWidth: 4 });
globalStyle(".dial-track", { stroke: "#352a291f" });
globalStyle(".dial-progress", { stroke: t.accent, strokeLinecap: "round", transition: "stroke-dashoffset 500ms linear" });
globalStyle(".timer-readout", { position: "absolute", inset: 0, display: "grid", placeContent: "center", color: t.ink, textAlign: "center" });
globalStyle(".timer-readout strong", { fontFamily: '"SF Pro Rounded", "Avenir Next", sans-serif', fontSize: "clamp(3rem, 14cqw, 4.4rem)", fontWeight: 900, lineHeight: .82, letterSpacing: "-.1em" });
globalStyle(".timer-readout small", { marginTop: 7, color: "#352a299e", fontSize: 7, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" });

globalStyle(".mode-switch", { display: "flex", gap: 4, justifyContent: "center", margin: "0 0 9px" });
globalStyle(".mode-switch [data-tabs-trigger]", { border: "2px solid #352a296b", borderRadius: 999, padding: "5px 9px", color: t.ink, background: "#fff4d93d", fontSize: 8, fontWeight: 900, letterSpacing: ".05em", textTransform: "uppercase" });
globalStyle(".mode-switch [data-tabs-trigger] span", { marginLeft: 3, opacity: .62 });
globalStyle('.mode-switch [data-tabs-trigger][data-state="active"]', { borderColor: t.ink, background: t.panel, boxShadow: "2px 2px 0 #352a2933" });
globalStyle(".mode-switch [data-tabs-trigger]:disabled", { cursor: "default", opacity: .55 });
globalStyle(".run-control", { display: "flex", alignItems: "center", gap: 8, marginBottom: 31 });
globalStyle(".run-button", { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minWidth: 111, height: 39, border: `3px solid ${t.ink}`, borderRadius: 999, color: t.ink, background: t.action, boxShadow: "3px 4px 0 #352a2938", fontSize: 10, fontWeight: 950, letterSpacing: ".07em", textTransform: "uppercase" });
globalStyle(".run-button:active", { transform: "translate(2px, 3px)", boxShadow: "1px 1px 0 #352a2938" });
globalStyle(".run-button svg", { width: 15 });
globalStyle(".reset-button", { display: "grid", placeItems: "center", width: 38, height: 38, border: "2px solid #352a297a", borderRadius: "50%", padding: 0, color: t.ink, background: "#fff4d933" });
globalStyle(".reset-button svg", { width: 15 });
globalStyle(".timer-error", { position: "absolute", right: 40, bottom: 14, left: 40, margin: 0, color: "#7b2630", fontSize: 8, textAlign: "center" });

globalStyle('[data-slop-render="icon"]', { display: "none !important", width: 512, height: 512, placeItems: "center", overflow: "hidden", background: "transparent" });
globalStyle('html[data-slop-renderer="true"][data-slop-capture="icon"] .tomato-timer', { display: "none" });
globalStyle('html[data-slop-renderer="true"][data-slop-capture="icon"] [data-slop-render="icon"]', { display: "grid !important" });
globalStyle(".timer-icon", { position: "relative", display: "grid", placeItems: "center", width: 464, height: 464, overflow: "hidden", border: `18px solid ${t.ink}`, borderRadius: "50%", background: t.surface, boxShadow: `inset 0 0 0 16px ${t.surfaceLight}` });
globalStyle(".icon-leaf", { position: "absolute", zIndex: 2, top: 27, left: "50%", width: 78, height: 65, transform: "translateX(-50%)" });
globalStyle(".icon-leaf i", { width: 38, height: 57 });
globalStyle(".icon-leaf i:nth-child(1)", { left: 20 });
globalStyle(".timer-icon-ring", { position: "relative", display: "grid", placeItems: "center", width: 294, height: 294, marginTop: 31, border: `25px solid ${t.panel}`, borderRightColor: t.action, borderRadius: "50%", color: t.ink, background: t.panel, transform: "rotate(-22deg)" });
globalStyle(".timer-icon-ring span", { font: '900 105px/.8 "SF Pro Rounded", "Avenir Next", sans-serif', transform: "rotate(22deg)" });
globalStyle(".timer-icon-ring i", { position: "absolute", right: -34, bottom: 12, width: 44, height: 44, border: `8px solid ${t.surface}`, borderRadius: "50%", background: t.action });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle('html[data-slop-capture="static"] .timer-stage', { gridRow: "1 / -1" });
globalStyle('html[data-slop-capture="static"] .dial-wrap', { marginTop: 0 });
globalStyle(".tomato-timer", { "@container": { "(max-width: 360px)": { paddingInline: 46 } } });
globalStyle(".dial-wrap", { "@container": { "(max-width: 360px)": { width: 190 } } });
globalStyle("*, *::before, *::after", { "@media": { "(prefers-reduced-motion: reduce)": { animationDuration: ".01ms !important", transitionDuration: ".01ms !important" } } });
