import type { Static, TSchema } from "typebox";
import { Check, Errors } from "typebox/value";
import { Compile } from "typebox/compile";
export { assertJSON } from "./json.js";

type Prepared = { check(value: unknown): boolean };
const validators = new WeakMap<TSchema, Prepared>();

/** Cache once per immutable schema. CSP and Workers may prohibit runtime codegen. */
export function prepareValidation(schema: TSchema): Prepared {
  let prepared = validators.get(schema);
  if (prepared) return prepared;
  try {
    const compiled = Compile(schema);
    prepared = { check: (value) => compiled.Check(value) };
  } catch {
    prepared = { check: (value) => Check(schema, value) };
  }
  validators.set(schema, prepared);
  return prepared;
}

/** Validate without parsing, coercing, inserting defaults, or stripping fields. */
export function validate<S extends TSchema>(schema: S, value: unknown): Static<S> {
  if (!prepareValidation(schema).check(value)) {
    const detail = Errors(schema, value)
      .map((error) => `${error.instancePath || "value"}: ${error.message}`)
      .join("; ");
    throw new Error(`JSON schema validation failed: ${detail}`);
  }
  return value as Static<S>;
}
