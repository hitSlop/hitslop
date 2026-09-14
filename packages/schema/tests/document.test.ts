import { expect, test } from "bun:test";
import * as S from "../src/document.ts";
import { compileDataSchema, dataSchemaFromJSON, hitslopSyncKeyword } from "../src/data.ts";
import { validate } from "../src/validation.ts";

const task = S.Object({
  id: S.String(),
  text: S.Text(),
  done: S.Boolean(),
  archived: S.Boolean(),
});

const checklist = S.Document({
  title: S.String(),
  tasks: S.List(task, "id"),
});

test("S.* mapping distinguishes text, lists, and atomic strings", () => {
  expect(S.syncMapping(checklist)).toEqual({
    container: "map",
    fields: {
      title: { container: "atomic" },
      tasks: {
        container: "movable-list",
        key: "id",
        item: {
          container: "map",
          fields: {
            id: { container: "atomic" },
            text: { container: "text" },
            done: { container: "atomic" },
            archived: { container: "atomic" },
          },
        },
      },
    },
  });
});

test("packaged JSON Schema keeps x-hitslop and still validates like TypeBox", () => {
  const packaged = dataSchemaFromJSON(checklist);
  expect(packaged[hitslopSyncKeyword]).toEqual({ version: 1, container: "map" });
  const tasks = (packaged.properties as Record<string, Record<string, unknown>> | undefined)?.tasks;
  expect(tasks?.[hitslopSyncKeyword]).toEqual({ container: "movable-list", key: "id" });
  const value = { title: "Trip", tasks: [{ id: "task-a", text: "Book hotel", done: false, archived: false, extra: true }] };
  const check = compileDataSchema(packaged);
  expect(() => check(value)).not.toThrow();
  expect(S.validateDocument(checklist, value)).toBe(value);
  expect(validate(checklist, value)).toBe(value);
});

test("duplicate list ids fail after JSON Schema succeeds", () => {
  const value = {
    title: "Trip",
    tasks: [
      { id: "task-a", text: "A", done: false, archived: false },
      { id: "task-a", text: "B", done: false, archived: false },
    ],
  };
  expect(() => validate(checklist, value)).not.toThrow();
  expect(() => S.validateDocument(checklist, value)).toThrow("duplicate id");
});

test("S.Array stays atomic and S.List requires the key on the item", () => {
  expect(S.syncMapping(S.Array(S.String()))).toEqual({ container: "atomic" });
  expect(() => S.List(S.Object({ text: S.String() }), "id")).toThrow("must be a property");
});

test("unknown extra JSON fields are preserved", () => {
  const value = { title: "Trip", tasks: [], mood: "ok" };
  expect(S.validateDocument(checklist, value)).toEqual(value);
});

test("record mapping retains nested containers and rejects unsupported patterns", () => {
  expect(S.syncMapping(S.Record(S.Object({ text: S.Text(), tasks: S.List(task, "id") })))).toMatchObject({
    container: "record", values: { container: "map", fields: { text: { container: "text" }, tasks: { container: "movable-list" } } },
  });
  expect(() => S.syncMapping({ "x-hitslop": { container: "record" }, patternProperties: { "^x": S.Text() } })).toThrow("unrestricted");
});

test("disk envelopes validate separately from application data without coercion", async () => {
  const { envelopeSchema, validateDocument } = await import('../src/document');
  const { validate } = await import('../src/validation');
  const schema = S.Document({ title: S.String() });
  const app = { title: "Hello", unknown: { preserve: true } };
  expect(validateDocument(schema, app)).toEqual(app);
  expect(validate(envelopeSchema(schema), { $slop: { format: 1, baseRevision: "opaque" }, data: app }).data).toEqual(app);
  expect(() => validate(envelopeSchema(schema), app)).toThrow();
  expect(() => validate(envelopeSchema(schema), { $slop: { format: 1, baseRevision: "opaque" }, data: { title: 1 } })).toThrow();
});
