import { describe, expect, test } from "bun:test";
import { encode } from "fast-png";
import { validatePackagePath, validateStaticImages } from "../src/publish-package";

const png = () => Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const icon = () => encode({ width: 512, height: 512, channels: 4, data: new Uint8Array(512 * 512 * 4).fill(127) });

describe("published package images", () => {
  test("accepts the preview and icon paths", () => {
    expect(() => validatePackagePath("QuickLook/Preview.png")).not.toThrow();
    expect(() => validatePackagePath("QuickLook/Icon.png")).not.toThrow();
    const result = validateStaticImages({ "QuickLook/Preview.png": png(), "QuickLook/Icon.png": icon() });
    expect(result.preview).toEqual(png());
    expect(result.icon).toEqual(icon());
  });

  test("accepts different valid images and rejects missing, invalid, or unexpected entries", () => {
    expect(() => validateStaticImages({ "QuickLook/Preview.png": png() })).toThrow("Icon.png");
    const different = encode({ width: 2, height: 1, channels: 4, data: new Uint8Array(8).fill(127) });
    expect(() => validateStaticImages({ "QuickLook/Preview.png": png(), "QuickLook/Icon.png": different })).toThrow("512x512");
    different[different.length - 1]! ^= 1;
    expect(() => validateStaticImages({ "QuickLook/Preview.png": png(), "QuickLook/Icon.png": different })).toThrow("valid PNG");
    expect(() => validatePackagePath("QuickLook/Extra.png")).toThrow("cannot contain");
    expect(() => validatePackagePath("AGENTS.md")).toThrow("cannot contain");
  });
});
