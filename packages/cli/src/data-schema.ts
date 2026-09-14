import { dataSchemaFromJSON } from "@hitslop/schema";
import { isSyncSchema, envelopeSchema } from "@hitslop/schema/document";
import type { TSchema } from "typebox";
import { evaluateModule } from "./evaluate-module.ts";

export async function loadDataSchema(path: string, timeoutMs = 10_000): Promise<Record<string, unknown>> {
  const schema = dataSchemaFromJSON(await evaluateModule(path, "schema", timeoutMs));
  if (!isSyncSchema(schema)) throw new Error("schema.ts must export an S.Document schema");
  return dataSchemaFromJSON(envelopeSchema(schema as TSchema));
}
