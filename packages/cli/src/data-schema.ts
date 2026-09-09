import { dataSchemaFromJSON } from "@hitslop/schema";
import { evaluateModule } from "./evaluate-module.ts";

export async function loadDataSchema(path: string, timeoutMs = 10_000): Promise<Record<string, unknown>> {
  return dataSchemaFromJSON(await evaluateModule(path, "schema", timeoutMs));
}
