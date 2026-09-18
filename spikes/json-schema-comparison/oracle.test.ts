import { expect, test } from "bun:test";
import { preservedJSON } from "./oracle.ts";

test("oracle detects Unicode key/value loss without canonical normalization", () => {
  expect(preservedJSON('{"é":1,"e\\u0301":2}', '{"é":1}')).toBe(false);
  expect(preservedJSON('{"é":1,"e\\u0301":2}', '{"e\\u0301":2,"é":1}')).toBe(true);
  expect(preservedJSON('"é"', '"e\\u0301"')).toBe(false);
  expect(preservedJSON('"\\ud800"', '"�"')).toBe(false);
});
test("oracle ignores JSON formatting and preserves guest numeric semantics", () => {
  expect(preservedJSON('{"a":1,"b":[true,null]}', '{"b":[true,null],"a":1.0}')).toBe(true);
  expect(preservedJSON("-0", "0")).toBe(true);
  expect(preservedJSON("[1,2]", "[2,1]")).toBe(false);
  expect(preservedJSON('{"__proto__":1}', "{}")).toBe(false);
  expect(preservedJSON('{"missing":null}', "{}")).toBe(false);
});
