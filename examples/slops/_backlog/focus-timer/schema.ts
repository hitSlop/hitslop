import * as Type from "typebox";

const timerSchema = Type.Object({
  focusMinutes: Type.Integer(),
  restMinutes: Type.Integer(),
  history: Type.Array(Type.Object({
    startedAt: Type.String(),
    kind: Type.String(),
    seconds: Type.Integer(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type FocusTimer = Type.Static<typeof timerSchema>;
export default timerSchema;
