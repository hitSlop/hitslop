import * as Type from "typebox";

const waterSchema = Type.Object({
  target: Type.Number(),
  current: Type.Number(),
  unit: Type.String(),
  logs: Type.Array(Type.Object({
    id: Type.String(),
    time: Type.String(),
    amount: Type.Number(),
    label: Type.String(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type WaterTracker = Type.Static<typeof waterSchema>;
export default waterSchema;
