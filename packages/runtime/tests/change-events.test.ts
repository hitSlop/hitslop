import { expect, test } from "bun:test";
import { dispatchChange } from "../src/change-events.ts";
import type { SlopChange } from "../src/types.ts";

test("invalid host events cannot break dispatch; listener failures are isolated", () => {
  const received: SlopChange[] = [], errors: unknown[] = [];
  const listeners = { json: new Set<(event: SlopChange) => void>(), sqlite: new Set<(event: SlopChange) => void>(), media: new Set<(event: SlopChange) => void>() };
  listeners.json.add(() => { throw new Error("listener failed"); });
  listeners.json.add(event => received.push(event));
  for (const value of [null, {}, { kind: "invented" }, { kind: "json", sequence: "1" }]) dispatchChange(value, listeners, error => errors.push(error));
  expect(received).toHaveLength(0);
  expect(errors).toHaveLength(4);
  const event: SlopChange = { kind: "json", sequence: 1, source: "external", revision: null };
  dispatchChange(event, listeners, error => errors.push(error));
  expect(received).toEqual([event]);
  expect(errors).toHaveLength(5);
});
