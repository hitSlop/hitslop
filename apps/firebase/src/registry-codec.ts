import { Timestamp } from "firebase-admin/firestore";
import { validate } from "@hitslop/schema";
import type { Static, TSchema } from "typebox";

// Portable contracts use ISO timestamps; Firestore continues to store native timestamps.
function convert(schema: TSchema, value: unknown, direction: "read" | "write"): unknown {
  const node = schema as TSchema & { format?: string; type?: string; properties?: Record<string, TSchema>; items?: TSchema };
  if (node.format === "date-time") {
    if (direction === "write") return Timestamp.fromDate(new Date(value as string));
    if (!(value instanceof Timestamp)) throw new Error("Invalid registry timestamp");
    return value.toDate().toISOString();
  }
  if (node.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key, node.properties?.[key] ? convert(node.properties![key]!, entry, direction) : entry,
    ]));
  }
  if (node.type === "array" && Array.isArray(value)) return value.map(entry => convert(node.items!, entry, direction));
  return value;
}

export function readRegistryDocument<S extends TSchema>(schema: S, value: unknown): Static<S> {
  return validate(schema, convert(schema, value, "read"));
}

export function writeRegistryDocument<S extends TSchema>(schema: S, value: Static<S>): Record<string, unknown> {
  return convert(schema, validate(schema, value), "write") as Record<string, unknown>;
}
