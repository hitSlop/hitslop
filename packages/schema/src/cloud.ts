import * as Type from "typebox";
import { DocumentIdSchema, RoomSeedInputSchema } from "./room.js";
import { Sha256Schema } from "./publish.js";

export const SharedDocumentFieldsSchema = Type.Object(
  {
    documentId: DocumentIdSchema,
    title: Type.String({ minLength: 1, maxLength: 200 }),
    slug: Type.String({ minLength: 1, maxLength: 100 }),
    schema: Sha256Schema,
  },
  { additionalProperties: false },
);
export const SharedDocumentCreateSchema = Type.Object(
  {
    ...SharedDocumentFieldsSchema.properties,
    checkpoint: RoomSeedInputSchema.properties.checkpoint,
    version: RoomSeedInputSchema.properties.version,
  },
  { additionalProperties: false },
);
export const SharedDocumentSchema = Type.Object(
  {
    ...SharedDocumentFieldsSchema.properties,
    owner: Type.String(),
    packageSha256: Sha256Schema,
    packageBytes: Type.Integer({ minimum: 1, maximum: 25 * 1024 * 1024 }),
    members: Type.Array(
      Type.Object(
        { id: Type.String(), name: Type.String(), email: Type.String() },
        { additionalProperties: false },
      ),
      { maxItems: 20 },
    ),
    invite: Type.Union([Type.String(), Type.Null()]),
    invitationsEnabled: Type.Boolean(),
  },
  { title: "SharedDocument", additionalProperties: false },
);
export const MediaReceiptSchema = Type.Object(
  {
    sha256: Sha256Schema,
    bytes: Type.Integer({ minimum: 1, maximum: 25 * 1024 * 1024 }),
    mime: Type.String({ maxLength: 127 }),
  },
  { title: "MediaReceipt", additionalProperties: false },
);
