import * as Type from "typebox";

const countdownSchema = Type.Object({
  title: Type.String(),
  createdAt: Type.String(),
  targetDate: Type.String(),
  targetTime: Type.String(),
  milestones: Type.Array(Type.Object({
    id: Type.String(),
    title: Type.String(),
    done: Type.Boolean(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type CountdownData = Type.Static<typeof countdownSchema>;
export default countdownSchema;
