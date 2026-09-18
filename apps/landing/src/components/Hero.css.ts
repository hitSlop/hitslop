import { fontFace, style } from "@vanilla-extract/css";

const display = fontFace({
  src: 'url("/assets/hero/fonts/lilita-one-latin.woff2") format("woff2")',
  fontWeight: 400,
  fontStyle: "normal",
  fontDisplay: "swap",
});
const sans = fontFace({
  src: 'url("/assets/hero/fonts/dm-sans-latin.woff2") format("woff2")',
  fontWeight: "400 700",
  fontStyle: "normal",
  fontDisplay: "swap",
});
const handwriting = fontFace({
  src: 'url("/assets/hero/fonts/kalam-latin.woff2") format("woff2")',
  fontWeight: 400,
  fontStyle: "normal",
  fontDisplay: "swap",
});
const ink = "#10132c";
const purple = "#6c16ed";
const pink = "#f443a1";
const desktop = "screen and (min-width: 1100px)";
const small = "screen and (max-width: 599px)";
const compact = "screen and (min-width: 1100px) and (max-height: 850px)";
const focus = { outline: `3px solid ${purple}`, outlineOffset: 4 };

export const headerType = style({ fontFamily: `${sans}, sans-serif`, color: ink });
export const hero = style({
  position: "relative",
  isolation: "isolate",
  color: ink,
  fontFamily: `${sans}, sans-serif`,
  width: "min(1800px, 100%)",
  margin: "0 auto",
  padding: "42px clamp(24px, 4vw, 64px) 28px",
  display: "grid",
  gap: "32px",
  alignItems: "center",
  "::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    inset: "0 calc((100% - 100vw) / 2)",
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse at 73% 14%, #e8e2ff 0, transparent 53%), radial-gradient(ellipse at 28% 67%, #fff0fa 0, transparent 48%), radial-gradient(ellipse at 90% 90%, #e5fbfa 0, transparent 44%)",
  },
  "@media": {
    [desktop]: {
      gridTemplateColumns: "minmax(0, 43fr) minmax(0, 57fr)",
      gap: "22px 36px",
      paddingTop: 32,
      paddingBottom: 24,
    },
    [compact]: { paddingTop: 24, paddingBottom: 16, gap: "16px 28px" },
    [small]: { padding: "36px 24px 24px", gap: 28 },
  },
});
export const copy = style({ position: "relative", minWidth: 0, zIndex: 2 });
export const eyebrow = style({
  position: "relative",
  margin: "0 0 16px",
  paddingLeft: 4,
  color: purple,
  fontSize: "clamp(.7rem, .9vw, .85rem)",
  fontWeight: 700,
  letterSpacing: ".14em",
  textTransform: "uppercase",
});
export const title = style({
  position: "relative",
  width: "max-content",
  maxWidth: "100%",
  margin: 0,
  fontFamily: `${display}, "Arial Rounded MT Bold", sans-serif`,
  fontSize: "clamp(4rem, 8vw, 6.5rem)",
  fontWeight: 400,
  lineHeight: ".98",
  letterSpacing: "-.025em",
  textWrap: "initial",
  "@media": {
    [desktop]: { fontSize: "clamp(4rem, 5.55vw, 6.3rem)" },
    [compact]: { fontSize: "clamp(4rem, 5.25vw, 5.7rem)" },
    [small]: { fontSize: "clamp(3.05rem, 11.3vw, 4.25rem)" },
  },
});
export const titleLine = style({ display: "block" });
export const big = style({
  position: "relative",
  zIndex: 0,
  display: "inline-block",
  color: purple,
  transform: "rotate(-3deg)",
  "::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    left: "-7%",
    right: "-4%",
    bottom: "1%",
    height: ".28em",
    borderRadius: "48% 35% 43% 28%",
    background: "#ffe56f",
    transform: "rotate(-5deg)",
  },
});
export const subhead = style({
  margin: "24px 0 0",
  maxWidth: "29ch",
  fontSize: "clamp(1.25rem, 1.65vw, 1.85rem)",
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: "-.025em",
  "@media": { [compact]: { marginTop: 20, fontSize: "clamp(1.25rem, 1.6vw, 1.6rem)" } },
});
export const lede = style({
  margin: "16px 0 0",
  maxWidth: "53ch",
  color: "#4e527a",
  fontSize: "clamp(1rem, 1.15vw, 1.16rem)",
  lineHeight: 1.5,
  "@media": { [compact]: { marginTop: 12 } },
});
export const slop = style({ color: ink, fontWeight: 700, fontSize: ".95em" });
export const actions = style({
  marginTop: 24,
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  "@media": {
    [compact]: { marginTop: 20 },
    [small]: { display: "grid", gridTemplateColumns: "1fr" },
  },
});
const action = style({
  minHeight: 56,
  padding: "0 clamp(16px, 1.6vw, 26px)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  border: "1px solid",
  borderRadius: 20,
  fontSize: "clamp(.9rem, 1.05vw, 1.05rem)",
  fontWeight: 700,
  whiteSpace: "nowrap",
  transition: "transform 180ms var(--ease-out), box-shadow 180ms var(--ease-out)",
  ":focus-visible": focus,
  ":active": { transform: "translateY(2px)" },
  "@media": { "(hover: hover)": { ":hover": { transform: "translateY(-2px)" } } },
});
export const primary = style([
  action,
  {
    color: "#fff",
    borderColor: "#303146",
    background: "linear-gradient(#242537, #101320 55%)",
    boxShadow: "inset 0 2px 3px #ffffff20, 0 4px 0 #090c1b, 0 8px 16px #26105415",
  },
]);
export const secondary = style([
  action,
  {
    borderColor: "#dbd0fd",
    color: ink,
    background: "#ffffffde",
    boxShadow: "0 3px 0 #e5ddf7, 0 7px 18px #6c16ed0d",
  },
]);
export const actionArrow = style({
  width: 19,
  height: 19,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});
