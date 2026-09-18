import { expect, test } from "bun:test";
import { Compile } from "typebox/compile";
import { Check } from "typebox/value";
import * as S from "@hitslop/schema/document";
import { applyOps } from "../src/document-ops.ts";

const keys = ["", "a\nb", "a\rb", "a\u2028b", "a\u2029b", "a\0b", "__proto__", "constructor"];
for (const key of keys) {
  test(`record values and paths cover ${JSON.stringify(key)}`, () => {
    const schema = S.Document({ values: S.Record(S.Number()) });
    const good = { values: { [key]: 2 } },
      bad = { values: { [key]: "wrong" } };
    expect(Compile(schema).Check(good)).toBe(true);
    expect(Check(schema, good)).toBe(true);
    expect(Compile(schema).Check(bad)).toBe(false);
    expect(Check(schema, bad)).toBe(false);
    expect(S.validateDocument(schema, good)).toEqual(good);
    expect(() => S.validateDocument(schema, bad)).toThrow();
    const field = S.paths(schema).values.at(key);
    expect(S.read(good, field)).toBe(2);
    const path = field[S.pathInfo].steps;
    expect(applyOps(schema, good, [{ op: "set", path: [...path], value: 3 }]).data).toEqual({
      values: { [key]: 3 },
    });
    expect(() =>
      applyOps(schema, good, [{ op: "set", path: [...path], value: "wrong" }]),
    ).toThrow();
    expect(good.values[key]).toBe(2);
  });
}

test("legacy annotated record schemas require rebuilding", () => {
  const schema = S.Document({ values: S.Record(S.Number()) });
  schema.properties.values.patternProperties = { "^.*$": S.Number() };
  expect(() => S.validateDocument(schema, { values: {} })).toThrow("unrestricted record");
  expect(() => S.paths(schema).values.at("x")).toThrow("rebuilding");
});

for (const arrays of [false, true])
  for (const leaf of [1, {}, []]) {
    test(`document depth counts containers: ${arrays}/${JSON.stringify(leaf)}`, () => {
      const schema = S.Document({});
      const nested = (count: number) => {
        let value: any = leaf;
        for (let i = 0; i < count; i++) value = arrays ? [value] : { n: value };
        return { value };
      };
      const extra = typeof leaf === "object" ? 1 : 0;
      expect(() => S.prepareDocument(schema, nested(63 - extra))).not.toThrow();
      expect(() => S.prepareDocument(schema, nested(64 - extra))).toThrow("nesting");
    });
  }

for (const escaped of [false, true])
  for (const size of [1048575, 1048576, 1048577]) {
    test(`document bytes ${size}/${escaped}`, () => {
      const count = size - 11;
      const value = {
        text: escaped
          ? "\0".repeat(Math.floor(count / 6)) + "x".repeat(count % 6)
          : "x".repeat(count),
      };
      const schema = S.Document({ text: S.String() });
      expect(new TextEncoder().encode(JSON.stringify(value)).length).toBe(size);
      if (size <= 1048576) expect(S.prepareDocument(schema, value).bytes).toBe(size);
      else expect(() => S.prepareDocument(schema, value)).toThrow("1 MiB");
    });
  }
