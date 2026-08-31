import { describe, expect, test } from "bun:test";
import { encode } from "fast-png";
import { validatePackagePath, validateStaticPreviews } from "../src/publish-package";

const png = () => Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

describe("published package previews", () => {
  test("accepts the two Apple static preview paths", () => {
    expect(() => validatePackagePath("QuickLook/Preview.png")).not.toThrow();
    expect(() => validatePackagePath("QuickLook/Thumbnail.png")).not.toThrow();
    expect(validateStaticPreviews({ "QuickLook/Preview.png": png(), "QuickLook/Thumbnail.png": png() })).toEqual(png());
  });

  test("accepts different valid images and rejects missing, invalid, or unexpected entries", () => {
    expect(() => validateStaticPreviews({ "QuickLook/Preview.png": png() })).toThrow("Thumbnail.png");
    const different = encode({ width: 2, height: 1, channels: 4, data: new Uint8Array(8).fill(127) });
    expect(validateStaticPreviews({ "QuickLook/Preview.png": png(), "QuickLook/Thumbnail.png": different })).toEqual(png());
    different[different.length - 1]! ^= 1;
    expect(() => validateStaticPreviews({ "QuickLook/Preview.png": png(), "QuickLook/Thumbnail.png": different })).toThrow("valid PNG");
    expect(() => validatePackagePath("QuickLook/Icon.png")).toThrow("cannot contain");
    expect(() => validatePackagePath("AGENTS.md")).toThrow("cannot contain");
  });
});
