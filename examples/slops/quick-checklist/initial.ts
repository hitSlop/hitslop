import type { Checklist } from "./schema";

const initial: Checklist = {
  title: "Little things, today",
  tasks: [
    { id: "first-draft", text: "Send the first draft", done: true, archived: false },
    { id: "walk", text: "Take a walk without my phone", done: false, archived: false },
    { id: "weekend", text: "Make a little room for the weekend", done: false, archived: false },
  ],
};

export default initial;
