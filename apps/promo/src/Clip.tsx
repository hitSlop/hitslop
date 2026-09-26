import { Img, staticFile, useCurrentFrame } from "remotion";
import soma from "../public/captures/soma/meta.json";
import pet from "../public/captures/pet/meta.json";
import checklist from "../public/captures/checklist/meta.json";
import timer from "../public/captures/timer/meta.json";
import koi from "../public/captures/koi/meta.json";
import doodle from "../public/captures/doodle/meta.json";
import flashcards from "../public/captures/flashcards/meta.json";
import wordle from "../public/captures/wordle/meta.json";

export const clips = { soma, pet, checklist, timer, koi, doodle, flashcards, wordle };
export type ClipName = keyof typeof clips;

/**
 * Plays a captured PNG sequence. `cues` are [globalFrame, clipFrame, rate = 1]: from each cue the clip
 * advances at `rate` (0 holds) until the next cue, which may jump. Before the first cue its frame holds.
 */
export type Cue = [number, number] | [number, number, number];
export function Clip({ name, cues, loop = false }: { name: ClipName; cues: Cue[]; loop?: boolean }) {
  const frame = useCurrentFrame();
  const { frames } = clips[name];
  let source = cues[0][1];
  for (const [g, c, rate = 1] of cues) if (frame >= g) source = c + (frame - g) * rate;
  source = loop ? ((source % frames) + frames) % frames : Math.max(0, Math.min(frames - 1, source));
  return (
    <Img
      src={staticFile(`captures/${name}/${String(Math.round(source)).padStart(4, "0")}.png`)}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
