import { expect, test } from "bun:test";
import * as S from "../src/document.js";
import { checkDocumentSchema } from "../src/document-schema.js";
import { validate } from "../src/validation.js";
import { MediaReferenceSchema } from "../src/media.js";

test("closed definitions preserve archive data requirements", () => {
  const schema = S.Document({
    invoice: S.Union([S.Number(), S.Null()]),
    mode: S.Union([S.Literal("daily"), S.Literal("practice")]),
    cells: S.Record(
      S.Object({ raw: S.String(), style: S.Optional(S.Object({ bold: S.Optional(S.Boolean()) })) }),
    ),
    decks: S.List(
      S.Object({
        id: S.String(),
        cards: S.List(S.Object({ id: S.String(), text: S.String() }), "id"),
      }),
      "id",
    ),
    lines: S.Array(S.String(), { minItems: 3, maxItems: 3 }),
    sets: S.Array(S.Integer({ minimum: 0 }), { uniqueItems: true }),
    bpm: S.Integer({ minimum: 40, maximum: 240 }),
    pixels: S.Array(S.String()),
    attachment: S.Optional(S.Media()),
  });
  checkDocumentSchema(schema);
  const value = {
    invoice: null,
    mode: "daily" as const,
    cells: { A1: { raw: "=1+2", style: { bold: true } } },
    decks: [{ id: "deck", cards: [{ id: "card", text: "Q" }] }],
    lines: ["a", "b", "c"],
    sets: [0, 2],
    bpm: 120,
    pixels: ["#fff", ""],
    future: true,
  };
  expect(validate(schema, value)).toBe(value);
  for (const change of [{ sets: [0, 0] }, { lines: ["a"] }, { bpm: 300 }, { invoice: false }])
    expect(() => validate(schema, { ...value, ...change })).toThrow();
});

test("schema checker rejects malformed definitions and arbitrary extensions", () => {
  for (const field of [
    { type: "string", minLength: "bad" },
    { type: "number", minimum: 4, maximum: 2 },
    { type: "string", default: "x" },
    { type: "string", format: "email" },
    { type: "string", pattern: ".*" },
    { $ref: "#/$defs/thing" },
    { type: "string", $id: "urn:thing" },
    { type: "string", $dynamicAnchor: "x" },
    { anyOf: [] },
    { enum: ["a"], type: false },
    { type: "array", items: { type: "string" }, uniqueItems: "yes" },
    { type: "object", properties: {}, required: ["missing"] },
    { type: "object", allOf: [] },
    { type: "object", $defs: {} },
  ])
    expect(() => checkDocumentSchema(S.Document({ value: field }))).toThrow();
  expect(() =>
    checkDocumentSchema({
      ...MediaReferenceSchema,
      "x-hitslop": { container: "atomic", media: true },
      required: [],
    }),
  ).toThrow();
});

test("schema keyword names remain legal ordinary data keys", () => {
  const properties = JSON.parse(
    '{"$ref":{"type":"string"},"default":{"type":"string"},"__proto__":{"type":"string"}}',
  );
  const schema = S.Document(properties);
  expect(() => checkDocumentSchema(schema)).not.toThrow();
  expect(() =>
    validate(schema, JSON.parse('{"$ref":"a","default":"b","__proto__":"c"}')),
  ).not.toThrow();
});
