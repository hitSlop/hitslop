// Keep these aliases outside the compiled module: esbuild's identifier histogram
// includes type-only source text, and contract 1/1's minified bytes are sealed.
export type {
  SocketReply as Reply,
  SocketReplyCode as ReplyCode,
} from "@hitslop/schema/socket";

import type { SocketRequest } from "@hitslop/schema/socket";
/** Native handles export before dispatching requests to the JS session. */
export type Request = Exclude<SocketRequest, { method: "export" }>;
