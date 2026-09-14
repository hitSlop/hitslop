import { expect, test } from "bun:test";
import { discoverSlops } from "../dev-gallery.ts";

test("only supported examples appear in the active gallery", async () => {
  expect((await discoverSlops()).map(slop => slop.slug)).toEqual(["quick-checklist"]);
});
