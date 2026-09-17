import { describe, expect, test } from "bun:test";
import { Authority } from "../src/host.ts";
import { applyOps } from "../src/apply.ts";
import { fixtureSchema, initial, scenarios } from "./fixtures.ts";
import * as S from "../src/schema.ts";
import { paths } from "../src/paths.ts";

describe("portable authority fixtures", () => {
  for (const scenario of scenarios) test(scenario.name, () => {
    const authority = new Authority(fixtureSchema, initial);
    for (const event of scenario.events) {
      const result = authority.execute(event.request);
      expect(result.ok ? undefined : result.error.code).toBe(event.expected.error);
      expect(authority.snapshot).toEqual({ revision: event.expected.revision, data: event.expected.data });
    }
  });
});
test("failed candidate leaves original snapshot untouched", () => {
  const before = structuredClone(initial);
  expect(() => applyOps(fixtureSchema, before, [{ op: "increment", path: [{ key: "count" }], amount: -1 }])).toThrow();
  expect(before).toEqual(initial);
});
test("limits and JSON validation reject oversized/non-finite values without publishing", () => {
  const authority = new Authority(fixtureSchema, initial);
  for (const value of ["x".repeat(1024 * 1024), Infinity, undefined]) {
    expect(authority.execute({ requestId: String(value).slice(0, 20), ops: [{ op: "set", path: [{ key: "title" }], value }] }).ok).toBe(false);
    expect(authority.snapshot.revision).toBe(0);
  }
});
test("paths are inert, frozen, and list/record capability is schema-driven at runtime", () => {
  const $ = paths(fixtureSchema);
  const row = { id: "a" }, path = $.tasks.item(row);
  row.id = "changed";
  expect(Object.getPrototypeOf(path)).toBe(null);
  expect(Object.isFrozen(path)).toBe(true);
  expect("item" in $.tags).toBe(false);
  expect("at" in $.tasks).toBe(false);
  expect($.attributes.at("a.b")).toBeDefined();
  const colliding = paths(S.Document({ set: S.String(), item: S.String(), at: S.String() }));
  expect(colliding.set).toBeDefined(); expect(colliding.item).toBeDefined(); expect(colliding.at).toBeDefined();
});
