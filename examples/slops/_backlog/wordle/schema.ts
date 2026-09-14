import * as Type from "typebox";

const gameStateSchema = Type.Object({
  targetWord: Type.String(),
  guesses: Type.Array(Type.String()),
  status: Type.Enum(["playing", "won", "lost"]),
  date: Type.Optional(Type.String()),
}, { additionalProperties: true });

const wordleSchema = Type.Object({
  mode: Type.Enum(["daily", "practice"]),
  daily: gameStateSchema,
  practice: gameStateSchema,
  stats: Type.Object({
    played: Type.Number(),
    won: Type.Number(),
    currentStreak: Type.Number(),
    maxStreak: Type.Number(),
    guessDistribution: Type.Record(Type.String(), Type.Number()),
  }, { additionalProperties: true }),
}, { additionalProperties: true });

export type GameState = Type.Static<typeof gameStateSchema>;
export type Wordle = Type.Static<typeof wordleSchema>;
export default wordleSchema;
