import * as T from "typebox";
import { validate } from "../../../packages/schema/src/validation.ts";
export { validate };
export { validateDocument } from "./schema.ts";

export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
export type Step = { key: string } | { item: string };
export type Position = { before: string; after?: never } | { after: string; before?: never };
export type Op =
  | { op: "set"; path: Step[]; value: JSONValue }
  | { op: "unset" | "toggle"; path: Step[] }
  | { op: "increment"; path: Step[]; amount: number }
  | { op: "insert"; path: Step[]; value: JSONValue; position?: Position }
  | { op: "remove"; path: Step[]; id: string }
  | { op: "move"; path: Step[]; id: string; position: Position };
export type Request = { requestId: string; ops: Op[] } | { requestId: string; replace: { baseRevision: number; data: JSONValue } };
export type Snapshot = { revision: number; data: JSONValue };
export type ErrorCode = "invalid_request" | "invalid_path" | "invalid_operation" | "missing_target" | "missing_anchor" | "duplicate_id" | "identity_change" | "validation" | "stale_revision" | "request_reused" | "offline" | "rejected" | "unknown_outcome" | "batch_usage" | "closed" | "not_ready";
export type Failure = { ok: false; error: { code: ErrorCode; message: string } };
export type Result = { ok: true; revision: number } | Failure;
export class CommandError extends Error {
  constructor(public code: ErrorCode, message: string) { super(message); }
}
export const failure = (error: unknown): Failure => ({ ok: false, error: {
  code: error instanceof CommandError ? error.code : "validation",
  message: error instanceof Error ? error.message : String(error),
} });
export function fail(code: ErrorCode, message: string): never { throw new CommandError(code, message); }

const object = <P extends T.TProperties>(properties: P) => T.Object(properties, { additionalProperties: false });
const id = T.String({ minLength: 1 });
const path = T.Array(T.Union([object({ key: T.String() }), object({ item: id })]), { maxItems: 64 });
const position = T.Union([object({ before: id }), object({ after: id })]);
const op = T.Union([
  object({ op: T.Literal("set"), path, value: T.Unknown() }),
  object({ op: T.Literal("unset"), path }),
  object({ op: T.Literal("toggle"), path }),
  object({ op: T.Literal("increment"), path, amount: T.Number() }),
  object({ op: T.Literal("insert"), path, value: T.Unknown(), position: T.Optional(position) }),
  object({ op: T.Literal("remove"), path, id }),
  object({ op: T.Literal("move"), path, id, position }),
]);
export const RequestSchema = T.Union([
  object({ requestId: id, ops: T.Array(op, { minItems: 1, maxItems: 20000 }) }),
  object({ requestId: id, replace: object({ baseRevision: T.Integer({ minimum: 0 }), data: T.Unknown() }) }),
]);
export const OpsSchema = T.Array(op, { minItems: 1, maxItems: 20000 });

/** Stable request comparison across object-key order; JSON only. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
