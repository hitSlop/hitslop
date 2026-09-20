import * as T from "typebox";

const identity = T.String({ minLength: 1, maxLength: 128 });
const path = T.String({ minLength: 1, maxLength: 4096 });
const base = {
  id: identity,
  documentPath: path,
  schemaHash: T.Optional(T.String({ maxLength: 1048576 })),
};
const mutation = { ...base, epoch: identity };
// Operation contents belong to the shared document runtime, never native schemas.
const operation = T.Object({}, { additionalProperties: true });
export const SocketRequestSchema = T.Union([
  T.Object({ ...base, method: T.Enum(["hello", "get", "schema"]) }, { additionalProperties: false }),
  T.Object({ ...mutation, method: T.Literal("apply"), op: operation }, { additionalProperties: false }),
  T.Object({ ...mutation, method: T.Literal("batch"), ops: T.Array(operation) }, { additionalProperties: false }),
  T.Object({ ...mutation, method: T.Literal("compact") }, { additionalProperties: false }),
  T.Object({ ...mutation, method: T.Literal("export"), format: T.Enum(["png", "pdf"]), output: path }, { additionalProperties: false }),
]);
export const SocketReplySchema = T.Object({
  ok: T.Boolean(),
  epoch: T.Optional(identity),
  state: T.Optional(T.Unknown()),
  schema: T.Optional(T.Unknown()),
  output: T.Optional(path),
  error: T.Optional(T.String()),
  retryable: T.Optional(T.Boolean()),
}, { additionalProperties: false });
export const SocketDiscoverySchema = T.Object({
  socket: path, epoch: identity, pid: T.Integer({ minimum: 1 }), documentPath: path,
}, { additionalProperties: false });
