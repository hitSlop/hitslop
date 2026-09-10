import * as Type from "typebox";

const factor = Type.Object({
  id: Type.String(),
  text: Type.String(),
  weight: Type.Number(),
}, { additionalProperties: true });

const decisionSchema = Type.Object({
  question: Type.String(),
  date: Type.String(),
  status: Type.String(),
  pros: Type.Array(factor),
  cons: Type.Array(factor),
  verdict: Type.String(),
}, { additionalProperties: true });

export type Factor = Type.Static<typeof factor>;
export type Decision = Type.Static<typeof decisionSchema>;
export default decisionSchema;
