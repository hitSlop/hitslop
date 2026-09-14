import * as Type from "typebox";

const grocerySchema = Type.Object({
  title: Type.String(),
  stickyNote: Type.String(),
  items: Type.Array(Type.Object({
    id: Type.String(),
    text: Type.String(),
    category: Type.String(),
    done: Type.Boolean(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type GroceryList = Type.Static<typeof grocerySchema>;
export default grocerySchema;
