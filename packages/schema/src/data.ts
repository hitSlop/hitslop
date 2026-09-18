import { assertJSON, validate } from "./validation.js";
import { checkDocumentSchema, documentDialect } from "./document-schema.js";
export { hitslopDocumentKeyword } from "./keywords.js";
export const checkDataSchema = checkDocumentSchema;

/** Definition validation and value validation share the same contract in every host. */
export function compileDataSchema(schema: Record<string, unknown>) {
  checkDocumentSchema(schema);
  return (value: unknown): void => {
    assertJSON(value);
    validate(schema, value);
  };
}

export function dataSchemaFromJSON(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("schema.ts must default-export a TypeBox JSON Schema object");
  assertJSON(value);
  const schema = { $schema: documentDialect, ...JSON.parse(JSON.stringify(value)) } as Record<
    string,
    unknown
  >;
  compileDataSchema(schema);
  return schema;
}