export const meta = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "3px 12px",
  margin: "13px 0 0",
  color: "#686286",
  fontSize: ".76rem",
  lineHeight: 1.5,
});
export const later = style({ "::before": { content: '"·"', marginRight: 12 } });
export const benefits = style({
  margin: "26px 0 0",
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  listStyle: "none",
  gap: 14,
  "@media": { [compact]: { marginTop: 22 }, [small]: { gap: 12 } },
});
export const benefit = style({
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: "clamp(.8rem, 1vw, .98rem)",
  fontWeight: 700,
  lineHeight: 1.32,
  selectors: { "& + &": { borderLeft: "1px solid #ded8ee", paddingLeft: 14 } },
  "@media": { [small]: { flexDirection: "column", alignItems: "start", gap: 8 } },
});
export const benefitLink = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  ":focus-visible": focus,
  ":hover": { color: purple },
  "@media": { [small]: { flexDirection: "column", alignItems: "start", gap: 8 } },
});
export const benefitIcon = style({
  width: 42,
  height: 42,
  objectFit: "contain",
  flexShrink: 0,
  "@media": { [small]: { width: 36, height: 36 } },
});
export const benefitText = style({ position: "relative" });
export const littleUnderline = style({
  position: "absolute",
  width: "95%",
  height: 9,
  left: 0,
  bottom: -8,
  fill: "none",
  stroke: pink,
  strokeWidth: 3,
  strokeLinecap: "round",
});
const handwritten = style({
  fontFamily: `${handwriting}, cursive`,
  fontWeight: 400,
  fontSize: "clamp(1.05rem, 1.4vw, 1.5rem)",
  lineHeight: 1.13,
  pointerEvents: "none",
  userSelect: "none",
});
export const localNote = style([
  handwritten,
  {
    width: "max-content",
    margin: "26px 0 0 -12px",
    color: purple,
    display: "flex",
    gap: 18,
    alignItems: "center",
    transform: "rotate(-6deg)",
    "@media": { [compact]: { marginTop: 20 }, [small]: { marginLeft: 0, marginTop: 24 } },
  },
]);
export const arrow = style({
  width: 62,
  height: 45,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});
