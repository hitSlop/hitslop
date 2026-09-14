import * as Type from "typebox";

const personalBudgetSchema = Type.Object({
  month: Type.String(),
  income: Type.Number(),
  savings: Type.Number(),
  categories: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    allocated: Type.Number(),
    spent: Type.Number(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type PersonalBudget = Type.Static<typeof personalBudgetSchema>;
export default personalBudgetSchema;
