import * as Type from "typebox";

const task = Type.Object({
  id: Type.String(),
  text: Type.String(),
  done: Type.Boolean(),
}, { additionalProperties: true });

const matrixSchema = Type.Object({
  title: Type.String(),
  date: Type.String(),
  q1: Type.Array(task),
  q2: Type.Array(task),
  q3: Type.Array(task),
  q4: Type.Array(task),
  inbox: Type.Array(task),
}, { additionalProperties: true });

export type Matrix = Type.Static<typeof matrixSchema>;
export type Task = Matrix["q1"][number];
export default matrixSchema;
