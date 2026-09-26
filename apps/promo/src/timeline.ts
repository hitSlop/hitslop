import music from "./music.json";

export const FPS = 30;
export const DURATION = 900;

/**
 * Global frames for each story beat. The song starts when SomaAmp's play button is pressed
 * (frame 134), from its 89.1 s kick-in, so everything after that is snapped to its grid in
 * music.json: 148 BPM, a beat every ~12.2 frames, downbeats at 135, 184, 233, 281, 330, 379,
 * 427, 476, 525, 573, 622, 671, 719, 768, 817, 865.
 */
export const T = {
  finderClick: 37,
  finderOpen: 38,
  somaDouble: 93,
  somaOpen: 99,
  somaPlay: 134,
  wszGrab: 147,
  skinSwap: 208,
  petDouble: 263,
  petOpen: 269,
  zipGrab: 293,
  petSwap: 342,
  checkDouble: 361,
  checkOpen: 367,
  timerDouble: 373,
  timerOpen: 379,
  termClick: 390,
  termOpen: 391,
  cmd1Start: 397,
  cmd1Enter: 424,
  taskAdded: 427,
  cmd2Start: 438,
  cmd2Enter: 473,
  themeSet: 476,
  termClose: 549,
  montage: 573,
  outro: 800,
} as const;

export const MUSIC = music;
const beats = music.beats.map(Math.round);
/** Montage windows pop on every other beat from its first downbeat. */
export const popBeats = beats.filter((b) => b >= T.montage).filter((_, i) => i % 2 === 0).slice(0, 8);
/** Beats that get a camera punch, from the montage until the outro. */
export const punchBeats = beats.filter((b) => b >= T.montage && b < T.outro);

export const UI = 1.3; // CSS px → composition px for desktop chrome

export type Point = { x: number; y: number };
