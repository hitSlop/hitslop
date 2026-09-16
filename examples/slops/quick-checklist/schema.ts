import * as S from "@hitslop/schema/document";

const checklistSchema = S.Document({
  title: S.Text(),
  tasks: S.List(
    S.Object({
      id: S.String(),
      text: S.Text(),
      done: S.Boolean(),
      archived: S.Boolean(),
    }),
    "id",
  ),
});

export type Checklist = S.Static<typeof checklistSchema>;
export default checklistSchema;
