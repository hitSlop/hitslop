import * as Type from "typebox";

const timeSignature = Type.Enum(["2/4", "3/4", "4/4", "6/8"]);

const metronomeSchema = Type.Object({
  bpm: Type.Integer({ minimum: 40, maximum: 240 }),
  signature: timeSignature,
  volume: Type.Number({ minimum: 0, maximum: 1 }),
  muted: Type.Boolean(),
  presets: Type.Array(Type.Integer({ minimum: 40, maximum: 240 }), { minItems: 1, maxItems: 6 }),
}, { additionalProperties: true });

export type TimeSignature = Type.Static<typeof timeSignature>;
export type MetronomeState = Type.Static<typeof metronomeSchema>;
export default metronomeSchema;
