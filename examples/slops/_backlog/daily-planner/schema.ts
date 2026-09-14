import * as Type from "typebox";

export const KINDS = ["focus", "meeting", "break", "personal"] as const;
export type Kind = (typeof KINDS)[number];

const kind = Type.Enum(["focus", "meeting", "break", "personal"]);

const block = Type.Object({
  id: Type.String(),
  start: Type.String(),
  end: Type.String(),
  title: Type.String(),
  kind,
}, { additionalProperties: true });

const priority = Type.Object({
  text: Type.String(),
  done: Type.Boolean(),
}, { additionalProperties: true });

const plannerSchema = Type.Object({
  date: Type.String(),
  priorities: Type.Array(priority),
  blocks: Type.Array(block),
  notes: Type.String(),
}, { additionalProperties: true });

export type Block = Type.Static<typeof block>;
export type Priority = Type.Static<typeof priority>;
export type Planner = Type.Static<typeof plannerSchema>;
export default plannerSchema;
