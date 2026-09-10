import * as Type from "typebox";

const category = Type.Object({
  id: Type.String(),
  name: Type.String(),
  tagCode: Type.String(),
  color: Type.String(),
}, { additionalProperties: true });

const item = Type.Object({
  id: Type.String(),
  categoryId: Type.String(),
  text: Type.String(),
  quantity: Type.Number(),
  packed: Type.Boolean(),
  essential: Type.Boolean(),
}, { additionalProperties: true });

const packingSchema = Type.Object({
  tripTitle: Type.String(),
  destination: Type.String(),
  departureDate: Type.String(),
  traveler: Type.String(),
  bagTag: Type.String(),
  flag: Type.String(),
  categories: Type.Array(category),
  items: Type.Array(item),
}, { additionalProperties: true });

export type PackingList = Type.Static<typeof packingSchema>;
export default packingSchema;
