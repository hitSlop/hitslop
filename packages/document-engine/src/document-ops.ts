import { assertJSON } from "@hitslop/schema/json";
import type { TSchema } from "typebox";
import {
  documentMeta,
  recordValueSchema,
  prepareDocument,
  type DocumentTrace,
} from "@hitslop/schema/document";
import {
  fail,
  OpsSchema,
  validate,
  type JSONValue,
  type Op,
  type Position,
  type Step,
} from "@hitslop/schema/document-protocol";
import type { SchemaNode } from "@hitslop/schema/document";

type Slot = {
  schema: SchemaNode;
  value: JSONValue | undefined;
  parent?: Record<string, JSONValue> | JSONValue[];
  key?: string | number;
  removable: boolean;
  identity?: string;
};
const object = (value: JSONValue | undefined): value is Record<string, JSONValue> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const put = (parent: any, key: string | number, value: JSONValue) =>
  Object.defineProperty(parent, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });

/** Resolve schema and data together. Numeric array addressing is never accepted. */
function resolve(root: SchemaNode, data: JSONValue, path: Step[], own: (slot: Slot) => void): Slot {
  let slot: Slot = { schema: root, value: data, removable: false };
  for (const step of path) {
    own(slot);
    const meta = documentMeta(slot.schema);
    if ("key" in step) {
      if (!object(slot.value)) fail("missing_target", `Object for ${step.key} is missing`);
      if (slot.identity === step.key) fail("identity_change", "List identity is immutable");
      const record = meta?.container === "record";
      if (!record && meta?.container !== "map") fail("invalid_path", "This value is atomic");
      const child = record
        ? recordValueSchema(slot.schema)
        : Object.hasOwn(slot.schema.properties ?? {}, step.key)
          ? slot.schema.properties![step.key]
          : undefined;
      if (!child) fail("invalid_path", `Undeclared field: ${step.key}`);
      const parent = slot.value as Record<string, JSONValue>;
      slot = {
        schema: child!,
        value: Object.hasOwn(parent, step.key) ? parent[step.key] : undefined,
        parent,
        key: step.key,
        removable: record || !slot.schema.required?.includes(step.key),
      };
    } else {
      if (meta?.container !== "list" || !Array.isArray(slot.value))
        fail("invalid_path", "item requires an identity list");
      const list = slot.value as JSONValue[];
      const index = list.findIndex((item) => object(item) && item[meta!.key!] === step.item);
      if (index < 0) fail("missing_target", `Item ${step.item} no longer exists`);
      slot = {
        schema: slot.schema.items!,
        value: list[index],
        parent: list,
        key: index,
        removable: false,
        identity: meta!.key!,
      };
    }
  }
  own(slot);
  return slot;
}

function placement(list: JSONValue[], key: string, position?: Position): number {
  if (!position) return list.length;
  const id = "before" in position ? position.before : position.after;
  const index = list.findIndex((item) => object(item) && item[key] === id);
  if (index < 0) fail("missing_anchor", `Positioning item ${id} no longer exists`);
  return index + ("after" in position ? 1 : 0);
}

/** Preconditions: before is an already validated authoritative snapshot. Never mutates it. */
export function applyOps(
  schema: TSchema,
  before: JSONValue,
  ops: readonly Op[],
  trace?: DocumentTrace,
): ReturnType<typeof prepareDocument> {
  try {
    assertJSON(ops, new Set(), 70);
    validate(OpsSchema, ops);
  } catch (error) {
    fail("invalid_request", String(error));
  }
  trace?.("mutation", true);
  let candidate: JSONValue;
  try {
    const owned = new WeakSet<object>();
    const copy = (value: JSONValue): JSONValue => {
      if (!value || typeof value !== "object") return value;
      const result = Array.isArray(value) ? value.slice() : { ...value };
      owned.add(result);
      return result;
    };
    candidate = copy(before);
    const own = (slot: Slot) => {
      if (slot.value && typeof slot.value === "object" && !owned.has(slot.value)) {
        slot.value = copy(slot.value);
        if (slot.parent && slot.key !== undefined) put(slot.parent, slot.key, slot.value);
      }
    };
    for (const op of ops) {
      const slot = resolve(schema, candidate, op.path, own);
      const meta = documentMeta(slot.schema);
      switch (op.op) {
        case "set": {
          if (!slot.parent || slot.key === undefined)
            fail("invalid_path", "Cannot set the document root");
          // Explicit subtree replacement is last-write-wins. Replacing an addressed
          // row must preserve its identity; callers use list verbs for membership.
          if (
            slot.identity &&
            (!object(op.value) ||
              op.value[slot.identity] !== (slot.value as Record<string, JSONValue>)[slot.identity])
          )
            fail("identity_change", "List identity is immutable");
          put(slot.parent, slot.key, structuredClone(op.value));
          break;
        }
        case "unset":
          if (!slot.removable || !slot.parent || slot.key === undefined)
            fail("invalid_operation", "Only optional fields and record entries may be unset");
          delete (slot.parent as any)[slot.key!];
          break;
        case "toggle":
          if (typeof slot.value !== "boolean")
            fail("invalid_operation", "toggle requires an existing boolean");
          put(slot.parent, slot.key!, !slot.value);
          break;
        case "increment":
          if (typeof slot.value !== "number" || !Number.isFinite(slot.value + op.amount))
            fail("invalid_operation", "increment requires a finite number");
          put(slot.parent, slot.key!, (slot.value as number) + op.amount);
          break;
        case "insert":
        case "remove":
        case "move": {
          if (meta?.container !== "list" || !Array.isArray(slot.value))
            fail("invalid_operation", "Operation requires an identity list");
          const list = slot.value as JSONValue[],
            key = meta!.key!;
          if (op.op === "insert") {
            if (!object(op.value) || typeof op.value[key] !== "string" || !op.value[key])
              fail("invalid_operation", `Insert requires ${key}`);
            const id = (op.value as Record<string, JSONValue>)[key];
            if (list.some((item) => object(item) && item[key] === id))
              fail("duplicate_id", `Item ${id} already exists`);
            list.splice(placement(list, key, op.position), 0, structuredClone(op.value));
          } else {
            const index = list.findIndex((item) => object(item) && item[key] === op.id);
            if (index < 0) fail("missing_target", `Item ${op.id} no longer exists`);
            if (op.op === "move" && (op.position.before === op.id || op.position.after === op.id))
              fail("invalid_operation", "Cannot position an item relative to itself");
            const [item] = list.splice(index, 1);
            if (op.op === "move") list.splice(placement(list, key, op.position), 0, item!);
          }
          break;
        }
      }
    }
  } finally {
    trace?.("mutation", false);
  }
  let prepared: ReturnType<typeof prepareDocument>;
  try {
    prepared = prepareDocument(schema, candidate, trace);
  } catch (error) {
    fail("validation", error instanceof Error ? error.message : String(error));
  }
  return prepared!;
}
