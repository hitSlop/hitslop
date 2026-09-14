import * as Type from "typebox";

const dayEntry = Type.Object({
  date: Type.String(),
  text: Type.String(),
  completedAt: Type.String(),
}, { additionalProperties: true });

const morningPagesSchema = Type.Object({
  currentKey: Type.String(),
  entries: Type.Record(Type.String(), dayEntry),
}, { additionalProperties: true });

export type DayEntry = Type.Static<typeof dayEntry>;
export type MorningPages = Type.Static<typeof morningPagesSchema>;
export default morningPagesSchema;
