import * as Type from "typebox";

const cellStyle = Type.Object({
  bold: Type.Optional(Type.Boolean()),
  align: Type.Optional(Type.Union([
    Type.Literal("left"),
    Type.Literal("center"),
    Type.Literal("right"),
  ])),
  currency: Type.Optional(Type.Boolean()),
}, { additionalProperties: true });

const cellData = Type.Object({
  raw: Type.String(),
  style: Type.Optional(cellStyle),
}, { additionalProperties: true });

const pocketSheetSchema = Type.Object({
  title: Type.String(),
  rows: Type.Number(),
  cols: Type.Number(),
  cells: Type.Record(Type.String(), cellData),
}, { additionalProperties: true });

export type CellStyle = Type.Static<typeof cellStyle>;
export type CellData = Type.Static<typeof cellData>;
export type PocketSheet = Type.Static<typeof pocketSheetSchema>;
export default pocketSheetSchema;
