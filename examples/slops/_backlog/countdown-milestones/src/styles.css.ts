import { globalStyle, keyframes } from "@vanilla-extract/css";
import { theme as t } from "./theme-contract.css";

const milestonePop = keyframes({
  "0%": { opacity: 0, transform: "scale(.4)" },
  "35%": { opacity: 1, transform: "scale(2.8)" },
  "100%": { opacity: 0, transform: "scale(4.5)" },
});

const victoryOrbit = keyframes({
  from: { transform: "translate(0, 0) rotate(0deg)" },
  to: { transform: "translate(-22px, 17px) rotate(18deg)" },
});

globalStyle(":root", { colorScheme: "light", fontFamily: t.bodyFont, fontSynthesis: "none" });
globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body, #app", { width: "100%", height: "100%", margin: 0 });
globalStyle("body", { overflow: "hidden", color: t.ink, background: "transparent", WebkitFontSmoothing: "antialiased" });
globalStyle("button, input", { font: "inherit" });
globalStyle("button", { color: "inherit" });
globalStyle("button:focus-visible, input:focus-visible", { outline: `3px solid ${t.focus}`, outlineOffset: 2 });

globalStyle(".count-shell", {
  position: "relative", display: "grid", gridTemplateRows: "34px 236px minmax(0, 1fr) 38px",
  width: "100%", height: "100%", overflow: "hidden", padding: "26px 30px 22px",
  color: t.ink, background: `linear-gradient(90deg, transparent 49.8%, ${t.rule} 49.8% 50.2%, transparent 50.2%), ${t.paper}`,
  fontVariantNumeric: "tabular-nums", containerType: "inline-size",
});
globalStyle(".count-shell::before", {
  content: '""', position: "absolute", inset: "9px", border: `1px solid ${t.rule}`,
  borderRadius: 25, pointerEvents: "none",
});
globalStyle(".orbit", { position: "absolute", zIndex: 0, borderRadius: "50%", pointerEvents: "none" });
globalStyle(".orbit-one", { width: 128, height: 128, right: -52, top: 72, background: t.yellow, border: `1px solid ${t.ink}` });
globalStyle(".orbit-one::after", { content: '""', position: "absolute", width: 28, height: 28, right: -11, top: 19, borderRadius: "50%", background: t.coral, border: `1px solid ${t.ink}` });
globalStyle(".orbit-two", { width: 48, height: 48, left: -24, bottom: 82, background: t.blue, border: `1px solid ${t.ink}` });

globalStyle(".instrument-head", { zIndex: 1, display: "flex", alignItems: "start", justifyContent: "space-between", paddingInline: 13 });
globalStyle(".instrument-head > span", { color: t.coral, fontSize: 9, fontWeight: 850, letterSpacing: ".17em" });
globalStyle(".edit-button", {
  display: "grid", placeItems: "center", width: 30, height: 30, marginTop: -6, border: `1px solid ${t.ink}`,
  borderRadius: "50%", padding: 0, color: t.ink, background: t.paper, cursor: "pointer",
  transition: "transform 180ms cubic-bezier(.22,1,.36,1), background 180ms",
});
globalStyle(".edit-button:hover", { transform: "rotate(-8deg) scale(1.08)", background: t.yellow });
globalStyle(".edit-button:active", { transform: "scale(.94)" });
globalStyle(".edit-button svg", { width: 13, height: 13 });

