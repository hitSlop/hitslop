import { expect, test } from "bun:test";
import * as Type from "typebox";
import { compileDataSchema, dataSchemaFromJSON } from "../src/data.ts";
import { validate, assertJSON } from "../src/validation.ts";
import fixtures from "../../../apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/data-conformance.json";

test("independent schemas may reuse their document id", () => {
  for (let i = 0; i < 2; i++) expect(() => compileDataSchema({ $id: "urn:hitslop:test", type: "object" })).not.toThrow();
});
test("document schemas default to 2020-12 and reject incompatible explicit dialects", () => {
  const dialect = "https://json-schema.org/draft/2020-12/schema";
  expect(dataSchemaFromJSON({ type: "object" }).$schema).toBe(dialect);
  expect(dataSchemaFromJSON({ $schema: dialect, type: "object" }).$schema).toBe(dialect);
  for (const $schema of ["http://json-schema.org/draft-07/schema#", "https://example.com/custom", null, 3]) {
    expect(() => dataSchemaFromJSON({ $schema, type: "object" })).toThrow("draft 2020-12");
    expect(() => compileDataSchema({ $schema, type: "object" })).toThrow("draft 2020-12");
  }
});
test("TypeBox and packaged validation match shared native fixtures without mutation", () => {
  for (const fixture of fixtures) {
    const check = compileDataSchema(fixture.schema);
    for (const item of fixture.cases) {
      const before = JSON.stringify(item.value);
      if (item.valid) {
        expect(() => check(item.value)).not.toThrow();
        expect(Object.is(validate(fixture.schema, item.value), item.value)).toBe(true);
      } else {
        expect(() => check(item.value)).toThrow();
        expect(() => validate(fixture.schema, item.value)).toThrow();
      }
      expect(JSON.stringify(item.value)).toBe(before);
    }
  }
});
test("portable schema retains unknown fields and never fills defaults", () => {
  const source = Type.Object({ count: Type.Integer({ default: 0 }), items: Type.Array(Type.Object({ text: Type.String() }, { additionalProperties: true })) }, { additionalProperties: true });
  const check = compileDataSchema(dataSchemaFromJSON(source));
  const value = { count: 2, extra: true, items: [{ text: "a", extra: 3 }] };
  check(value);
  expect(validate(source, value)).toBe(value);
  expect(() => check({ items: [] })).toThrow();
  expect(() => check({ ...value, count: "2" })).toThrow();
});
test("reject malformed schemas and non-JSON values", () => {
  expect(() => dataSchemaFromJSON({ type: "bogus" })).toThrow();
  expect(() => dataSchemaFromJSON({ parse() {} })).toThrow("plain JSON");
  for (const value of [undefined, NaN, Infinity, new Date(), { x: undefined }, [, 1]]) expect(() => assertJSON(value)).toThrow();
  const cyclic: unknown[] = []; cyclic.push(cyclic);
  expect(() => assertJSON(cyclic)).toThrow();
});
test("rejects unknown assertions, formats, and unresolved references", () => {
  for (const schema of [
    { type: "string", format: "custom" },
    { type: "string", inventedAssertion: 1 },
    { $ref: "https://example.com/missing.json" },
  ]) expect(() => dataSchemaFromJSON(schema)).toThrow();
});

test("interpreted validation covers deep uniqueness and unevaluated properties", () => {
  const unique = compileDataSchema({ type: "array", uniqueItems: true });
  expect(() => unique([{ a: 1 }, { a: 2 }])).not.toThrow();
  expect(() => unique([{ a: 1 }, { a: 1 }])).toThrow();
  const evaluated = compileDataSchema({
    allOf: [{ properties: { title: { type: "string" } } }],
    unevaluatedProperties: false,
  });
  expect(() => evaluated({ title: "ok" })).not.toThrow();
  expect(() => evaluated({ other: true })).toThrow();
});
