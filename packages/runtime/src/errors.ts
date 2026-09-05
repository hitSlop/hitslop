import type { BridgeErrorCode } from "@hitslop/schema/bridge";

export class SlopError extends Error {
  constructor(readonly code: BridgeErrorCode, message: string) { super(message); this.name = "SlopError"; }
}
