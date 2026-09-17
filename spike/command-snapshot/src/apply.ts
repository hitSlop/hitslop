import type { TSchema } from "typebox";
import { assertJSON, syncMeta, validateDocument } from "./schema.ts";
import { fail, OpsSchema, validate, type JSONValue, type Op, type Position, type Step } from "./protocol.ts";
import type { SchemaNode } from "./paths.ts";

type Slot = { schema: SchemaNode; value: JSONValue | undefined; parent?: Record<string, JSONValue> | JSONValue[]; key?: string | number; removable: boolean; identity?: string };
const object = (value: JSONValue | undefined): value is Record<string, JSONValue> => !!value && typeof value === "object" && !Array.isArray(value);
const put = (parent: any, key: string | number, value: JSONValue) => Object.defineProperty(parent, key, { value, enumerable: true, configurable: true, writable: true });

/** Resolve schema and data together. Numeric array addressing is never accepted. */
function resolve(root: SchemaNode, data: JSONValue, path: Step[]): Slot {
  let slot: Slot = { schema: root, value: data, removable: false };
  for (const step of path) {
    const meta = syncMeta(slot.schema);
    if ("key" in step) {
      if (!object(slot.value)) fail("missing_target", `Object for ${step.key} is missing`);
      if (slot.identity === step.key) fail("identity_change", "List identity is immutable");
      const record = meta?.container === "record";
      if (!record && meta?.container !== "map") fail("invalid_path", "This value is atomic");
      const child = record ? slot.schema.patternProperties?.["^.*$"] :
        Object.hasOwn(slot.schema.properties ?? {}, step.key) ? slot.schema.properties![step.key] : undefined;
      if (!child) fail("invalid_path", `Undeclared field: ${step.key}`);
      const parent = slot.value as Record<string, JSONValue>;
      slot = { schema: child!, value: Object.hasOwn(parent, step.key) ? parent[step.key] : undefined,
        parent, key: step.key, removable: record || !slot.schema.required?.includes(step.key) };
    } else {
      if (meta?.container !== "movable-list" || !Array.isArray(slot.value)) fail("invalid_path", "item requires an identity list");
      const list = slot.value as JSONValue[];
      const index = list.findIndex(item => object(item) && item[meta!.key!] === step.item);
      if (index < 0) fail("missing_target", `Item ${step.item} no longer exists`);
      slot = { schema: slot.schema.items!, value: list[index], parent: list, key: index, removable: false, identity: meta!.key! };
    }
  }
  return slot;
}

function placement(list: JSONValue[], key: string, position?: Position): number {
  if (!position) return list.length;
  const id = "before" in position ? position.before : position.after;
  const index = list.findIndex(item => object(item) && item[key] === id);
  if (index < 0) fail("missing_anchor", `Positioning item ${id} no longer exists`);
  return index + ("after" in position ? 1 : 0);
}

/** Preconditions: before is an already validated authoritative snapshot. Never mutates it. */
export function applyOps(schema: TSchema, before: JSONValue, ops: readonly Op[], timing?: { applyMs: number; validateMs: number }): JSONValue {
  const start = performance.now();
  try { assertJSON(ops, new Set(), 70); validate(OpsSchema, ops); }
  catch (error) { fail("invalid_request", String(error)); }
  let candidate = structuredClone(before);
  for (const op of ops) {
    const slot = resolve(schema, candidate, op.path);
    const meta = syncMeta(slot.schema);
    switch (op.op) {
      case "set": {
        if (!slot.parent || slot.key === undefined) fail("invalid_path", "Cannot set the document root");
        // Explicit subtree replacement is last-write-wins. Replacing an addressed
        // row must preserve its identity; callers use list verbs for membership.
        if (slot.identity && (!object(op.value) || op.value[slot.identity] !== (slot.value as Record<string, JSONValue>)[slot.identity]))
          fail("identity_change", "List identity is immutable");
        put(slot.parent, slot.key, structuredClone(op.value));
        break;
      }
      case "unset":
        if (!slot.removable || !slot.parent || slot.key === undefined) fail("invalid_operation", "Only optional fields and record entries may be unset");
        delete (slot.parent as any)[slot.key!];
        break;
      case "toggle":
        if (typeof slot.value !== "boolean") fail("invalid_operation", "toggle requires an existing boolean");
        put(slot.parent, slot.key!, !slot.value);
        break;
      case "increment":
        if (typeof slot.value !== "number" || !Number.isFinite(slot.value + op.amount)) fail("invalid_operation", "increment requires a finite number");
        put(slot.parent, slot.key!, (slot.value as number) + op.amount);
        break;
      case "insert": case "remove": case "move": {
        if (meta?.container !== "movable-list" || !Array.isArray(slot.value)) fail("invalid_operation", "Operation requires an identity list");
        const list = slot.value as JSONValue[], key = meta!.key!;
        if (op.op === "insert") {
          if (!object(op.value) || typeof op.value[key] !== "string" || !op.value[key]) fail("invalid_operation", `Insert requires ${key}`);
          const id = (op.value as Record<string, JSONValue>)[key];
          if (list.some(item => object(item) && item[key] === id)) fail("duplicate_id", `Item ${id} already exists`);
          list.splice(placement(list, key, op.position), 0, structuredClone(op.value));
        } else {
          const index = list.findIndex(item => object(item) && item[key] === op.id);
          if (index < 0) fail("missing_target", `Item ${op.id} no longer exists`);
          if (op.op === "move" && (op.position.before === op.id || op.position.after === op.id)) fail("invalid_operation", "Cannot position an item relative to itself");
          const [item] = list.splice(index, 1);
          if (op.op === "move") list.splice(placement(list, key, op.position), 0, item!);
        }
        break;
      }
    }
  }
  const applied = performance.now();
  try { validateDocument(schema, candidate); }
  catch (error) { fail("validation", error instanceof Error ? error.message : String(error)); }
  if (timing) { timing.applyMs = applied - start; timing.validateMs = performance.now() - applied; }
  return candidate;
}
