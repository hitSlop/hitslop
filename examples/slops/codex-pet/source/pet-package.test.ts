import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { parsePetArchive } from "./pet-package";

const manifest = (extra: Record<string, unknown> = {}) => strToU8(JSON.stringify({
  id: "tiny-pet",
  displayName: "Tiny Pet",
  description: "A fixture pet.",
  spritesheetPath: "spritesheet.webp",
  ...extra,
}));

describe("Codex pet ZIP parsing", () => {
  test("accepts a root v1 package and harmless preview files", () => {
    const parsed = parsePetArchive(zipSync({
      "pet.json": manifest(),
      "spritesheet.webp": new Uint8Array([1, 2, 3]),
      "preview.webp": new Uint8Array([4]),
    }));
    expect(parsed.displayName).toBe("Tiny Pet");
    expect(parsed.spriteVersionNumber).toBe(1);
    expect([...parsed.spriteBytes]).toEqual([1, 2, 3]);
  });

  test("accepts a v2 package inside one wrapper directory", () => {
    const parsed = parsePetArchive(zipSync({
      "tiny/pet.json": manifest({ spriteVersionNumber: 2 }),
      "tiny/spritesheet.webp": new Uint8Array([9]),
    }));
    expect(parsed.spriteVersionNumber).toBe(2);
    expect(parsed.id).toBe("tiny-pet");
  });

  test("rejects missing, duplicate, and unsafe package paths", () => {
    expect(() => parsePetArchive(zipSync({ "spritesheet.webp": new Uint8Array([1]) }))).toThrow("exactly one pet.json");
    expect(() => parsePetArchive(zipSync({
      "a/pet.json": manifest(), "a/spritesheet.webp": new Uint8Array([1]),
      "b/pet.json": manifest(), "b/spritesheet.webp": new Uint8Array([1]),
    }))).toThrow("exactly one pet.json");
    expect(() => parsePetArchive(zipSync({ "../pet.json": manifest(), "../spritesheet.webp": new Uint8Array([1]) }))).toThrow("unsafe path");
  });

  test("rejects bad versions and escaping sprite references", () => {
    expect(() => parsePetArchive(zipSync({
      "pet.json": manifest({ spriteVersionNumber: 3 }), "spritesheet.webp": new Uint8Array([1]),
    }))).toThrow("spriteVersionNumber");
    expect(() => parsePetArchive(zipSync({
      "pet.json": manifest({ spritesheetPath: "../spritesheet.webp" }), "spritesheet.webp": new Uint8Array([1]),
    }))).toThrow("beside pet.json");
  });

  test("rejects case-insensitive duplicate paths", () => {
    expect(() => parsePetArchive(zipSync({
      "pet.json": manifest(), "spritesheet.webp": new Uint8Array([1]), "SPRITESHEET.WEBP": new Uint8Array([2]),
    }))).toThrow("duplicate file paths");
  });
});
