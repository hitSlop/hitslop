import { expect, test } from "bun:test";
import { createThemeReload } from "../src/theme-reload.ts";

function fixture() {
  const links: Link[] = [];
  class Link {
    href = "theme.css";
    onload = () => {};
    onerror = () => {};
    cloneNode() { return new Link(); }
    remove() { const index = links.indexOf(this); if (index >= 0) links.splice(index, 1); }
    after(next: Link) { links.splice(links.indexOf(this) + 1, 0, next); }
  }
  links.push(new Link());
  const document = { querySelector: () => links[0] ?? null } as unknown as Pick<Document, "querySelector">;
  return { links, reload: createThemeReload(document) };
}

test("theme reload keeps only the latest successful replacement despite stale callbacks", () => {
  const { links, reload } = fixture();
  reload("older");
  const older = links[1]!;
  reload("newer");
  const newer = links[1]!;
  expect(links).toHaveLength(2);
  older.onload();
  expect(links[0]!.href).toBe("theme.css");
  newer.onload();
  older.onerror();
  expect(links.map(link => link.href)).toEqual(["theme.css?revision=newer"]);
});

test("failed latest theme retains last good CSS; later removal can load", () => {
  const { links, reload } = fixture();
  reload("valid"); links[1]!.onload();
  reload("older"); const older = links[1]!;
  reload("invalid"); links[1]!.onerror(); older.onload();
  expect(links.map(link => link.href)).toEqual(["theme.css?revision=valid"]);
  reload("default"); links[1]!.onload();
  expect(links.map(link => link.href)).toEqual(["theme.css?revision=default"]);
});
