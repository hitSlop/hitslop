import * as T from "typebox";
export const protocolVersion = 1;
const text = T.String({ maxLength: 4096 });
const bytes = T.String({ maxLength: 48 * 1024 * 1024 });
export const BridgeMethods = {
  "window.resize": T.Object({ method: T.Literal("window.resize"), width:T.Integer({minimum:240,maximum:4096}), height:T.Integer({minimum:180,maximum:4096}) }),
  config: T.Object({ method: T.Literal("config") }),
  ready: T.Object({ method: T.Literal("ready") }),
  load: T.Object({ method: T.Literal("load") }),
  append: T.Object({
    method: T.Literal("append"),
    generation: text,
    updates: T.Array(bytes, { maxItems: 4096 }),
  }),
  checkpoint: T.Object({
    method: T.Literal("checkpoint"),
    generation: text,
    bytes,
    schemaKey: T.String({ maxLength: 1048576 }),
  }),
  status: T.Object({
    method: T.Literal("status"),
    status: T.Enum(["saved", "saving", "save-failed"]),
    error: T.Union([text, T.Null()]),
  }),
  failed: T.Object({ method: T.Literal("failed"), error: text }),
  runtimeError: T.Object({
    method: T.Literal("runtimeError"),
    kind: T.Enum(["operation", "application"]),
    error: text,
  }),
} as const;
export const BridgeRequestSchema = T.Union(Object.values(BridgeMethods));
