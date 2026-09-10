import * as Type from "typebox";

const book = Type.Object(
  {
    id: Type.String(),
    title: Type.String(),
    author: Type.String(),
    rating: Type.Number(),
    status: Type.String(),
    notes: Type.Optional(Type.String()),
  },
  { additionalProperties: true },
);

const readingSchema = Type.Object(
  {
    memberName: Type.String(),
    memberSince: Type.String(),
    books: Type.Array(book),
  },
  { additionalProperties: true },
);

export type ReadingTracker = Type.Static<typeof readingSchema>;
export default readingSchema;
