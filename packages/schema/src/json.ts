import type { JSONValue } from "./bridge.js";

/** Reject values JSON.stringify would silently change or discard. */
export function assertJSON(value: unknown, ancestors = new Set<object>()): asserts value is JSONValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || value === null || ancestors.has(value)) throw new Error("Values must be plain JSON");
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error("Values must be plain JSON, not class instances");
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) assertJSON(value[i], ancestors);
  } else {
    for (const child of Object.values(value)) assertJSON(child, ancestors);
  }
  ancestors.delete(value);
}
