import { expect, test } from "bun:test";
import { installHost, slop, type SlopHost } from "../src/index.ts";

test("delegates storage calls to the installed host", async () => {
  let value = { count: 1 };
  let dragged = false;
  const host: SlopHost = {
    reportError: async () => {},
    document: {
      connected: true,
      writable: true,
      open: async () => ({
        snapshot: {
          documentId: "doc",
          schemaHash: "schema",
          authority: "local",
          revision: 0,
          data: value,
        },
        lease: { id: "lease", expiresAt: 100 },
      }),
      send: async () => {
        throw new Error("Unused");
      },
      flush: async () => {},
      subscribe: () => () => {},
      onConnection: () => () => {},
    },
    mediaOpen: async () => ({ src: null }),
    mediaAdd: async () => ({ sha256: "a".repeat(64), bytes: 5, mime: "image/png" }),
    resizeWindow: async (size) => size,
    dragWindow: async () => {
      dragged = true;
    },
    watch: () => () => {},
  };
  const uninstall = installHost(host);
  expect((await slop.document.open()).snapshot.data).toEqual({ count: 1 });
  expect((await slop.media.open("a".repeat(64))).src).toBeNull();
  expect((await slop.media.add("aW1hZ2U=", "image")).sha256).toBe("a".repeat(64));
  expect(await slop.window.resize({ width: 725, height: 438 })).toEqual({
    width: 725,
    height: 438,
  });
  await slop.window.drag();
  expect(dragged).toBe(true);
  uninstall();
});
