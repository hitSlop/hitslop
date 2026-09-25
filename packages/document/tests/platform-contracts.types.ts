// Compile-only boundary checks: unsafe envelopes and replies must not become `any`.
import type { Request } from "../src/session-types";
import type { SocketRequest } from "@hitslop/schema/socket";
import type { BridgeRequest } from "@hitslop/schema/bridge";
import type { SlopRuntimeHandle } from "../src/runtime-handle";
import { hostCall } from "../src/bridge";

function contracts(handle: SlopRuntimeHandle) {
  // @ts-expect-error An edit without lifetime identity is unsafe.
  const missingEpoch: SocketRequest = { id: "edit", documentPath: "/doc", method: "apply", op: {} };
  const status: BridgeRequest<"status"> = { method: "status", status: "saved", error: null };
  // @ts-expect-error Nullable error is required, not optional.
  const missingError: BridgeRequest<"status"> = { method: "status", status: "saved" };
  // @ts-expect-error Attachment reads need an attachment ID, not bytes.
  hostCall({ method: "attachments.read", bytes: "AA==" });
  hostCall({ method: "load" }).then(reply => {
    const checkpoint: string | null = reply.checkpoint;
    // @ts-expect-error Load does not return config fields.
    const epoch: string = reply.epoch;
  });
  hostCall({ method: "config" }).then(reply => {
    const epoch: string = reply.epoch;
    // @ts-expect-error Method inference must not widen the reply to any.
    const bytes: string = reply.bytes;
  });
  // @ts-expect-error The JS session alias excludes native export too.
  const jsExport: Request = { id: "export", documentPath: "/doc", method: "export", epoch: "current", format: "png", output: "/out.png" };
  // @ts-expect-error Swift handles export; JS sessions must not accept it.
  handle.request({ id: "export", documentPath: "/doc", method: "export", epoch: "current", format: "png", output: "/out.png" });
  handle.request({ id: "read", documentPath: "/doc", method: "get" });
  // @ts-expect-error Native lifecycle request keeps the socket epoch requirement.
  handle.request({ id: "edit", documentPath: "/doc", method: "compact" });
}
