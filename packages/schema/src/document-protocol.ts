import * as T from "typebox";
import { validate } from "./validation.js";
export { validate };
export { validateDocument } from "./document.js";

import type { JSONValue } from "./json.js";
export type { JSONValue } from "./json.js";
export type Step = { key: string } | { item: string };
export type Position = { before: string; after?: never } | { after: string; before?: never };
export type Op =
  | { op: "set"; path: Step[]; value: JSONValue }
  | { op: "unset" | "toggle"; path: Step[] }
  | { op: "increment"; path: Step[]; amount: number }
  | { op: "insert"; path: Step[]; value: JSONValue; position?: Position }
  | { op: "remove"; path: Step[]; id: string }
  | { op: "move"; path: Step[]; id: string; position: Position };
export type Command =
  | { requestId: string; ops: Op[] }
  | { requestId: string; undo: { requestId: string; revision: number } }
  | { requestId: string; replace: { baseRevision: number; data: JSONValue } };
export type Identity = { documentId: string; schemaHash: string; authority: string };
export type Lease = { id: string; expiresAt: number };
export type Request = Command & Identity & { leaseId: string };
export type Snapshot = Identity & { revision: number; data: JSONValue };
export type Open = {
  snapshot: Snapshot;
  lease: Lease;
  status?: { connected: boolean; writable: boolean };
};
export const RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const errorCodes = [
  "invalid_request",
  "invalid_path",
  "invalid_operation",
  "missing_target",
  "missing_anchor",
  "duplicate_id",
  "identity_change",
  "validation",
  "stale_revision",
  "request_reused",
  "offline",
  "rejected",
  "unknown_outcome",
  "batch_usage",
  "closed",
  "not_ready",
  "authority_changed",
  "lease_expired",
  "storage_unavailable",
] as const;
export type ErrorCode = (typeof errorCodes)[number];
export type Failure = { ok: false; error: { code: ErrorCode; message: string } };
export type Result = { ok: true; revision: number } | Failure;
export class CommandError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export const failure = (error: unknown): Failure => ({
  ok: false,
  error: {
    code: error instanceof CommandError ? error.code : "validation",
    message: error instanceof Error ? error.message : String(error),
  },
});
export function fail(code: ErrorCode, message: string): never {
  throw new CommandError(code, message);
}

const object = <P extends T.TProperties>(properties: P) =>
  T.Object(properties, { additionalProperties: false });
const id = T.String({ minLength: 1 });
const path = T.Array(T.Union([object({ key: T.String() }), object({ item: id })]), {
  maxItems: 64,
});
const position = T.Union([object({ before: id }), object({ after: id })]);
export const OpSchema = T.Union([
  object({ op: T.Literal("set"), path, value: T.Unknown() }),
  object({ op: T.Literal("unset"), path }),
  object({ op: T.Literal("toggle"), path }),
  object({ op: T.Literal("increment"), path, amount: T.Number() }),
  object({ op: T.Literal("insert"), path, value: T.Unknown(), position: T.Optional(position) }),
  object({ op: T.Literal("remove"), path, id }),
  object({ op: T.Literal("move"), path, id, position }),
]);
export const OpsSchema = T.Array(OpSchema, { minItems: 1, maxItems: 20000 });
const identity = { documentId: id, schemaHash: id, authority: id, leaseId: id };
export const RequestSchema = T.Union([
  object({ ...identity, requestId: id, ops: OpsSchema }),
  object({
    ...identity,
    requestId: id,
    undo: object({
      requestId: id,
      revision: T.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    }),
  }),
  object({
    ...identity,
    requestId: id,
    replace: object({
      baseRevision: T.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
      data: T.Unknown(),
    }),
  }),
]);
const revision = T.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
export const SnapshotSchema = object({
  documentId: id,
  schemaHash: id,
  authority: id,
  revision,
  data: T.Unknown(),
});
export const LeaseSchema = object({
  id,
  expiresAt: T.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
});
export const OpenSchema = object({
  snapshot: SnapshotSchema,
  lease: LeaseSchema,
  status: T.Optional(object({ connected: T.Boolean(), writable: T.Boolean() })),
});
export const ResultSchema = T.Union([
  object({ ok: T.Literal(true), revision }),
  object({
    ok: T.Literal(false),
    error: object({
      code: T.Enum(errorCodes),
      message: T.String(),
    }),
  }),
]);

/** Stable request comparison across object-key order; JSON only. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
