import type { Input } from "@hitslop/document";
import schema from "./schema";

function todayStr(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default {
  date: todayStr(),
  situation: "Feedback landed hard in the team review.",
  hooks: ["I should already know this", "A flush of embarrassment", "Urge to shut down"],
  values: ["Craft", "Humility", "Collaboration"],
  awayMoves: [{ text: "Avoid the revision" }, { text: "Get sharp with my teammates" }],
  towardsMoves: [
    { text: "Thank them for catching it" },
    { text: "Take a breath, then pair on the fix" },
  ],
  stop: { slow: true, takeNote: true, openUp: false, pursue: false },
  nextMove: "Thank them, then pair on the first fix.",
  nextWhen: "Right after this meeting",
  nextDone: false,
  introDismissed: false,
  theme: "light",
} satisfies Input<typeof schema.fields.node>;
