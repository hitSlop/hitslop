import { expect, test } from "bun:test";
import { installHost, slop, type SlopHost } from "../src/index.ts";

test("delegates storage calls to the installed host", async () => {
  let value = { count: 1 }; let revision = "one";
  let dragged = false;
  const host: SlopHost = {
    query: async () => [], execute: async () => 0, transaction: async () => 0,
    jsonOpen: async <T>(initial: T) => ({ value: (value ?? initial) as T, revision }),
    jsonRead: async <T>() => ({ value: value as T, revision }),
    jsonWrite: async <T>(next: T) => { value = next as typeof value; revision = "two"; return { revision }; },
    mediaOpen: async () => ({ exists: false, revision: null }),
    mediaWrite: async () => ({ revision: "media-one" }),
    mediaRemove: async () => ({ revision: null }),
    resizeWindow: async (size) => size,
    dragWindow: async () => { dragged = true; },
    watch: () => () => {},
  };
  const uninstall = installHost(host);
  expect((await slop.json.open({ count: 0 })).value.count).toBe(1);
  expect((await slop.json.write({ count: 2 }, "one")).revision).toBe("two");
  expect((await slop.media.open("hero")).exists).toBe(false);
  expect((await slop.media.write("hero", "aW1hZ2U=", "image/png")).revision).toBe("media-one");
  expect((await slop.media.remove("hero")).revision).toBeNull();
  expect(await slop.window.resize({ width: 725, height: 438 })).toEqual({ width: 725, height: 438 });
  await slop.window.drag();
  expect(dragged).toBe(true);
  uninstall();
});
