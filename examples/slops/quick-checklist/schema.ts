import * as Type from "typebox";

const checklistSchema = Type.Object({
  title: Type.String(),
  tasks: Type.Array(Type.Object({
    id: Type.String(),
    text: Type.String(),
    done: Type.Boolean(),
    archived: Type.Boolean(),
  }, { additionalProperties: true })),
}, { additionalProperties: true });

export type Checklist = Type.Static<typeof checklistSchema>;
export default checklistSchema;
