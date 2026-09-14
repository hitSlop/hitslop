import * as Type from "typebox";

const laneSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  limit: Type.Union([Type.Number(), Type.Null()]),
}, { additionalProperties: true });

const cardSchema = Type.Object({
  id: Type.String(),
  laneId: Type.String(),
  title: Type.String(),
  note: Type.String(),
  tag: Type.String(),
  order: Type.Number(),
}, { additionalProperties: true });

const boardSchema = Type.Object({
  title: Type.String(),
  doneLaneId: Type.Union([Type.String(), Type.Null()]),
  lanes: Type.Array(laneSchema),
  cards: Type.Array(cardSchema),
}, { additionalProperties: true });

export type Board = Type.Static<typeof boardSchema>;
export type Lane = Board["lanes"][number];
export type Card = Board["cards"][number];
export default boardSchema;
