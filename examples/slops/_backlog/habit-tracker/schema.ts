import * as Type from "typebox";

const habitSchema = Type.Object({
  selectedId: Type.String(),
  habits: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    color: Type.String(),
    createdAt: Type.String(),
    checkins: Type.Array(Type.String()),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type HabitTracker = Type.Static<typeof habitSchema>;
export default habitSchema;
