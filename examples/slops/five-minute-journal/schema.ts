import * as Type from "typebox";

const threeLines = Type.Array(Type.String(), { minItems: 3, maxItems: 3 });

const journalSchema = Type.Object({
  date: Type.String(),
  quote: Type.String(),
  quoteAuthor: Type.String(),
  morningDone: Type.Boolean(),
  gratitudes: threeLines,
  intentions: threeLines,
  affirmation: Type.String(),
  eveningDone: Type.Boolean(),
  highlights: threeLines,
  lesson: Type.String(),
}, { additionalProperties: true });

export type FiveMinuteJournal = Type.Static<typeof journalSchema>;
export default journalSchema;
