import { describe, expect, test } from "bun:test";
import { parseCatalogResponse } from "../src/index.ts";

const hash = "a".repeat(64);
const asset = { url: "https://api.hitslop.com/api/artifact?key=asset", sha256: hash, bytes: 1024 };
const template = {
  id: "publisher_counter",
  slug: "counter",
  title: "Counter",
  description: "Count one useful thing.",
  categories: ["utilities"],
  author: { name: "Counter Author", url: "https://example.com" },
  creationCount: 3,
  release: { number: 2, publishedAt: "2026-09-05T12:00:00.000Z" },
  preview: asset,
  icon: asset,
  download: asset,
};

describe("CatalogResponse", () => {
  test("parses the public catalog wire shape", () => {
    expect(parseCatalogResponse({ version: 1, templates: [template] }).templates[0]?.slug).toBe("counter");
  });

  test("rejects malformed assets and unknown fields", () => {
    expect(() => parseCatalogResponse({ version: 1, templates: [{ ...template, preview: { ...asset, sha256: "nope" } }] })).toThrow();
    expect(() => parseCatalogResponse({ version: 1, templates: [{ ...template, privateRelease: true }] })).toThrow();
  });
});
