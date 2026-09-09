import { BridgeMethods, BridgeReplySchema, type BridgeMethod, type BridgeParams, type BridgeResult } from "@hitslop/schema/bridge";
import { validate } from "@hitslop/schema/validation";
import { SlopError } from "./errors.js";

/** Bind each request to its response schema at the untyped WebKit boundary. */
export function createBridgeCall(postMessage: (request: unknown) => Promise<unknown>) {
  return async <M extends BridgeMethod>(method: M, params: NoInfer<BridgeParams<M>>): Promise<BridgeResult<M>> => {
    validate(BridgeMethods[method].params, params);
    const reply = validate(BridgeReplySchema, await postMessage({ method, ...params }));
    if (!reply.ok) throw new SlopError(reply.error.code, reply.error.message);
    // TS loses the indexed method/result correlation when selecting the schema;
    // the selected validator is the runtime proof for this one boundary cast.
    return validate(BridgeMethods[method].response, reply.value) as BridgeResult<M>;
  };
}
