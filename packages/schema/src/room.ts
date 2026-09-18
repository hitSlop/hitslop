import * as Type from "typebox";
import { Sha256Schema } from "./publish.js";
import { OpenSchema, SnapshotSchema, RequestSchema, ResultSchema } from "./document-protocol.js";

export const roomProtocol = 3;
export const DocumentIdSchema = Type.String({ pattern: "^[a-zA-Z0-9-]{1,80}$" });
const protocol = Type.Literal(roomProtocol);
const object = <P extends Type.TProperties>(title: string, properties: P) =>
  Type.Object(properties, { title, additionalProperties: false });
export const RoomPeerSchema = object("RoomPeer", { id: Type.String(), name: Type.String() });
const peers = Type.Array(RoomPeerSchema, { maxItems: 20 });
const identity = { documentId: DocumentIdSchema, schema: Sha256Schema };
export const roomServerVariants = {
  welcome: object("RoomWelcome", { type: Type.Literal("welcome"), protocol, peers }),
  presence: object("RoomPresence", { type: Type.Literal("presence"), peers }),
  ready: object("RoomReady", { type: Type.Literal("ready"), open: OpenSchema, peers }),
  snapshot: object("RoomSnapshotMessage", {
    type: Type.Literal("snapshot"),
    snapshot: SnapshotSchema,
  }),
  result: object("RoomResultMessage", {
    type: Type.Literal("result"),
    requestId: Type.String(),
    leaseId: Type.String(),
    authority: Type.String(),
    result: ResultSchema,
  }),
  error: object("RoomError", {
    type: Type.Literal("error"),
    status: Type.Integer({ minimum: 400, maximum: 599 }),
    message: Type.String(),
  }),
};
export const roomClientVariants = {
  hello: object("RoomHello", { type: Type.Literal("hello"), protocol, ...identity }),
  execute: object("RoomExecute", {
    type: Type.Literal("execute"),
    protocol,
    request: RequestSchema,
  }),
};
export const RoomMessageSchema = Type.Union(
  [
    roomServerVariants.welcome,
    roomServerVariants.presence,
    roomServerVariants.ready,
    roomServerVariants.snapshot,
    roomServerVariants.result,
    roomServerVariants.error,
  ],
  { title: "RoomServerMessage" },
);
export const RoomClientMessageSchema = Type.Union(
  [roomClientVariants.hello, roomClientVariants.execute],
  { title: "RoomClientMessage" },
);
export const RoomSeedInputSchema = object("RoomSeedInput", {
  protocol,
  documentId: DocumentIdSchema,
  snapshot: SnapshotSchema,
});
export const RoomSeedSchema = object("RoomSeed", { protocol, snapshot: SnapshotSchema });
export const RoomSessionSchema = object("RoomSession", { token: Type.String(), ...identity });
export const RoomInitializedSchema = object("RoomInitialized", {
  roomId: DocumentIdSchema,
  protocol,
});
export type RoomMessage = Type.Static<typeof RoomMessageSchema>;
export type RoomClientMessage = Type.Static<typeof RoomClientMessageSchema>;
export type RoomSeedInput = Type.Static<typeof RoomSeedInputSchema>;
export type RoomSeed = Type.Static<typeof RoomSeedSchema>;
