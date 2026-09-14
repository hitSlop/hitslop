import * as Type from "typebox";

const cardSchema = Type.Object({
  id: Type.String(),
  front: Type.String(),
  back: Type.String(),
  box: Type.Integer(),
  lastReviewed: Type.Union([Type.String(), Type.Null()]),
}, { additionalProperties: true });

const deckSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  cards: Type.Array(cardSchema),
}, { additionalProperties: true });

const flashcardsSchema = Type.Object({
  decks: Type.Array(deckSchema),
  selectedDeckId: Type.String(),
  selectedBox: Type.Integer(),
  cardIndex: Type.Integer(),
  flipped: Type.Boolean(),
}, { additionalProperties: true });

export type Flashcards = Type.Static<typeof flashcardsSchema>;
export type Flashcard = Type.Static<typeof cardSchema>;
export default flashcardsSchema;
