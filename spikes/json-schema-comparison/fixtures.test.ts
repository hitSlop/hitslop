import { expect, test } from "bun:test";
import { makeFixtures } from "./fixtures.ts";
import { validate } from "../../packages/schema/src/validation.ts";
import bridge from "../../packages/schema/generated/bridge-request.schema.json";

test("protocol fixtures match the current generated contract", () => {
  const group = makeFixtures([], bridge, {}, {}).groups.find(
    (group) => group.name === "bridge-current",
  )!;
  for (const fixture of group.cases) {
    let accepted = true;
    try {
      validate(bridge, JSON.parse(fixture.json));
    } catch {
      accepted = false;
    }
    expect(accepted, fixture.name).toBe(fixture.valid);
  }
});

test("Unicode fixture keeps distinct raw keys through JavaScript decoding", () => {
  const group = makeFixtures([], bridge, {}, {}).groups.find(
    (group) => group.name === "unicode-keys",
  )!;
  const value = JSON.parse(group.cases[0]!.json).values;
  expect(Object.keys(value)).toEqual(["é", "e\u0301"]);
  expect(Object.values(value)).toEqual([1, 2]);
});
