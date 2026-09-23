import { expect, test } from "bun:test";
import { validateClassicSkin } from "../../../examples/slops/soma-amp/skin-archive";
import { streamFromPLS } from "../../../examples/slops/soma-amp/stations";

const fixture = () => Bun.file(new URL("../../../tests/fixtures/soma-amp/base-2.91.wsz", import.meta.url)).bytes();
const skin = (bytes: Uint8Array, name = "Classic.wsz") => new File([bytes], name);

test("classic skin accepts a real skin and rejects unsupported input", async () => {
  const bytes = await fixture();
  await validateClassicSkin(skin(bytes));
  await expect(validateClassicSkin(skin(bytes, "music.mp3"))).rejects.toThrow("classic Winamp");
  await expect(validateClassicSkin(skin(bytes.slice(0, 200)))).rejects.toThrow("readable ZIP");
  await expect(validateClassicSkin(skin(new Uint8Array(10 * 1024 * 1024 + 1)))).rejects.toThrow("10 MB");
});

test("classic skin rejects unsafe paths, modern skins, encryption and inflated size", async () => {
  for (const [kind, message] of [["path", "paths"], ["modern", "Modern"], ["encrypted", "Encrypted"], ["size", "too large"]] as const) {
    const bytes = await fixture();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < bytes.length - 46; i++) {
      if (view.getUint32(i, true) !== 0x02014b50) continue;
      const name = new TextDecoder().decode(bytes.slice(i + 46, i + 46 + view.getUint16(i + 28, true)));
      if (name.toLowerCase() !== "main.bmp") continue;
      if (kind === "path" || kind === "modern") bytes.set(new TextEncoder().encode(kind === "path" ? "../a.bmp" : "skin.xml"), i + 46);
      if (kind === "encrypted") view.setUint16(i + 8, 1, true);
      if (kind === "size") view.setUint32(i + 24, 25 * 1024 * 1024 + 1, true);
      break;
    }
    await expect(validateClassicSkin(skin(bytes))).rejects.toThrow(message);
  }
});

test("radio playlists choose the first numbered HTTPS stream", () => {
  expect(streamFromPLS("[playlist]\r\nFile2=https://two.example/live\r\nFile1=https://one.example/live\r\n")).toBe("https://one.example/live");
  expect(streamFromPLS("File1=http://insecure.example/live\nFile2=file:///tmp/audio")).toBeNull();
  expect(streamFromPLS("[playlist]\nNumberOfEntries=0")).toBeNull();
});
