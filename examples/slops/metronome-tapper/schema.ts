import { z } from "zod";

const timeSignature = z.enum(["2/4", "3/4", "4/4", "6/8"]);

const metronomeSchema = z.object({
  bpm: z.number().int().min(40).max(240),
  signature: timeSignature,
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  presets: z.array(z.number().int().min(40).max(240)).min(1).max(6),
});

export type TimeSignature = z.infer<typeof timeSignature>;
export type MetronomeState = z.infer<typeof metronomeSchema>;
export default metronomeSchema;
