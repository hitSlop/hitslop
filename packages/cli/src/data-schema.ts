import { dataSchemaFromJSON } from "@hitslop/schema";
import { envelopeSchema, isDocumentSchema } from "@hitslop/schema/document";
import type { TSchema } from "typebox";
import { evaluateModule } from "./evaluate-module.ts";

export async function loadDataSchema(
  path: string,
  timeoutMs = 10_000,
): Promise<Record<string, unknown>> {
  const authored = await evaluateModule(path, "schema", timeoutMs);
  if (isDocumentSchema(authored)) return dataSchemaFromJSON(envelopeSchema(authored as TSchema));
  throw new Error("schema.ts must default-export an S.Document schema (v1)");
}
