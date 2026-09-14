import { globalStyle } from "@vanilla-extract/css";
import theme from "../theme";

const t = theme.vars;
const metal = "#382f2a";
const recess = "#29241f";
const dark = "#110e0c";

globalStyle(":root", { colorScheme: "dark", fontFamily: t.bodyFont, fontSynthesis: "none" });
globalStyle("*, *::before, *::after", { boxSizing: "border-box" });
globalStyle("html, body, #app", { width: "100%", height: "100%", margin: 0 });
globalStyle("body", { color: t.ink, background: "transparent", userSelect: "none", WebkitUserSelect: "none" });
globalStyle("button, input", { color: "inherit", font: "inherit" });
globalStyle("button", { border: 0, padding: 0, background: "transparent", cursor: "pointer" });
globalStyle(":focus-visible", { outline: `2px solid ${t.focus}`, outlineOffset: 1 });

globalStyle(".metronome-shell", {
  display: "grid", gridTemplateRows: "auto auto minmax(120px, 1fr) auto", containerType: "inline-size",
  width: "100%", height: "100%", overflow: "hidden", padding: "12px 14px 14px", border: `2px solid ${metal}`,
  background: `radial-gradient(circle at 50% 18%, rgb(212 163 55 / 14%), transparent 58%), linear-gradient(180deg, ${t.chassisHi} 0%, ${t.chassis} 14%, ${t.chassis} 88%, ${t.chassisRim} 100%)`,
  fontVariantNumeric: "tabular-nums",
});
globalStyle(".chassis-head", { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px 4px" });
globalStyle(".chassis-head p", { margin: 0, color: t.brass, fontSize: 11, fontWeight: 800, letterSpacing: ".18em" });
globalStyle(".screw", { width: 9, height: 9, borderRadius: "50%", background: "radial-gradient(circle, #a17c2f 0%, #594112 80%)", boxShadow: "inset 0 1px 1px rgb(0 0 0 / 60%)" });

globalStyle(".display-card", { display: "grid", justifyItems: "center", gap: 4, padding: "10px 14px 8px", border: `2px solid ${recess}`, borderRadius: 12, background: t.screen, boxShadow: "inset 0 2px 6px rgb(0 0 0 / 80%)" });
globalStyle(".display-readout", { display: "flex", alignItems: "baseline", gap: 8 });
globalStyle(".bpm-digits", { fontSize: "3rem", fontWeight: 800, lineHeight: .9, letterSpacing: "-.05em", textShadow: "0 0 14px rgb(245 158 11 / 40%)" });
globalStyle(".bpm-unit", { color: t.brass, fontSize: 12, fontWeight: 800, letterSpacing: ".12em" });
globalStyle(".tempo-descriptor", { margin: 0, color: t.inkMuted, fontSize: 11, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase" });
globalStyle(".beat-lights", { display: "flex", gap: 8, marginTop: 6 });
globalStyle(".beat-dot", { width: 10, height: 10, border: "1px solid #3d342d", borderRadius: "50%", background: "#26211c" });
globalStyle(".beat-dot.active", { background: t.glow, boxShadow: `0 0 8px ${t.glow}`, transform: "scale(1.12)" });
globalStyle(".beat-dot.active.accent", { background: t.glowAccent, boxShadow: `0 0 10px ${t.glowAccent}` });

globalStyle(".pendulum-chamber", { position: "relative", display: "grid", placeItems: "center", minHeight: 0, margin: "10px 0", overflow: "hidden", border: "2px solid #29231e", borderRadius: 10, background: dark, boxShadow: "inset 0 3px 8px rgb(0 0 0 / 90%)" });
globalStyle(".scale-grooves", { position: "absolute", inset: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", color: t.brass, opacity: .35, fontSize: 10, fontWeight: 800 });
globalStyle(".pendulum-arm", { position: "absolute", bottom: -4, display: "flex", flexDirection: "column", alignItems: "center", width: 8, height: "92%", transformOrigin: "50% 100%" });
globalStyle(".brass-rod", { width: 4, height: "100%", borderRadius: 2, background: `linear-gradient(90deg, #caa343, ${t.brassHi}, #8c6a21)` });
globalStyle(".brass-weight", { position: "absolute", bottom: "var(--weight, 36%)", display: "grid", placeItems: "center", width: 26, height: 18, border: "1px solid #755513", borderRadius: 4, background: `linear-gradient(180deg, ${t.brassHi}, ${t.brass} 40%, ${t.brassShadow})` });
globalStyle(".brass-weight i", { width: "80%", height: 4, background: "repeating-linear-gradient(90deg, #594112 0 1px, transparent 1px 3px)" });
globalStyle(".pendulum-pivot", { position: "absolute", bottom: 0, width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle, #e6c56c, #825f18 90%)" });

globalStyle(".controls-panel", { display: "grid", gap: 10 });
globalStyle(".preset-row", { display: "flex", flexWrap: "wrap", gap: 6 });
globalStyle(".preset-btn, .preset-save, .nudge-btn, .sig-btn, .mute-toggle", { border: "1px solid #453b34", borderRadius: 6, background: "#2b2520", color: t.ink, fontSize: 11, fontWeight: 800 });
globalStyle(".preset-btn, .preset-save, .nudge-btn", { minWidth: 26, padding: "5px 6px", textAlign: "center" });
globalStyle(".preset-btn.selected", { borderColor: t.brass, background: t.brass, color: dark });
globalStyle(".preset-save", { color: t.brass });
globalStyle(".tempo-nudge-row", { display: "flex", alignItems: "center", gap: 4 });
globalStyle(".bpm-slider-root, .volume-slider-root", { position: "relative", display: "flex", alignItems: "center", flex: 1, height: 20, touchAction: "none", userSelect: "none" });
globalStyle(".bpm-slider-root", { minWidth: 60 });
globalStyle(".volume-slider-root", { minWidth: 40 });
globalStyle(".bpm-slider-track, .volume-slider-track", { position: "relative", width: "100%", overflow: "hidden", background: "#251e19" });
globalStyle(".bpm-slider-track", { height: 6, borderRadius: 3 });
globalStyle(".volume-slider-track", { height: 4, borderRadius: 2 });
globalStyle(".bpm-slider-range, .volume-slider-range", { position: "absolute", height: "100%", background: t.brass });
globalStyle(".bpm-slider-thumb, .volume-slider-thumb", { display: "block", borderRadius: "50%", background: t.brass, cursor: "grab", outline: "none" });
globalStyle(".bpm-slider-thumb", { width: 14, height: 14, boxShadow: "0 1px 3px rgb(0 0 0 / 70%)" });
globalStyle(".volume-slider-thumb", { width: 10, height: 10 });
globalStyle(".bpm-slider-thumb:focus-visible, .volume-slider-thumb:focus-visible", { boxShadow: `0 0 0 2px ${t.brassHi}` });
globalStyle(".settings-row", { display: "flex", alignItems: "center", gap: 6 });
globalStyle(".time-sig-selector", { display: "flex", gap: 3 });
globalStyle(".sig-btn", { padding: "4px 6px", color: t.inkMuted });
globalStyle('.sig-btn[data-state="checked"]', { borderColor: t.brass, background: "#3a2f26", color: t.brass });
globalStyle(".volume-field", { display: "flex", alignItems: "center", flex: 1, minWidth: 0, gap: 5, color: t.brass });
globalStyle(".mute-toggle", { padding: "5px 6px", fontSize: 10, letterSpacing: ".06em" });
globalStyle('.mute-toggle[data-state="on"]', { color: t.glowAccent });

globalStyle(".primary-actions", { display: "grid", gridTemplateColumns: "1fr 70px", gap: 8 });
globalStyle(".tap-tempo-btn", { display: "grid", justifyItems: "center", gap: 1, padding: "8px 10px", border: "2px solid #4a3e35", borderRadius: 10, background: "#2e2621", boxShadow: "0 3px 0 #181412" });
globalStyle(".tap-tempo-btn span, .tap-tempo-btn em", { fontSize: 10, fontWeight: 800, letterSpacing: ".12em", fontStyle: "normal", opacity: .75, textTransform: "uppercase" });
globalStyle(".tap-tempo-btn strong", { fontSize: 15, fontWeight: 800 });
globalStyle(".tap-tempo-btn.tap-active", { transform: "translateY(2px)", background: t.brass, color: dark, boxShadow: "0 1px 0 #181412" });
globalStyle(".play-toggle-btn", { display: "grid", placeItems: "center", border: "2px solid #5a4b40", borderRadius: 12, background: `linear-gradient(180deg, ${t.brass}, #b8861d)`, color: dark, boxShadow: "0 4px 0 #6e5012" });
globalStyle(".play-toggle-btn.playing", { background: "linear-gradient(180deg, #ef4444, #dc2626)", color: "#fff", boxShadow: "0 4px 0 #7f1d1d" });
globalStyle(".play-icon-offset", { marginLeft: 3 });
globalStyle(".store-error", { position: "absolute", right: 16, bottom: 10, left: 16, margin: 0, color: "#fecaca", fontSize: 12, textAlign: "center" });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle('html[data-slop-capture="static"] .metronome-shell', { gridTemplateRows: "auto auto minmax(160px, 1fr) auto" });
globalStyle(".metronome-icon", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: 390, height: 460, padding: "24px 28px", border: `14px solid ${metal}`, borderRadius: 48, background: `linear-gradient(180deg, ${t.chassisHi}, ${t.chassis})`, boxShadow: "0 16px 36px rgb(0 0 0 / 55%)" });
globalStyle(".icon-top-plate, .icon-controls", { display: "flex", alignItems: "center", justifyContent: "space-between" });
globalStyle(".icon-brand-dot", { width: 12, height: 12, borderRadius: "50%", background: t.brass });
globalStyle(".icon-brand-text, .icon-bpm-lbl", { color: t.brass, fontSize: 11, fontWeight: 800, letterSpacing: ".16em" });
globalStyle(".icon-face", { display: "grid", gap: 12 });
globalStyle(".icon-bpm-card", { display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "10px 18px", border: `4px solid ${recess}`, borderRadius: 16, background: t.screen });
globalStyle(".icon-bpm-num", { fontSize: 48, fontWeight: 800 });
globalStyle(".icon-bpm-lbl", { fontSize: 12 });
globalStyle(".icon-pendulum-chamber", { position: "relative", display: "flex", justifyContent: "center", height: 168, overflow: "hidden", border: `4px solid ${recess}`, borderRadius: 16, background: "#0e0c0a" });
globalStyle(".icon-scale-lines", { position: "absolute", inset: "14px 40px", display: "flex", flexDirection: "column", justifyContent: "space-around" });
globalStyle(".icon-scale-lines i", { height: 1, background: "rgb(212 163 55 / 25%)" });
globalStyle(".icon-rod", { position: "absolute", bottom: 0, display: "flex", justifyContent: "center", width: 6, height: 150, background: t.brass, transformOrigin: "50% 100%", transform: "rotate(18deg)" });
globalStyle(".icon-weight", { position: "absolute", top: 40, width: 32, height: 22, border: "2px solid #594112", borderRadius: 4, background: t.brassHi });
globalStyle(".icon-tap-btn", { padding: "8px 16px", border: "3px solid #4a3e35", borderRadius: 10, background: "#2e2621", fontSize: 13, fontWeight: 800 });
globalStyle(".icon-play-btn", { display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: t.brass, color: dark, fontSize: 18, fontWeight: 800 });
globalStyle(".bpm-digits", { "@container": { "(max-width: 360px)": { fontSize: "2.4rem" } } });
globalStyle(".primary-actions", { "@container": { "(max-width: 360px)": { gridTemplateColumns: "1fr 64px" } } });
globalStyle(".settings-row", { "@container": { "(max-width: 360px)": { flexWrap: "wrap" } } });
globalStyle(".beat-dot.active", { "@media": { "(prefers-reduced-motion: reduce)": { transform: "none" } } });
globalStyle("*, *::before, *::after", { "@media": { "(prefers-reduced-motion: reduce)": { transitionDuration: "0.01ms !important", animationDuration: "0.01ms !important" } } });
