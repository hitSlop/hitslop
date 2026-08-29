import { expect, test } from "bun:test";
import { installHost, slop, type SlopHost } from "../src/index.ts";

test("delegates storage calls to the installed host", async () => {
  let value = { count: 1 }; let revision = "one";
  const host: SlopHost = {
    query: async () => [], execute: async () => 0, transaction: async () => 0,
    jsonRead: async <T>() => ({ value: value as T, revision }),
    jsonWrite: async <T>(_store: string, next: T) => { value = next as typeof value; revision = "two"; return { revision }; },
    watch: () => () => {},
  };
  const uninstall = installHost(host);
  expect((await slop.jsonRead<typeof value>("state")).value.count).toBe(1);
  expect((await slop.jsonWrite("state", { count: 2 }, "one")).revision).toBe("two");
  uninstall();
});
