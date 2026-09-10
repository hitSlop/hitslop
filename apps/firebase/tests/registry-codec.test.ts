import { expect, test } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { RegistryTemplateSchema } from "@hitslop/schema";
import fixture from "../../../packages/schema/tests/fixtures/registry-template.json";
import { readRegistryDocument, writeRegistryDocument } from "../src/registry-codec";

test("registry codec round-trips portable dates through native Firestore timestamps", () => {
  const stored = writeRegistryDocument(RegistryTemplateSchema, fixture);
  expect(stored.firstPublishedAt).toBeInstanceOf(Timestamp);
  expect((stored.currentRelease as Record<string, unknown>).publishedAt).toBeInstanceOf(Timestamp);
  expect(readRegistryDocument(RegistryTemplateSchema, stored)).toEqual(fixture);
});

test("registry codec refuses string timestamps in stored documents", () => {
  expect(() => readRegistryDocument(RegistryTemplateSchema, fixture)).toThrow("timestamp");
  expect(() => writeRegistryDocument(RegistryTemplateSchema, { ...fixture, creationCount: -1 })).toThrow();
});
