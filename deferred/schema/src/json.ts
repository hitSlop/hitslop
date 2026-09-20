export type JSONValue =
  null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
import type { DocumentMapping } from "./document.js";

/** WHATWG UTF-8 length, without allocating encoded bytes. */
export function utf8Length(value: string): number {
  if (!/[\u0080-\uffff]/.test(value)) return value.length;
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      value.charCodeAt(i + 1) >= 0xdc00 &&
      value.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Reject values JSON.stringify would silently change or discard. */
export function assertJSON(
  value: unknown,
  ancestors = new Set<object>(),
  remainingDepth = Infinity,
  mapping?: DocumentMapping,
): asserts value is JSONValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || value === null || ancestors.has(value))
    throw new Error("Values must be plain JSON");
  if (remainingDepth <= 0) throw new Error("JSON exceeds its nesting limit");
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw new Error("Values must be plain JSON, not class instances");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const list = mapping?.container === "list" ? mapping : undefined;
    const seen = list ? new Set<string>() : undefined;
    for (let i = 0; i < value.length; i++) {
      if (list) {
        const id = value[i]?.[list.key];
        if (typeof id !== "string" || id.length === 0)
          throw new Error(`List ${list.key} must be a non-empty string`);
        if (seen!.has(id)) throw new Error(`List contains duplicate ${list.key} "${id}"`);
        seen!.add(id);
      }
      assertJSON(value[i], ancestors, remainingDepth - 1, list?.item);
    }
  } else {
    for (const [key, child] of Object.entries(value)) {
      const node =
        mapping?.container === "map"
          ? mapping.fields[key]
          : mapping?.container === "record"
            ? mapping.values
            : undefined;
      assertJSON(child, ancestors, remainingDepth - 1, node);
    }
  }
  ancestors.delete(value);
}
