import * as Type from "typebox";

const expenseSchema = Type.Object({
  storeName: Type.String(),
  terminalId: Type.String(),
  currency: Type.String(),
  items: Type.Array(Type.Object({
    id: Type.String(),
    title: Type.String(),
    amount: Type.Number(),
    category: Type.String(),
    date: Type.String(),
    time: Type.String(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type ExpenseLog = Type.Static<typeof expenseSchema>;
export default expenseSchema;
