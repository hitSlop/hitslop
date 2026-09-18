import * as S from "@hitslop/schema/document";

const checklistSchema = S.Document({
  title: S.String(),
  tasks: S.List(
    S.Object({
      id: S.String(),
      text: S.String(),
      done: S.Boolean(),
      archived: S.Boolean(),
    }),
    "id",
  ),
});

export type Checklist = S.Static<typeof checklistSchema>;
export default checklistSchema;
