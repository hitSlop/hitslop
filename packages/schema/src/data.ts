import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { assertJSON, validate } from "./validation.js";

const dataSchemaDialect = "https://json-schema.org/draft/2020-12/schema";

/** Tooling only: check the packaged schema itself, then validate with TypeBox. */
export function compileDataSchema(schema: Record<string, unknown>) {
  if (schema.$schema !== undefined && schema.$schema !== dataSchemaDialect) {
    throw new Error("Document schemas must use JSON Schema draft 2020-12");
  }
  const ajv = new Ajv2020({ strictSchema: true, strictTypes: false, strictTuples: false, validateFormats: true });
  addFormats(ajv);
  ajv.compile(schema);
  return (value: unknown): void => { assertJSON(value); validate(schema, value); };
}

export function dataSchemaFromJSON(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("schema.ts must default-export a TypeBox JSON Schema object");
  assertJSON(value);
  const schema = { $schema: dataSchemaDialect, ...JSON.parse(JSON.stringify(value)) } as Record<string, unknown>;
  compileDataSchema(schema);
  return schema;
}
