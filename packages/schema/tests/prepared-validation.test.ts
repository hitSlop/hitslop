import { expect, test } from "bun:test";
import * as S from "../src/document.js";
import { prepareValidation, validate } from "../src/validation.js";

test("prepared validators are cached and never coerce or insert defaults", () => {
  const schema = S.Document({ count: S.Integer() });
  expect(prepareValidation(schema)).toBe(prepareValidation(schema));
  const missing = {},
    wrong = { count: "3" };
  expect(() => validate(schema, missing)).toThrow();
  expect(() => validate(schema, wrong)).toThrow();
  expect(missing).toEqual({});
  expect(wrong).toEqual({ count: "3" });
});

test("schemas arriving after startup still validate when runtime code generation is prohibited", async () => {
  const url = new URL("../src/validation.ts", import.meta.url).href;
  const program = `
    const {validate} = await import(${JSON.stringify(url)});
    validate({type:'number'}, 1);
    globalThis.Function = new Proxy(Function, {construct() {throw new Error('CSP disallows codegen')}});
    const schema = {type:'object', properties:{count:{type:'integer'}}, required:['count']};
    validate(schema, {count:1});
    let failed = false;
    try {validate(schema, {count:'1'})} catch {failed = true}
    if (!failed) process.exit(2);
  `;
  const process = Bun.spawn([Bun.argv[0]!, "-e", program], { stdout: "pipe", stderr: "pipe" });
  expect(await new Response(process.stderr).text()).toBe("");
  expect(await process.exited).toBe(0);
});
