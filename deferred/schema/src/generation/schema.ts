import { Check, Meta } from "typebox/schema";
import { assertJSON } from "../json.js";
import { documentDialect } from "../document-schema.js";
/** Trusted protocol/codegen schemas are not authored document definitions. */
export function generatedSchema(value: unknown): Record<string, unknown> {
  assertJSON(value);
  if (!Check(Meta, Meta[documentDialect], value)) throw new Error("Invalid generated schema");
  return { $schema: documentDialect, ...JSON.parse(JSON.stringify(value)) };
}
