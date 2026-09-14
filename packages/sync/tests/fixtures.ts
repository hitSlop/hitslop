import * as S from "../../schema/src/document.ts";

const task = S.Object({
  id: S.String(),
  text: S.Text(),
  done: S.Boolean(),
  archived: S.Boolean(),
});

export const checklist = S.Document({
  title: S.String(),
  tasks: S.List(task, "id"),
});

export const trip = {
  title: "Trip",
  tasks: [
    { id: "task-a", text: "Book hotel", done: false, archived: false },
    { id: "task-b", text: "Pack charger", done: false, archived: false },
  ],
};
