import * as Type from "typebox";

const party = Type.Object({
  name: Type.String(),
  detail: Type.String(),
}, { additionalProperties: true });

const invoiceSchema = Type.Object({
  number: Type.String(),
  status: Type.String(),
  issued: Type.String(),
  due: Type.String(),
  from: party,
  billTo: party,
  items: Type.Array(Type.Object({
    id: Type.String(),
    description: Type.String(),
    quantity: Type.Union([Type.Number(), Type.Null()]),
    rate: Type.Union([Type.Number(), Type.Null()]),
  }, { additionalProperties: true })),
  taxPercent: Type.Union([Type.Number(), Type.Null()]),
  notes: Type.String(),
  currency: Type.String(),
}, { additionalProperties: true });

export type Invoice = Type.Static<typeof invoiceSchema>;
export default invoiceSchema;
