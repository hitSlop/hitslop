import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import type { Static, TSchema, TObject } from "typebox";
import { Validator } from "typebox/schema";

export type Standard<T> = StandardSchemaV1<T> & StandardJSONSchemaV1<T>;

/** Based on TypeBox's MIT-licensed example/standard adapter (Haydn Paterson).
 * The schema is already JSON Schema. This adapter only supplies the standard interfaces.
 */
export function standard<S extends TSchema>(schema: S): Standard<Static<S>> {
  const validator = new Validator({}, schema);
  return standardValue(schema, (value) => {
    if (validator.Check(value)) return { value: value as Static<S> };
    const [, errors] = validator.Errors(value);
    return {
      issues: errors.map((error) => ({
        message: error.message,
        path:
          error.instancePath === ""
            ? []
            : error.instancePath
                .slice(1)
                .split("/")
                .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~")),
      })),
    };
  });
}

export function standardValue<T>(
  schema: object,
  validate: StandardSchemaV1.Props<T>["validate"],
): Standard<T> {
  const jsonSchema = ({ target }: StandardJSONSchemaV1.Options) => {
    if (target !== "draft-2020-12") throw new Error(`Unsupported schema target: ${target}`);
    return structuredClone(schema) as Record<string, unknown>;
  };
  return {
    "~standard": {
      version: 1,
      vendor: "typebox",
      validate,
      jsonSchema: { input: jsonSchema, output: jsonSchema },
    },
  };
}

/** Files are transport values, not JSON. Validate them separately from JSON fields. */
export function multipart<S extends TObject, K extends string>(
  fields: S,
  file: K,
): Standard<Static<S> & Record<K, File>> {
  const jsonFields = standard(fields);
  return standardValue(
    {
      ...fields,
      properties: { ...fields.properties, [file]: { type: "string", format: "binary" } },
      required: [...(fields.required ?? []), file],
    },
    async (value) => {
      if (!value || typeof value !== "object")
        return { issues: [{ message: "Expected multipart body" }] };
      const record = value as Record<string, unknown>;
      const { [file]: attachment, ...rest } = record;
      if (!(attachment instanceof File))
        return { issues: [{ message: "Expected file", path: [file] }] };
      const result = await jsonFields["~standard"].validate(rest);
      if (result.issues) return result;
      return { value: { ...result.value, [file]: attachment } as Static<S> & Record<K, File> };
    },
  );
}

export const binary = standardValue<Blob>({ type: "string", format: "binary" }, (value) =>
  value instanceof Blob ? { value } : { issues: [{ message: "Expected binary body" }] },
);
