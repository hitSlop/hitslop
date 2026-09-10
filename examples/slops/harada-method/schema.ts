import * as Type from "typebox";

const themeSchema = Type.Object({
  title: Type.String(),
  cells: Type.Array(Type.String()),
}, { additionalProperties: true });

const sheetSchema = Type.Object({
  goal: Type.String(),
  deadline: Type.String(),
  themes: Type.Array(themeSchema),
  done: Type.Record(Type.String(), Type.Boolean()),
}, { additionalProperties: true });

export type Theme = Type.Static<typeof themeSchema>;
export type Sheet = Type.Static<typeof sheetSchema>;
export default sheetSchema;
