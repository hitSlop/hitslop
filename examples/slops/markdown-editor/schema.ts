import * as Type from "typebox";

const markdownSchema = Type.Object({
  title: Type.String(),
  content: Type.String(),
  mode: Type.Union([Type.Literal("inplace"), Type.Literal("split"), Type.Literal("preview")]),
  theme: Type.Union([Type.Literal("paper"), Type.Literal("dark")]),
}, { additionalProperties: true });

export type MarkdownDoc = Type.Static<typeof markdownSchema>;
export default markdownSchema;
