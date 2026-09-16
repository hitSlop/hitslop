import * as Type from "typebox";
import { Sha256Schema } from "./publish.js";

/** The relay orders opaque Loro updates; cursors advance only after durable import. */
export const roomProtocol = 1;
export const DocumentIdSchema = Type.String({ pattern: "^[a-zA-Z0-9-]{1,80}$" });
const sequence = Type.Integer({ minimum: 1, maximum: 10000 });
const protocol = Type.Integer({ enum: [roomProtocol] });
const tag = <T extends string>(value: T) => Type.Unsafe<T>({ type: "string", enum: [value] });
const object = <P extends Type.TProperties>(title: string, properties: P) =>
  Type.Object(properties, { title, additionalProperties: false });
export const RoomBatchSchema = object("RoomBatch", {
  id: Type.String({ pattern: "^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$" }),
  hash: Sha256Schema,
  bytes: Type.String({ minLength: 1, maxLength: 699052 }),
});
export const RoomPeerSchema = object("RoomPeer", { id: Type.String(), name: Type.String() });
export const RoomUpdateSchema = object("RoomUpdate", {
  sequence: Type.Integer({ minimum: 2, maximum: 10000 }),
  batch: RoomBatchSchema,
});
const identity = { documentId: DocumentIdSchema, schema: Sha256Schema };
const peers = Type.Array(RoomPeerSchema, { maxItems: 20 });
export const roomServerVariants = {
  welcome: object("RoomWelcome", { type: tag("welcome"), protocol, bootId: Type.String(), peers }),
  presence: object("RoomPresence", { type: tag("presence"), peers }),
  updates: object("RoomUpdates", {
    type: tag("updates"),
    ...identity,
    updates: Type.Array(RoomUpdateSchema, { minItems: 1, maxItems: 32 }),
  }),
  ready: object("RoomReady", { type: tag("ready"), head: sequence, bootId: Type.String(), peers }),
  ack: object("RoomAck", {
    type: tag("ack"),
    id: RoomBatchSchema.properties.id,
    hash: Sha256Schema,
    sequence: Type.Integer({ minimum: 2, maximum: 10000 }),
  }),
  error: object("RoomError", {
    type: tag("error"),
    status: Type.Integer({ minimum: 400, maximum: 599 }),
    message: Type.String(),
  }),
};
export const roomClientVariants = {
  hello: object("RoomHello", {
    type: tag("hello"),
    protocol,
    ...identity,
    after: sequence,
    batchSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 32 })),
  }),
  applied: object("RoomApplied", { type: tag("applied"), sequence }),
  append: object("RoomAppend", {
    type: tag("append"),
    protocol,
    ...identity,
    batch: RoomBatchSchema,
  }),
};
export const RoomMessageSchema = Type.Union(
  [
    roomServerVariants.welcome,
    roomServerVariants.presence,
    roomServerVariants.updates,
    roomServerVariants.ready,
    roomServerVariants.ack,
    roomServerVariants.error,
  ],
  { title: "RoomServerMessage" },
);
export const RoomClientMessageSchema = Type.Union(
  [roomClientVariants.hello, roomClientVariants.applied, roomClientVariants.append],
  { title: "RoomClientMessage" },
);
export const RoomSeedInputSchema = object("RoomSeedInput", {
  protocol,
  ...identity,
  checkpoint: RoomBatchSchema.properties.bytes,
  version: Type.String({ minLength: 1, maxLength: 65536 }),
});
export const RoomSeedSchema = object("RoomSeed", {
  protocol,
  sequence: Type.Integer({ enum: [1] }),
  hash: Sha256Schema,
  snapshot: object("RoomSnapshot", {
    ...identity,
    checkpoint: RoomBatchSchema.properties.bytes,
    version: RoomSeedInputSchema.properties.version,
  }),
});
export const RoomSessionSchema = object("RoomSession", { token: Type.String(), ...identity });
export const RoomInitializedSchema = object("RoomInitialized", {
  roomId: DocumentIdSchema,
  protocol,
});
export type RoomMessage = Type.Static<typeof RoomMessageSchema>;
export type RoomClientMessage = Type.Static<typeof RoomClientMessageSchema>;
export type RoomSeedInput = Type.Static<typeof RoomSeedInputSchema>;
export type RoomSeed = Type.Static<typeof RoomSeedSchema>;
