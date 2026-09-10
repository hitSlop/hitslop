import * as Type from "typebox";

const entry = Type.Object({
  id: Type.String(),
  type: Type.String(),
  star: Type.Boolean(),
  text: Type.String(),
}, { additionalProperties: true });

const monthlyItem = Type.Object({
  id: Type.String(),
  day: Type.Number(),
  weekday: Type.String(),
  text: Type.String(),
}, { additionalProperties: true });

const bulletJournalSchema = Type.Object({
  date: Type.String(),
  monthTitle: Type.String(),
  dailyPage: Type.String(),
  monthlyPage: Type.String(),
  entries: Type.Array(entry),
  monthlyLog: Type.Array(monthlyItem),
}, { additionalProperties: true });

export type BulletJournal = Type.Static<typeof bulletJournalSchema>;
export default bulletJournalSchema;
