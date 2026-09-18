import * as Type from "typebox";
import { expect, test } from "bun:test";
import * as S from "../src/document.ts";
import { compileDataSchema, dataSchemaFromJSON, hitslopDocumentKeyword } from "../src/data.ts";
import { validate } from "../src/validation.ts";

const task = S.Object({
  id: S.String(),
  text: S.String(),
  done: S.Boolean(),
  archived: S.Boolean(),
});

const checklist = S.Document({
  title: S.String(),
  tasks: S.List(task, "id"),
});

test("S.* mapping distinguishes text, lists, and atomic strings", () => {
  expect(S.documentMapping(checklist)).toEqual({
    container: "map",
    fields: {
      title: { container: "atomic" },
      tasks: {
        container: "list",
        key: "id",
        item: {
          container: "map",
          fields: {
            id: { container: "atomic" },
            text: { container: "atomic" },
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
  expect(packaged[hitslopDocumentKeyword]).toEqual({ version: 1, container: "map" });
  const tasks = (packaged.properties as Record<string, Record<string, unknown>> | undefined)?.tasks;
  expect(tasks?.[hitslopDocumentKeyword]).toEqual({ container: "list", key: "id" });
  const value = {
    title: "Trip",
    tasks: [{ id: "task-a", text: "Book hotel", done: false, archived: false, extra: true }],
  };
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
  expect(S.documentMapping(S.Array(S.String()))).toEqual({ container: "atomic" });
  // @ts-expect-error a missing identity field fails both types and runtime
  expect(() => S.List(S.Object({ text: S.String() }), "id")).toThrow("must be a property");
});

test("unknown extra JSON fields are preserved", () => {
  const value = { title: "Trip", tasks: [], mood: "ok" };
  expect(S.validateDocument(checklist, value)).toEqual(value);
});

test("S.Media is an atomic content-addressed descriptor", () => {
  const schema = S.Document({ photo: S.Optional(S.Media()) });
  expect(S.documentMapping(schema)).toEqual({
    container: "map",
    fields: { photo: { container: "atomic" } },
  });
  const value = {
    photo: { sha256: "a".repeat(64), mime: "image/png", filename: "shot.png", bytes: 12 },
  };
  expect(S.validateDocument(schema, value)).toEqual(value);
  expect(() =>
    S.validateDocument(schema, { photo: { sha256: "nope", mime: "image/png" } }),
  ).toThrow();
});

test("record mapping retains nested containers and rejects unsupported patterns", () => {
  expect(
    S.documentMapping(S.Record(S.Object({ text: S.String(), tasks: S.List(task, "id") }))),
  ).toMatchObject({
    container: "record",
    values: {
      container: "map",
      fields: { text: { container: "atomic" }, tasks: { container: "list" } },
    },
  });
  expect(() =>
    S.documentMapping({
      "x-hitslop": { container: "record" },
      patternProperties: { "^x": S.String() },
    }),
  ).toThrow("rebuilding");
});

test("disk envelopes validate separately from application data without coercion", () => {
  const schema = S.Document({ title: S.String() });
  const app = { title: "Hello", unknown: { preserve: true } };
  expect(S.validateDocument(schema, app)).toEqual(app);
  expect(
    validate(S.envelopeSchema(schema), {
      $slop: {
        format: 2,
        baseRevision: 0,
        documentId: "doc",
        schemaHash: "schema",
        authority: "local",
      },
      data: app,
    }).data,
  ).toEqual(app);
  expect(() => validate(S.envelopeSchema(schema), app)).toThrow();
  expect(() =>
    validate(S.envelopeSchema(schema), {
      $slop: {
        format: 2,
        baseRevision: 0,
        documentId: "doc",
        schemaHash: "schema",
        authority: "local",
      },
      data: { title: 1 },
    }),
  ).toThrow();
});

test("package boundaries require one v2 envelope and reject raw or future schemas", () => {
  const schema = S.Document({ title: S.String() });
  expect(S.applicationSchema(S.envelopeSchema(schema))).toEqual(schema);
  for (const input of [
    schema,
    {},
    { ...S.envelopeSchema(schema), additionalProperties: true },
    S.envelopeSchema({ ...schema, "x-hitslop": { version: 2, container: "map" } }),
  ]) {
    expect(() => S.applicationSchema(input)).toThrow("v2 document envelope");
  }
});

test("document limits reject non-JSON, excess depth, and oversized initial data", () => {
  const schema = S.Document({ value: S.Atomic(Type.Unknown()) });
  for (const value of [Infinity, undefined, new Date()])
    expect(() => S.validateDocument(schema, { value })).toThrow("plain JSON");
  let nested: unknown = {};
  for (let depth = 0; depth < 65; depth++) nested = { nested };
  expect(() => S.validateDocument(schema, { value: nested })).toThrow("nesting");
  expect(() => S.validateDocument(schema, { value: "x".repeat(1024 * 1024) })).toThrow("1 MiB");
});

test("unknown document annotations are rejected instead of falling back to atomic", () => {
  for (const marker of ["invalid", {}, { container: "unknown" }]) {
    expect(() => S.documentMapping({ type: "object", "x-hitslop": marker })).toThrow(
      "Unsupported x-hitslop container",
    );
  }
});
