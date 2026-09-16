import { call } from "@hitslop/svelte/collections";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
// These expressions are type-checked but never imported by the app.
call(api.todos.insert, { title: "Valid", completed: false, createdAt: 1 });
// @ts-expect-error wrong field type
call(api.todos.insert, { title: "Invalid", completed: "no", createdAt: 1 });
// @ts-expect-error unknown field
call(api.todos.insert, { title: "Invalid", completed: false, createdAt: 1, other: true });
// @ts-expect-error missing required field
call(api.todos.insert, { title: "Invalid", completed: false });
// @ts-expect-error arbitrary string is not a typed ID
call(api.todos.update, { id: "untyped", changes: { completed: true } });
call(api.todos.update, { id: "typed" as Id<"todos">, changes: { completed: true } });
// @ts-expect-error index must be declared in schema.ts
call(api.todos.find, { index: "missing" });
