import { expect, test } from "bun:test";
import fixture from "./fixtures/registry-template.json";
import { RegistryTemplateSchema } from "../src/registry";
import { validate } from "../src/validation";

test("registry contract accepts the shared native fixture and unfamiliar categories", () => {
  expect(validate(RegistryTemplateSchema, fixture)).toEqual(fixture);
  expect(validate(RegistryTemplateSchema, { ...fixture, categories: ["future-category"] }).categories).toEqual(["future-category"]);
});

test("registry contract rejects invalid metadata without coercion", () => {
  for (const update of [{ creationCount: -1 }, { creationCount: "4" }, { firstPublishedAt: "yesterday" }, { searchText: "obsolete" }]) {
    expect(() => validate(RegistryTemplateSchema, { ...fixture, ...update })).toThrow();
  }
  expect(() => validate(RegistryTemplateSchema, { ...fixture, currentRelease: { ...fixture.currentRelease, number: 0 } })).toThrow();
});
