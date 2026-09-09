import type { Static, TSchema } from "typebox";
import { Check, Errors } from "typebox/value";
export { assertJSON } from "./json.js";

/** Validate without parsing, coercing, inserting defaults, or stripping fields. */
export function validate<S extends TSchema>(schema: S, value: unknown): Static<S> {
  if (!Check(schema, value)) {
    const detail = Errors(schema, value).map(error => `${error.instancePath || "value"}: ${error.message}`).join("; ");
    throw new Error(`JSON schema validation failed: ${detail}`);
  }
  return value;
}
