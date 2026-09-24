import { defineDocument, s, type Value } from "@hitslop/document";

const schema = defineDocument({
  date: s.string(),
  situation: s.text(),
  hooks: s.list(s.string()),
  values: s.list(s.string()),
  awayMoves: s.list(s.object({ text: s.text() })),
  towardsMoves: s.list(s.object({ text: s.text() })),
  stop: s.object({
    slow: s.boolean(),
    takeNote: s.boolean(),
    openUp: s.boolean(),
    pursue: s.boolean(),
  }),
  nextMove: s.text(),
  nextWhen: s.text(),
  nextDone: s.boolean(),
  theme: s.enum(["light", "dark"]),
  introDismissed: s.boolean(),
});

export type ChoicePoint = Value<typeof schema.fields.node>;
export type ChoiceMove = ChoicePoint["awayMoves"][number];
export default schema;
