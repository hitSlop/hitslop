import { defineDocument, s } from "@hitslop/document";
export const checklist = defineDocument({
  title: s.text(),
  tasks: s.list(s.object({ text: s.text(), done: s.boolean() })),
});
export const fields = checklist.fields;
