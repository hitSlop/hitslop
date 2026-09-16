import { documentStore } from "@hitslop/svelte";
import schema from "../quick-checklist/schema";
import type { Checklist } from "../quick-checklist/schema";

// Type-only regression checks; this module is never an application entrypoint.
if (false) {
  const store = documentStore({ schema, initial: { title: "Typed", tasks: [] } });
  const document = store.current;
  document.tasks.map((task) => task.done);
  // @ts-expect-error initial cannot widen the authored schema's data type
  documentStore({ schema, initial: { title: 1, tasks: [] } });
  // @ts-expect-error nested edits remain schema-typed
  store.current.tasks.push({ id: "bad", text: "bad", done: "yes", archived: false });
  // @ts-expect-error required fields remain required
  documentStore({ schema, initial: { tasks: [] } });
}
