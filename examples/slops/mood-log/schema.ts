import * as Type from "typebox";

const moodSchema = Type.Object({
  prompt: Type.String(),
  entries: Type.Array(Type.Object({
    id: Type.String(),
    day: Type.String(),
    mood: Type.Number(),
    energy: Type.Number(),
    note: Type.String(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type MoodLog = Type.Static<typeof moodSchema>;
export default moodSchema;
