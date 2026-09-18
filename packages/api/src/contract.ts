import { oc, type InferRouterContractInputs } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import * as Type from "typebox";
import {
  CatalogResponseSchema,
  DocumentIdSchema,
  MediaReceiptSchema,
  RegistryPublishResultSchema,
  RoomSeedSchema,
  RoomSessionSchema,
  Sha256Schema,
  SharedDocumentFieldsSchema,
  SharedDocumentCreateSchema,
  SharedDocumentSchema,
} from "@hitslop/schema";
import { binary, multipart, standard } from "./standard.js";

const object = <P extends Type.TProperties>(properties: P) =>
  Type.Object(properties, { additionalProperties: false });
const id = object({ documentId: DocumentIdSchema });
const ok = standard(object({ ok: Type.Boolean() }));
const base = oc.errors({
  BAD_REQUEST: {},
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  CONFLICT: {},
  PAYLOAD_TOO_LARGE: {},
  TOO_MANY_REQUESTS: {},
  INTERNAL_SERVER_ERROR: {},
  SERVICE_UNAVAILABLE: {},
});
const authenticated = base.meta(
  openapi({ spec: (current) => ({ ...current, security: [{ bearerAuth: [] }] }) }),
);
const room = base.meta(
  openapi({ spec: (current) => ({ ...current, security: [{ roomToken: [] }] }) }),
);

/** Public HTTP only. Live command/snapshot messages are schema components, not RPC procedures. */
export const api = {
  catalog: {
    list: base
      .meta(openapi({ method: "GET", path: "/api/catalog", operationId: "listCatalog" }))
      .input(
        standard(
          object({
            cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
            limit: Type.Optional(Type.String({ pattern: "^(?:[1-9][0-9]?|1[0-9]{2}|200)$" })),
          }),
        ),
      )
      .output(standard(CatalogResponseSchema)),
    recordCreation: base
      .meta(
        openapi({ method: "POST", path: "/api/catalog/created", operationId: "recordCreation" }),
      )
      .input(standard(object({ templateId: Type.String({ minLength: 1, maxLength: 160 }) })))
      .output(ok),
    artifact: base
      .meta(
        openapi({
          method: "GET",
          path: "/api/artifact",
          operationId: "getArtifact",
          responseBodyHint: "file",
        }),
      )
      .input(standard(object({ key: Type.String({ minLength: 1 }) })))
      .output(binary),
    publish: base
      .meta(
        openapi({
          method: "POST",
          path: "/api/publish",
          operationId: "publishTemplate",
          successStatus: 201,
        }),
      )
      .input(
        multipart(
          object({
            envelope: Type.String({ minLength: 1, maxLength: 65536 }),
            signature: Type.String({ minLength: 1, maxLength: 256 }),
          }),
          "artifact",
        ),
      )
      .output(standard(RegistryPublishResultSchema)),
  },
  media: {
    put: authenticated
      .meta(
        openapi({
          method: "PUT",
          path: "/api/media",
          operationId: "putMedia",
          successStatus: 201,
          requestBodyHint: "file",
        }),
      )
      .input(binary)
      .output(standard(MediaReceiptSchema)),
    get: base
      .meta(
        openapi({
          method: "GET",
          path: "/api/media/{sha256}",
          operationId: "getMedia",
          responseBodyHint: "file",
        }),
      )
      .input(standard(object({ sha256: Sha256Schema })))
      .output(binary),
  },
  documents: {
    create: authenticated
      .meta(openapi({ method: "POST", path: "/api/documents", operationId: "createDocument" }))
      .input(multipart(SharedDocumentCreateSchema, "package"))
      .output(standard(SharedDocumentSchema)),
    get: authenticated
      .meta(
        openapi({ method: "GET", path: "/api/documents/{documentId}", operationId: "getDocument" }),
      )
      .input(standard(id))
      .output(standard(SharedDocumentSchema)),
    join: authenticated
      .meta(
        openapi({
          method: "POST",
          path: "/api/documents/{documentId}/join",
          operationId: "joinDocument",
        }),
      )
      .input(
        standard(
          object({ ...id.properties, invite: Type.String({ minLength: 1, maxLength: 128 }) }),
        ),
      )
      .output(standard(SharedDocumentSchema)),
    invite: authenticated
      .meta(
        openapi({
          method: "POST",
          path: "/api/documents/{documentId}/invite",
          operationId: "updateInvitation",
        }),
      )
      .input(standard(object({ ...id.properties, enabled: Type.Boolean() })))
      .output(standard(SharedDocumentSchema)),
    removeMember: authenticated
      .meta(
        openapi({
          method: "DELETE",
          path: "/api/documents/{documentId}/members/{memberId}",
          operationId: "removeDocumentMember",
        }),
      )
      .input(
        standard(
          object({ ...id.properties, memberId: Type.String({ minLength: 1, maxLength: 128 }) }),
        ),
      )
      .output(standard(SharedDocumentSchema)),
    package: authenticated
      .meta(
        openapi({
          method: "GET",
          path: "/api/documents/{documentId}/package",
          operationId: "getDocumentPackage",
          responseBodyHint: "file",
        }),
      )
      .input(standard(id))
      .output(binary),
    session: authenticated
      .meta(
        openapi({
          method: "POST",
          path: "/api/documents/{documentId}/session",
          operationId: "createRoomSession",
        }),
      )
      .input(standard(id))
      .output(standard(RoomSessionSchema)),
  },
  rooms: {
    seed: room
      .meta(
        openapi({ method: "GET", path: "/rooms/{documentId}/seed", operationId: "getRoomSeed" }),
      )
      .input(standard(id))
      .output(standard(RoomSeedSchema)),
  },
};

export type APIInputs = InferRouterContractInputs<typeof api>;
