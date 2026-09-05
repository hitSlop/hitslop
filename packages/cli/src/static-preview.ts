import { readFile, writeFile } from "node:fs/promises";
import { checkPngDimensions } from "@hitslop/schema";
import { decode as decodePng, encode as encodePng, type DecodedPng } from "fast-png";

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
export const ICON_SIZE = 512;

export function validateStaticPng(bytes: Uint8Array, label: string): DecodedPng {
  if (bytes.byteLength === 0) throw new Error(`${label} is empty.`);
  if (bytes.byteLength > MAX_PREVIEW_BYTES) throw new Error(`${label} cannot exceed 5 MiB.`);
  checkPngDimensions(bytes, label);
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image.`); }
}

export function validateIconPng(bytes: Uint8Array, label = "The template icon"): DecodedPng {
  checkPngDimensions(bytes, label, { width: ICON_SIZE, height: ICON_SIZE });
  return validateStaticPng(bytes, label);
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
  // Area averaging when shrinking; bilinear interpolation when enlarging.
  // Accumulate premultiplied color so transparent pixels cannot create dark fringes.
  const samples = (position: number, sourceSize: number, targetSize: number): [number, number][] => {
    const ratio = sourceSize / targetSize;
    if (ratio < 1) {
      const center = (position + 0.5) * ratio - 0.5;
      const lower = Math.floor(center), fraction = center - lower;
      return [[Math.max(0, Math.min(sourceSize - 1, lower)), 1 - fraction], [Math.max(0, Math.min(sourceSize - 1, lower + 1)), fraction]];
    }
    const start = position * ratio, end = (position + 1) * ratio;
    const result: [number, number][] = [];
    for (let index = Math.floor(start); index < Math.ceil(end); index++) {
      result.push([Math.min(sourceSize - 1, index), Math.max(0, Math.min(end, index + 1) - Math.max(start, index)) / ratio]);
    }
    return result;
  };
  const columns = Array.from({ length: width }, (_, x) => samples(x, image.width, width));
  for (let y = 0; y < height; y += 1) {
    const rows = samples(y, image.height, height);
    for (let x = 0; x < width; x += 1) {
      let red = 0, green = 0, blue = 0, opacity = 0;
      for (const [sy, wy] of rows) for (const [sx, wx] of columns[x]!) {
        const offset = (sy * image.width + sx) * image.channels;
        const a = (image.channels === 2 || image.channels === 4 ? image.data[offset + image.channels - 1]! : alpha) / alpha;
        const weight = wx * wy * a;
        const gray = image.channels <= 2;
        red += image.data[offset]! * weight;
        green += image.data[offset + (gray ? 0 : 1)]! * weight;
        blue += image.data[offset + (gray ? 0 : 2)]! * weight;
        opacity += weight;
      }
      const destination = ((offsetY + y) * size + offsetX + x) * 4;
      output[destination] = Math.round(opacity ? red / opacity : 0);
      output[destination + 1] = Math.round(opacity ? green / opacity : 0);
      output[destination + 2] = Math.round(opacity ? blue / opacity : 0);
      output[destination + 3] = Math.round(opacity * alpha);
    }
  }
  return encodePng({ width: size, height: size, data: output, depth: image.depth, channels: 4 });
}

export async function writeDefaultIcon(previewPath: string, iconPath: string): Promise<void> {
  await writeFile(iconPath, iconFromPng(await readFile(previewPath)));
}