export const picture = style({
  position: "relative",
  minWidth: 0,
  width: "100%",
  margin: 0,
  justifySelf: "end",
  "@media": {
    [desktop]: { width: "min(100%, calc((100svh - 185px) * 1.3333))" },
    [small]: { marginBottom: 20 },
  },
});
export const mediaFrame = style({
  position: "relative",
  aspectRatio: "4 / 3",
  overflow: "hidden",
  borderRadius: 28,
  border: "2px solid #ffffffdd",
  boxShadow: "0 22px 55px #414d8228",
  "@media": { [small]: { borderRadius: 18 } },
});
export const poster = style({
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
});
export const video = style([
  poster,
  {
    position: "absolute",
    inset: 0,
    "@media": { "(prefers-reduced-motion: reduce)": { display: "none" } },
  },
]);
export const stickyNote = style([
  handwritten,
  {
    position: "absolute",
    right: -24,
    bottom: 28,
    padding: "18px 16px 14px",
    color: ink,
    background: "#fff19a",
    boxShadow: "2px 5px 8px #69542214",
    borderRadius: "2px 5px 3px 2px",
    transform: "rotate(-10deg)",
    zIndex: 3,
    "@media": { [small]: { right: -8, bottom: -20, padding: "12px 14px", fontSize: "1rem" } },
  },
]);
export const noteArrow = style([
  arrow,
  {
    position: "absolute",
    right: 8,
    bottom: -47,
    transform: "rotate(-25deg)",
    color: ink,
    "@media": { [small]: { display: "none" } },
  },
]);
export const doodle = style({
  position: "absolute",
  pointerEvents: "none",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
});
export const rays = style([
  doodle,
  {
    color: purple,
    width: 42,
    height: 46,
    left: -43,
    top: -12,
    strokeWidth: 7,
    transform: "rotate(-8deg)",
    "@media": {
      "(min-width: 600px) and (max-width: 1199px)": { width: 28, height: 28, left: -30, top: -14 },
      [small]: { width: 28, height: 28, left: -17, top: -13 },
    },
  },
]);
export const burst = style([
  doodle,
  {
    color: pink,
    width: 36,
    height: 54,
    right: -25,
    bottom: 2,
    strokeWidth: 7,
    "@media": { "(max-width: 1199px)": { display: "none" } },
  },
]);
export const starsTop = style([
  doodle,
  {
    color: "#ffa92a",
    width: 36,
    height: 75,
    right: -39,
    top: "9%",
    strokeWidth: 2.5,
    "@media": { "(max-width: 1199px)": { display: "none" } },
  },
]);
export const starsBottom = style([
  doodle,
  {
    color: "#398cff",
    width: 26,
    height: 38,
    right: -34,
    bottom: "26%",
    strokeWidth: 2,
    "@media": { "(max-width: 1199px)": { display: "none" } },
  },
]);
export const shelf = style({
  gridColumn: "1 / -1",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: "9px 10px",
  border: "1px solid #ffffff",
  borderRadius: 40,
  background: "#ffffffb8",
  boxShadow: "0 10px 30px #61478a12",
  "@media": { [small]: { marginInline: -12, padding: "7px 3px" } },
});
export const categoryList = style({
  flex: 1,
  minWidth: 0,
  margin: 0,
  padding: "4px 2px",
  display: "flex",
  gap: 10,
  overflowX: "auto",
  scrollbarWidth: "none",
  listStyle: "none",
  "::-webkit-scrollbar": { display: "none" },
});
export const category = style({
  flexShrink: 0,
  minHeight: 42,
  padding: "0 15px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #e2def1",
  borderRadius: 24,
  background: "#ffffffed",
  boxShadow: "0 3px 5px #31226309",
  fontSize: ".86rem",
  fontWeight: 500,
  whiteSpace: "nowrap",
});
export const emoji = style({ fontSize: "1.2rem" });
export const shelfButton = style({
  flexShrink: 0,
  width: 40,
  height: 44,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: 0,
  borderRadius: 24,
  background: "transparent",
  color: purple,
  cursor: "pointer",
  ":hover": { background: "#ede4ff" },
  ":focus-visible": focus,
  ":disabled": { opacity: 0.3, cursor: "default" },
  "@media": { [small]: { width: 34 } },
});
export const controlIcon = style({
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});
export const pauseIcon = style([
  controlIcon,
  { selectors: { '[data-paused="true"] &': { display: "none" } } },
]);
export const playIcon = style([
  controlIcon,
  { display: "none", selectors: { '[data-paused="true"] &': { display: "block" } } },
]);
