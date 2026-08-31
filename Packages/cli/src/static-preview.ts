import { readFile, writeFile } from "node:fs/promises";
import { decode as decodePng, encode as encodePng, type DecodedPng } from "fast-png";

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
export const DEFAULT_THUMBNAIL_MAX_DIMENSION = 512;

export function validateStaticPng(bytes: Uint8Array, label: string): DecodedPng {
  if (bytes.byteLength === 0) throw new Error(`${label} is empty.`);
  if (bytes.byteLength > MAX_PREVIEW_BYTES) throw new Error(`${label} cannot exceed 5 MiB.`);
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image.`); }
}

export function thumbnailFromPng(bytes: Uint8Array, maxDimension = DEFAULT_THUMBNAIL_MAX_DIMENSION): Uint8Array {
  const image = validateStaticPng(bytes, "The template preview");
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  if (scale === 1) return Uint8Array.from(bytes);

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const output = image.depth === 16 ? new Uint16Array(width * height * image.channels) : new Uint8Array(width * height * image.channels);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y + 0.5) * image.height / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x + 0.5) * image.width / width));
      const sourceOffset = (sourceY * image.width + sourceX) * image.channels;
      const destinationOffset = (y * width + x) * image.channels;
      for (let channel = 0; channel < image.channels; channel += 1) output[destinationOffset + channel] = image.data[sourceOffset + channel]!;
    }
  }
  return encodePng({ width, height, data: output, depth: image.depth, channels: image.channels });
}

export async function writeDefaultThumbnail(previewPath: string, thumbnailPath: string): Promise<void> {
  await writeFile(thumbnailPath, thumbnailFromPng(await readFile(previewPath)));
}
