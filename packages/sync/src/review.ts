import type { SyncNode } from "@hitslop/schema/document";
import { canonical } from "./encoding.js";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const atomic: SyncNode = { container: "atomic" };
const display = (value: unknown) => value === undefined ? "(absent)" : JSON.stringify(value, null, 2);
/** Complete field differences; collection items are paired by domain ID, not index. */
export function describeChanges(mapping: SyncNode, before: unknown, after: unknown, path = "data"): string {
  if (canonical(before) === canonical(after)) return "";
  if (mapping.container === "map" || mapping.container === "record") {
    const a = object(before), b = object(after);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map(key =>
      describeChanges(mapping.container === "record" ? mapping.values : mapping.fields[key] ?? atomic,
        a[key], b[key], `${path}.${key}`)).filter(Boolean).join("\n\n");
  }
  if (mapping.container === "movable-list" && Array.isArray(before) && Array.isArray(after)) {
    const key = mapping.key;
    const a = new Map(before.map(value => [object(value)[key], value]));
    const b = new Map(after.map(value => [object(value)[key], value]));
    const changes: string[] = [];
    if (canonical([...a.keys()]) !== canonical([...b.keys()])) changes.push(`${path} order\nBefore: ${display([...a.keys()])}\nAfter: ${display([...b.keys()])}`);
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const itemPath = `${path}[${key}=${JSON.stringify(id)}]`;
      changes.push(describeChanges(a.has(id) && b.has(id) ? mapping.item : atomic, a.get(id), b.get(id), itemPath));
    }
    return changes.filter(Boolean).join("\n\n");
  }
  return `${path}\nBefore: ${display(before)}\nAfter: ${display(after)}`;
}
