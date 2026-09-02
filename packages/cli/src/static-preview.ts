import { readFile, writeFile } from "node:fs/promises";
import { decode as decodePng, encode as encodePng, type DecodedPng } from "fast-png";

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
export const ICON_SIZE = 512;

export function validateStaticPng(bytes: Uint8Array, label: string): DecodedPng {
  if (bytes.byteLength === 0) throw new Error(`${label} is empty.`);
  if (bytes.byteLength > MAX_PREVIEW_BYTES) throw new Error(`${label} cannot exceed 5 MiB.`);
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image.`); }
}

export function validateIconPng(bytes: Uint8Array, label = "The template icon"): DecodedPng {
  const image = validateStaticPng(bytes, label);
  if (image.width !== ICON_SIZE || image.height !== ICON_SIZE) throw new Error(`${label} must be exactly ${ICON_SIZE}x${ICON_SIZE} pixels.`);
  return image;
}

export function iconFromPng(bytes: Uint8Array, size = ICON_SIZE): Uint8Array {
  const image = validateStaticPng(bytes, "The template preview");
  const scale = size / Math.max(image.width, image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const output = image.depth === 16 ? new Uint16Array(size * size * 4) : new Uint8Array(size * size * 4);
  const alpha = image.depth === 16 ? 65535 : 255;
  const offsetX = Math.floor((size - width) / 2);
  const offsetY = Math.floor((size - height) / 2);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y + 0.5) * image.height / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x + 0.5) * image.width / width));
      const sourceOffset = (sourceY * image.width + sourceX) * image.channels;
      const destinationOffset = ((offsetY + y) * size + offsetX + x) * 4;
      if (image.channels === 1 || image.channels === 2) {
        const gray = image.data[sourceOffset]!;
        output[destinationOffset] = gray;
        output[destinationOffset + 1] = gray;
        output[destinationOffset + 2] = gray;
        output[destinationOffset + 3] = image.channels === 2 ? image.data[sourceOffset + 1]! : alpha;
      } else {
        output[destinationOffset] = image.data[sourceOffset]!;
        output[destinationOffset + 1] = image.data[sourceOffset + 1]!;
        output[destinationOffset + 2] = image.data[sourceOffset + 2]!;
        output[destinationOffset + 3] = image.channels === 4 ? image.data[sourceOffset + 3]! : alpha;
      }
    }
  }
  return encodePng({ width: size, height: size, data: output, depth: image.depth, channels: 4 });
}

export async function writeDefaultIcon(previewPath: string, iconPath: string): Promise<void> {
  await writeFile(iconPath, iconFromPng(await readFile(previewPath)));
}
