import * as Type from "typebox";

const task = Type.Object(
  {
    id: Type.String(),
    time: Type.String(),
    title: Type.String(),
    done: Type.Boolean(),
    durationMinutes: Type.Optional(
      Type.Integer({ minimum: 15, maximum: 1440 }),
    ),
    color: Type.Optional(
      Type.Union([
        Type.Literal("sky"),
        Type.Literal("coral"),
        Type.Literal("mint"),
        Type.Literal("lilac"),
      ]),
    ),
  },
  { additionalProperties: true },
);

const day = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    date: Type.String(),
    tasks: Type.Array(task),
  },
  { additionalProperties: true },
);

const plannerSchema = Type.Object(
  {
    week: Type.String(),
    focus: Type.String(),
    days: Type.Array(day),
  },
  { additionalProperties: true },
);

export type Task = Type.Static<typeof task>;
export type Day = Type.Static<typeof day>;
export type Planner = Type.Static<typeof plannerSchema>;
export default plannerSchema;

export function tasksByTime<T extends { time: string }>(tasks: T[]): T[] {
  return [...tasks].sort((left, right) => {
    if (!left.time && right.time) return 1;
    if (left.time && !right.time) return -1;
    return left.time.localeCompare(right.time);
  });
}
