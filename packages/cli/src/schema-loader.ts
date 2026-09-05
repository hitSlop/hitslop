import { pathToFileURL } from "node:url";
import { assertJSON } from "@hitslop/schema/json";

type Result = { ok: true; schema: unknown } | { ok: false; error: string };

if (!process.send) throw new Error("Schema loader requires an IPC parent");

let result: Result;
try {
  const path = process.argv[2];
  if (!path) throw new Error("Missing schema path");
  const { default: schema } = await import(pathToFileURL(path).href);
  assertJSON(schema);
  result = { ok: true, schema };
} catch (error) {
  result = { ok: false, error: error instanceof Error ? error.message : String(error) };
}

// The parent owns shutdown, allowing IPC delivery before process exit.
setInterval(() => {}, 60_000);
process.send(result);
