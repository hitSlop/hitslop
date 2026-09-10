import * as Type from "typebox";

const recipeSchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  difficulty: Type.String(),
  servings: Type.Union([Type.Number(), Type.Null()]),
  prepMinutes: Type.Union([Type.Number(), Type.Null()]),
  cookMinutes: Type.Union([Type.Number(), Type.Null()]),
  ingredients: Type.Array(Type.Object({
    id: Type.String(),
    text: Type.String(),
    checked: Type.Boolean(),
  }, { additionalProperties: true })),
  steps: Type.Array(Type.Object({
    id: Type.String(),
    title: Type.String(),
    text: Type.String(),
    minutes: Type.Union([Type.Number(), Type.Null()]),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type Recipe = Type.Static<typeof recipeSchema>;
export default recipeSchema;
