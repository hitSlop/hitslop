import { expect, test } from "bun:test";
import * as Type from "typebox";
import { standard } from "../src/standard.ts";
import { generateOpenAPI } from "../src/openapi.ts";
import { RoomMessageSchema, RoomClientMessageSchema } from "@hitslop/schema";
import { validate } from "@hitslop/schema/validation";

test("Standard Schema preserves JSON and never coerces or inserts defaults", async () => {
  const schema = Type.Object({ n: Type.Integer({ default: 3 }) }, { additionalProperties: true });
  const adapter = standard(schema)["~standard"];
  const value = { n: 1, extra: [null, "keep"] };
  expect(await adapter.validate(value)).toEqual({ value });
  expect((await adapter.validate({ n: "1" })).issues).toBeDefined();
  expect((await adapter.validate({})).issues).toBeDefined();
  expect(JSON.stringify(adapter.jsonSchema.input({ target: "draft-2020-12" }))).toBe(
    JSON.stringify(schema),
  );
});

test("OpenAPI keeps nullable fields, named messages, binary and multipart routes", async () => {
  const spec = (await generateOpenAPI()) as any;
  expect(spec.openapi).toBe("3.1.0");
  expect(spec.components.schemas.SlopCategory.type).toBe("string");
  expect(spec.components.schemas.SlopCategory.enum).toContain("utilities");
  expect(spec.components.schemas.SharedDocument.properties.invite.type).toEqual(["string", "null"]);
  expect(spec.components.schemas.CatalogResponse.properties.nextCursor.type).toEqual([
    "string",
    "null",
  ]);
  expect(Object.keys(spec.components.schemas.RoomServerMessage.discriminator.mapping)).toHaveLength(
    6,
  );
  expect(Object.keys(spec.components.schemas.RoomClientMessage.discriminator.mapping)).toHaveLength(
    3,
  );
  expect(
    spec.paths["/api/documents"].post.requestBody.content["multipart/form-data"],
  ).toBeDefined();
  expect(spec.paths["/api/media"].put.requestBody.content["*/*"]).toBeDefined();
  expect(spec.paths["/rooms/{documentId}"].post.operationId).toBe("initializeRoom");
  expect(spec.paths["/rooms/{documentId}/socket"]).toBeUndefined();
  expect(JSON.stringify(await generateOpenAPI())).toBe(JSON.stringify(spec));
});

test("message variants require their payload and reject fields from other variants", () => {
  for (const message of [
    { type: "welcome", protocol: 1 },
    { type: "ack" },
    { type: "ready", head: 1 },
    { type: "error", status: 400 },
    { type: "unknown" },
    { type: "presence", peers: [], head: 1 },
  ]) {
    expect(() => validate(RoomMessageSchema, message)).toThrow();
  }
  for (const message of [
    { type: "hello", protocol: 1 },
    { type: "append" },
    { type: "applied", sequence: 0 },
  ]) {
    expect(() => validate(RoomClientMessageSchema, message)).toThrow();
  }
});

test("canonical room fixtures validate in both directions", async () => {
  const fixtures = await Bun.file(
    new URL("../../schema/tests/fixtures/room-wire.json", import.meta.url),
  ).json();
  for (const message of fixtures.server)
    expect(validate(RoomMessageSchema, message)).toEqual(message);
  for (const message of fixtures.client)
    expect(validate(RoomClientMessageSchema, message)).toEqual(message);
  for (const message of fixtures.invalidServer)
    expect(() => validate(RoomMessageSchema, message)).toThrow();
  for (const message of fixtures.invalidClient)
    expect(() => validate(RoomClientMessageSchema, message)).toThrow();
});
