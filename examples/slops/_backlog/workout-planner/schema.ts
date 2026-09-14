import * as Type from "typebox";

const exerciseSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    sets: Type.Integer(),
    reps: Type.Integer(),
    completedSets: Type.Integer(),
    completedSetIndices: Type.Optional(
      Type.Array(Type.Integer({ minimum: 0 }), { uniqueItems: true }),
    ),
    weight: Type.String(),
  },
  { additionalProperties: true },
);

const workoutSchema = Type.Object(
  {
    title: Type.String(),
    restPreset: Type.Integer(),
    exercises: Type.Array(exerciseSchema),
  },
  { additionalProperties: true },
);

export type WorkoutPlanner = Type.Static<typeof workoutSchema>;
export default workoutSchema;
