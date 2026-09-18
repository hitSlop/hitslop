import { room as roomStub, unwrap } from "./room-rpc.ts";
import { api } from "@hitslop/api";
import { implement, ORPCError } from "@orpc/server";
import type { Authenticate } from "./auth.ts";
import { catalogHeaders, handleArtifact, handleCatalog, handleRecordCreation } from "./catalog.ts";
import { signRoomToken, roomClaims } from "./crypto.ts";
import {
  handleCreateDocument,
  handleDocumentPackage,
  handleGetDocument,
  handleInvite,
  handleJoinDocument,
  handleRemoveMember,
  loadMemberDocument,
} from "./documents.ts";
import { fail, HttpError } from "./errors.ts";
import { handleMediaGet, handleMediaPut } from "./media.ts";
import { handlePublish } from "./publish.ts";
import type { Env } from "./index.ts";
import type { Registry } from "./store.ts";
import type { RoomResult } from "./room.ts";

export type Context = {
  request: Request;
  env: Env;
  registry: Registry;
  headers: Headers;
  authenticate: Authenticate;
};
const statuses = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  503: "SERVICE_UNAVAILABLE",
} as const;
const impl = implement(api).$context<Context>();
const base = impl.use(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof HttpError)
      throw new ORPCError(
        statuses[error.status as keyof typeof statuses] ?? "INTERNAL_SERVER_ERROR",
        { message: error.message },
      );
    if (error instanceof SyntaxError)
      throw new ORPCError("BAD_REQUEST", { message: "Invalid JSON" });
    if (!(error instanceof ORPCError)) console.error("API operation failed", error);
    throw error;
  }
});
const authenticated = base.use(async ({ context, next }) =>
  next({ context: { identity: await context.authenticate(context.request, context.env) } }),
);
const room = base.use(async ({ context, next }) =>
  next({ context: { claims: await roomClaims(context.request, context.env) } }),
);
const immutable = (headers: Headers) =>
  headers.set("cache-control", "public, max-age=31536000, immutable");
export const router = impl.router({
  catalog: {
    list: base.catalog.list.handler(({ input, context: c }) => {
      for (const [key, value] of Object.entries(catalogHeaders)) c.headers.set(key, value);
      return handleCatalog(c.request, c.registry, input);
    }),
    recordCreation: base.catalog.recordCreation.handler(({ input, context: c }) =>
      handleRecordCreation(input, c.registry),
    ),
    artifact: base.catalog.artifact.handler(({ input, context: c }) => {
      immutable(c.headers);
      return handleArtifact(c.registry, input.key);
    }),
    publish: base.catalog.publish.handler(({ input, context: c }) =>
      handlePublish(input, c.registry),
    ),
  },
  media: {
    put: authenticated.media.put.handler(({ input, context: c }) =>
      handleMediaPut(input, c.registry, c.request.headers.get("content-type")),
    ),
    get: base.media.get.handler(({ input, context: c }) => {
      immutable(c.headers);
      return handleMediaGet(c.registry, input.sha256);
    }),
  },
  documents: {
    create: authenticated.documents.create.handler(({ input, context: c }) =>
      handleCreateDocument(input, c.registry, c.identity, c.env.ROOMS),
    ),
    get: authenticated.documents.get.handler(({ input, context: c }) =>
      handleGetDocument(c.registry, c.identity, input.documentId, c.env.ROOMS),
    ),
    join: authenticated.documents.join.handler(({ input, context: c }) =>
      handleJoinDocument(input, c.registry, c.identity, input.documentId, c.env.ROOMS),
    ),
    invite: authenticated.documents.invite.handler(({ input, context: c }) =>
      handleInvite(input, c.registry, c.identity, input.documentId, c.env.ROOMS),
    ),
    removeMember: authenticated.documents.removeMember.handler(({ input, context: c }) =>
      handleRemoveMember(input, c.registry, c.identity, c.env.ROOMS),
    ),
    package: authenticated.documents.package.handler(({ input, context: c }) => {
      c.headers.set("cache-control", "private, no-store");
      return handleDocumentPackage(c.registry, c.identity, input.documentId, c.env.ROOMS);
    }),
    session: authenticated.documents.session.handler(async ({ input, context: c }) => {
      const id = input.documentId;
      const shared = await loadMemberDocument(c.registry, c.identity, id, c.env.ROOMS);
      const token = await signRoomToken(c.env.TOKEN_KEY, {
        room: id,
        user: c.identity.uid,
        name: c.identity.name,
        email: c.identity.email,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        owner: c.identity.uid === shared.owner,
      });
      return { token, documentId: id, schema: shared.schemaHash };
    }),
  },
  rooms: {
    seed: room.rooms.seed.handler(async ({ input, context: c }) => {
      if (c.claims.room !== input.documentId) fail("Wrong room route", 403);
      return unwrap(await roomStub(c.env.ROOMS, input.documentId).readSeed(c.claims));
    }),
  },
});