globalStyle(".count-stage", { position: "relative", zIndex: 1, borderBlock: `1.5px solid ${t.ink}`, padding: "13px 14px 11px" });
globalStyle(".count-stage > p", { margin: 0, color: t.coral, fontSize: 9, fontWeight: 850, letterSpacing: ".16em", textTransform: "uppercase" });
globalStyle(".count-stage h1", {
  width: "77%", margin: "5px 0 0", overflow: "hidden", color: t.ink, fontFamily: t.displayFont,
  fontSize: "clamp(24px, 8cqw, 36px)", fontWeight: 900, lineHeight: .93, letterSpacing: "-.055em", textOverflow: "ellipsis", whiteSpace: "nowrap",
});
globalStyle(".day-readout", { display: "flex", alignItems: "end", gap: 10, marginTop: 7 });
globalStyle(".day-readout strong", {
  color: t.ink, fontFamily: t.displayFont, fontSize: "clamp(82px, 28cqw, 118px)", fontWeight: 900,
  lineHeight: .68, letterSpacing: "-.105em", transform: "translateX(-5px)",
});
globalStyle(".day-readout span", {
  marginBottom: 0, color: t.ink, fontSize: 10, fontWeight: 850, lineHeight: 1.15,
  textTransform: "uppercase", whiteSpace: "pre-line",
});
globalStyle(".support-time", {
  position: "absolute", right: 8, top: 58, display: "grid", gridTemplateColumns: "auto auto",
  alignItems: "baseline", columnGap: 4, rowGap: 0, minWidth: 70, transform: "rotate(3deg)",
});
globalStyle(".support-time b", { fontFamily: t.displayFont, fontSize: 25, lineHeight: 1, letterSpacing: "-.06em" });
globalStyle(".support-time span", { color: t.muted, fontSize: 8, fontWeight: 850, textTransform: "uppercase" });
globalStyle(".support-time i", { gridColumn: "1 / -1", height: 1, marginBlock: 4, background: t.ink, opacity: .35 });

globalStyle(".progress-track", { display: "block", height: 9, marginTop: 15, overflow: "hidden", border: `1px solid ${t.ink}`, borderRadius: 999, background: t.yellow });
globalStyle(".progress-track > i", { display: "block", width: "100%", height: "100%", background: t.coral, transition: "transform 420ms cubic-bezier(.22,1,.36,1)" });
globalStyle(".progress-label", { display: "flex", justifyContent: "space-between", marginTop: 6, color: t.muted, fontSize: 8, fontWeight: 800, textTransform: "uppercase" });
globalStyle(".progress-label b", { color: t.ink });

