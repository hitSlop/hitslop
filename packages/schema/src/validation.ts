import type { Static, TSchema } from "typebox";
import { Check } from "typebox/value";
export function validate<S extends TSchema>(schema:S,value:unknown):Static<S> {
  if (!Check(schema,value)) throw new Error("Invalid platform contract");
  return value as Static<S>;
}
