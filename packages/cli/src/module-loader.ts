import { pathToFileURL } from "node:url";
import { assertJSON } from "@hitslop/schema/json";

type Result = { ok: true; value: unknown } | { ok: false; error: string };

if (!process.send) throw new Error("Module loader requires an IPC parent");

let result: Result;
try {
  const path = process.argv[2];
  if (!path) throw new Error("Missing module path");
  const kind = process.argv[3];
  if (kind !== "schema" && kind !== "theme") throw new Error("Unknown module kind");
  const { default: definition } = await import(pathToFileURL(path).href);
  const value = kind === "theme" ? definition?.css : definition;
  if (kind === "theme" && typeof value !== "string") throw new Error("theme.ts must default-export defineTheme(...)");
  assertJSON(value);
  result = { ok: true, value };
} catch (error) {
  result = { ok: false, error: error instanceof Error ? error.message : String(error) };
}

// The parent owns shutdown, allowing IPC delivery before process exit.
setInterval(() => {}, 60_000);
process.send(result);
