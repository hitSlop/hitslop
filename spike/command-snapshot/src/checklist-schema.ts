import * as S from "./schema.ts";
import { paths } from "./paths.ts";

const task = S.Object({ id: S.String(), text: S.Text(), done: S.Boolean(), archived: S.Boolean() });
export const schema = S.Document({ title: S.Text(), tasks: S.List(task, "id") });
export const fields = paths(schema);
export type Checklist = S.Static<typeof schema>;
export type Task = Checklist["tasks"][number];
export const initial: Checklist = {
  title: "Little things, today",
  tasks: [
    { id: "first-draft", text: "Send the first draft", done: true, archived: false },
    { id: "walk", text: "Take a walk without my phone", done: false, archived: false },
    { id: "weekend", text: "Make a little room for the weekend", done: false, archived: false },
  ],
};
export const counterSchema = S.Document({ count: S.Integer() });
export const counterPaths = paths(counterSchema);