globalStyle(".milestones", { zIndex: 1, display: "flex", minHeight: 0, flexDirection: "column", padding: "13px 16px 5px" });
globalStyle(".milestone-head", { display: "flex", flex: "0 0 auto", justifyContent: "space-between", color: t.muted, fontSize: 9, fontWeight: 850, letterSpacing: ".11em", textTransform: "uppercase" });
globalStyle(".milestone-head strong", { color: t.ink, letterSpacing: ".04em" });
globalStyle(".milestones ol", { minHeight: 0, margin: "7px 0 0", padding: 0, overflowY: "auto", listStyle: "none", scrollbarWidth: "thin", scrollbarColor: `${t.coral} transparent` });
globalStyle(".milestones li", {
  position: "relative", display: "grid", gridTemplateColumns: "19px 24px minmax(0, 1fr) 22px",
  gap: 7, alignItems: "center", minHeight: 39, borderBottom: `1px solid ${t.rule}`,
});
globalStyle(".milestones li::after", {
  content: '""', position: "absolute", left: 27, width: 14, height: 14, borderRadius: "50%",
  background: t.yellow, opacity: 0, transform: "scale(.4)", pointerEvents: "none",
});
globalStyle('.milestones li[data-celebrate="true"]::after', { animation: `${milestonePop} 650ms cubic-bezier(.16,1,.3,1)` });
globalStyle(".milestones li > span", { color: t.muted, fontSize: 8, fontWeight: 850 });
globalStyle(".milestone-check", {
  display: "grid", placeItems: "center", width: 22, height: 22, border: `1.5px solid ${t.ink}`,
  borderRadius: "50%", padding: 0, color: t.paper, background: t.paper, cursor: "pointer",
  transition: "transform 160ms cubic-bezier(.22,1,.36,1), background 160ms",
});
globalStyle(".milestone-check:hover", { transform: "scale(1.12)", background: t.yellow });
globalStyle('.milestone-check[data-state="checked"]', { borderColor: t.coral, background: t.coral });
globalStyle(".milestone-check svg", { width: 13, height: 13, strokeWidth: 3 });
globalStyle(".milestones li > div", { display: "flex", minWidth: 0, alignItems: "center" });
globalStyle(".milestones li strong", { overflow: "hidden", fontFamily: t.displayFont, fontSize: 13, fontWeight: 750, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle('.milestones li[data-done="true"] strong', { color: t.muted, textDecoration: "line-through", textDecorationThickness: "2px", textDecorationColor: t.coral });
globalStyle(".remove-button", { display: "grid", placeItems: "center", width: 22, height: 22, border: 0, padding: 0, opacity: 0, color: t.muted, background: "transparent", cursor: "pointer" });
globalStyle(".milestones li:hover .remove-button, .remove-button:focus-visible", { opacity: 1 });
globalStyle(".remove-button:hover", { color: t.coral });
globalStyle(".remove-button svg", { width: 12, height: 12 });
globalStyle(".milestone-empty", { margin: "16px 0 10px", color: t.muted, fontFamily: t.displayFont, fontSize: 14, lineHeight: 1.35 });
globalStyle(".quick-add", { display: "grid", flex: "0 0 auto", gridTemplateColumns: "1fr 30px", gap: 7, alignItems: "center", marginTop: 8 });
globalStyle(".quick-add input", { minWidth: 0, height: 31, border: 0, borderBottom: `1.5px solid ${t.ink}`, borderRadius: 0, padding: "0 3px", color: t.ink, background: "transparent", outline: "none", fontFamily: t.displayFont, fontSize: 12 });
globalStyle(".quick-add input::placeholder", { color: t.muted, opacity: .8 });
globalStyle(".quick-add button", { display: "grid", placeItems: "center", width: 30, height: 30, border: `1.5px solid ${t.ink}`, borderRadius: "50%", padding: 0, color: t.paper, background: t.ink, cursor: "pointer", transition: "transform 150ms cubic-bezier(.22,1,.36,1), background 150ms" });
globalStyle(".quick-add button:hover", { transform: "rotate(8deg) scale(1.08)", background: t.coral });
globalStyle(".quick-add button:disabled", { cursor: "not-allowed", opacity: .35, transform: "none" });
globalStyle(".quick-add svg", { width: 14, height: 14 });

globalStyle(".count-shell > footer", { zIndex: 1, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 7, alignItems: "center", borderTop: `1.5px solid ${t.ink}`, padding: "8px 14px 0", fontSize: 8, textTransform: "uppercase" });
globalStyle(".count-shell > footer > span", { color: t.coral, fontWeight: 850 });
globalStyle(".count-shell > footer > strong", { overflow: "hidden", fontSize: 9, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".count-shell > footer > small", { color: t.muted, fontWeight: 800 });
globalStyle(".count-error", { position: "absolute", zIndex: 4, right: 25, bottom: 14, left: 25, margin: 0, color: "#9f2924", fontSize: 9, textAlign: "center" });

globalStyle(".count-overlay", { position: "fixed", inset: 0, zIndex: 50, background: "rgb(37 33 44 / 58%)" });
globalStyle(".count-dialog", {
  position: "fixed", top: "50%", left: "50%", zIndex: 51, width: "min(334px, calc(100% - 32px))",
  maxHeight: "calc(100% - 34px)", overflow: "auto", border: `1.5px solid ${t.ink}`, borderRadius: 26,
  padding: "24px 23px", color: t.ink, background: t.yellow, boxShadow: "8px 10px 0 rgb(37 33 44 / 22%)",
  outline: "none", transform: "translate(-50%, -50%)",
});
globalStyle(".count-dialog > p", { margin: 0, color: t.coral, fontSize: 9, fontWeight: 850, letterSpacing: ".12em", textTransform: "uppercase" });
globalStyle(".count-dialog h2", { margin: "5px 0 15px", fontFamily: t.displayFont, fontSize: 28, letterSpacing: "-.05em" });
globalStyle(".count-dialog label", { display: "grid", gap: 3, marginTop: 10, color: t.muted, fontSize: 9, fontWeight: 850, textTransform: "uppercase" });
globalStyle(".count-dialog input", { minWidth: 0, height: 35, border: 0, borderBottom: `1.5px solid ${t.ink}`, borderRadius: 0, padding: 0, color: t.ink, background: "transparent", outline: "none", textTransform: "none" });
globalStyle(".date-fields", { display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 13 });
globalStyle(".date-trigger", { display: "flex", alignItems: "center", gap: 7, width: "100%", height: 35, overflow: "hidden", border: 0, borderBottom: `1.5px solid ${t.ink}`, borderRadius: 0, padding: 0, color: t.ink, background: "transparent", cursor: "pointer", fontSize: 10, fontWeight: 800, textAlign: "left" });
globalStyle(".date-trigger svg", { flex: "0 0 auto", width: 13, height: 13 });
globalStyle(".date-trigger span", { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".calendar-popover", { zIndex: 70, width: 250, border: `1.5px solid ${t.ink}`, borderRadius: 18, padding: 13, color: t.ink, background: t.paper, boxShadow: "7px 8px 0 rgb(37 33 44 / 22%)", outline: "none", fontFamily: t.bodyFont });
globalStyle(".calendar-head", { display: "grid", gridTemplateColumns: "28px 1fr 28px", alignItems: "center", marginBottom: 8, fontFamily: t.displayFont, fontSize: 13, textAlign: "center" });
globalStyle(".calendar-nav", { display: "grid", placeItems: "center", width: 28, height: 28, border: `1px solid ${t.ink}`, borderRadius: "50%", padding: 0, color: t.ink, background: "transparent", cursor: "pointer" });
globalStyle(".calendar-nav:hover", { background: t.yellow });
globalStyle(".calendar-nav svg", { width: 13, height: 13 });
globalStyle(".calendar-grid", { width: "100%", borderCollapse: "collapse" });
globalStyle(".calendar-grid tr", { display: "grid", gridTemplateColumns: "repeat(7, 1fr)" });
globalStyle(".calendar-grid th", { paddingBlock: 3, color: t.muted, fontSize: 8, fontWeight: 850, textTransform: "uppercase" });
globalStyle(".calendar-grid td", { display: "grid", placeItems: "center", padding: 1 });
globalStyle(".calendar-grid td button", { display: "grid", placeItems: "center", width: 28, height: 28, border: 0, borderRadius: "50%", padding: 0, color: t.ink, background: "transparent", cursor: "pointer", fontSize: 10, fontWeight: 800 });
globalStyle(".calendar-grid td button:hover", { background: t.yellow });
globalStyle(".calendar-grid td button[data-selected]", { color: t.paper, background: t.coral });
globalStyle(".calendar-grid td button[data-today]:not([data-selected])", { boxShadow: `inset 0 0 0 1.5px ${t.ink}` });
globalStyle(".calendar-grid td button[data-outside-month]", { opacity: .28 });
globalStyle(".dialog-actions", { display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 16 });
globalStyle(".dialog-actions button, .add-milestone", { height: 36, border: `1px solid ${t.ink}`, borderRadius: 999, padding: "0 13px", color: t.ink, background: "transparent", cursor: "pointer", fontSize: 10, fontWeight: 800 });
globalStyle(".dialog-actions button:last-child, .add-milestone", { color: t.paper, background: t.ink });
globalStyle(".dialog-actions button:hover, .add-milestone:hover", { transform: "translateY(-1px)" });
globalStyle(".count-dialog hr", { height: 1, margin: "19px 0", border: 0, background: t.rule });
globalStyle(".add-milestone", { width: "100%", marginTop: 13 });
globalStyle(".add-milestone:disabled", { cursor: "not-allowed", opacity: .42 });
globalStyle(".count-close", { position: "absolute", top: 11, right: 11, display: "grid", placeItems: "center", width: 32, height: 32, border: 0, borderRadius: "50%", padding: 0, color: t.muted, background: "transparent", cursor: "pointer" });
globalStyle(".count-close:hover", { color: t.ink, background: "rgb(37 33 44 / 8%)" });
globalStyle(".count-close svg", { width: 14, height: 14 });

globalStyle('[data-slop-render="icon"]', { display: "none !important", width: 512, height: 512, placeItems: "center", overflow: "hidden", background: "transparent" });
globalStyle('html[data-slop-renderer="true"][data-slop-capture="icon"] .count-shell', { display: "none" });
globalStyle('html[data-slop-renderer="true"][data-slop-capture="icon"] [data-slop-render="icon"]', { display: "grid !important" });
globalStyle(".count-icon", { background: t.coral });
globalStyle(".icon-paper", { position: "relative", width: 414, height: 414, overflow: "hidden", border: `5px solid ${t.ink}`, borderRadius: 82, padding: "58px 48px", color: t.ink, background: `linear-gradient(90deg, transparent 49.5%, ${t.rule} 49.5% 50.5%, transparent 50.5%), ${t.paper}`, boxShadow: "13px 16px 0 rgb(37 33 44 / 24%)" });
globalStyle(".icon-paper > span", { display: "block", color: t.coral, fontFamily: t.bodyFont, fontSize: 15, fontWeight: 900, letterSpacing: ".15em" });
globalStyle(".icon-paper > i", { display: "block", height: 4, marginTop: 25, background: t.ink });
globalStyle(".icon-paper > strong", { display: "inline-block", marginTop: 38, fontFamily: t.displayFont, fontSize: 164, lineHeight: .55, letterSpacing: "-.12em" });
globalStyle(".icon-paper > small", { display: "inline-block", marginLeft: 18, fontFamily: t.bodyFont, fontSize: 17, fontWeight: 900, lineHeight: 1.1, textTransform: "uppercase" });
globalStyle(".icon-paper > b", { position: "absolute", width: 132, height: 132, right: -53, top: 56, border: `3px solid ${t.ink}`, borderRadius: "50%", background: t.yellow });
globalStyle(".icon-paper > em", { position: "relative", display: "inline-block", width: 28, height: 28, margin: "55px 9px 0 0", border: `3px solid ${t.ink}`, borderRadius: "50%", background: t.coral });
globalStyle(".icon-paper > em:nth-of-type(2)", { background: t.blue });
globalStyle(".icon-paper > em:nth-of-type(3)", { background: t.green });

globalStyle(".count-shell[data-finished='true'] .orbit-one", { animation: `${victoryOrbit} 3s ease-in-out infinite alternate` });

globalStyle('html[data-slop-capture="static"] [data-slop-export="hide"]', { display: "none !important" });
globalStyle('html[data-slop-capture="static"] .milestones ol', { overflow: "visible" });
globalStyle('html[data-slop-capture="static"] .count-shell', { height: "auto", minHeight: "100%" });

globalStyle(".count-stage", { "@container": { "(max-width: 360px)": { paddingInline: 8 } } });
globalStyle(".count-shell", { "@container": { "(max-width: 360px)": { paddingInline: 22, gridTemplateRows: "32px 228px minmax(0, 1fr) 38px" } } });
globalStyle(".milestones", { "@container": { "(max-width: 360px)": { paddingInline: 9 } } });
globalStyle(".support-time", { "@container": { "(max-width: 340px)": { display: "none" } } });
globalStyle(".milestones li", { "@container": { "(max-width: 340px)": { gridTemplateColumns: "17px 23px minmax(0, 1fr) 20px", gap: 5 } } });

globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animationDuration: "0.01ms !important",
      animationIterationCount: "1 !important",
      transitionDuration: "0.01ms !important",
    },
  },
});
