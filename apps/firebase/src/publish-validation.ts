import type { SlopManifest } from "@hitslop/schema";
import { decode as decodePng } from "fast-png";
import { validatePackagePath } from "./publish-package.js";

const MAX_ENTRIES = 256;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

export function safeArchivePath(name: string): boolean {
  if (!name || name.length > 240 || name.startsWith("/") || name.includes("\\") || name.includes("\0")) return false;
  return name.replace(/\/$/, "").split("/").every((part) => part && part !== "." && part !== "..");
}

export function inspectZip(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.byteLength - 65_557);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("Artifact is not a valid ZIP archive");
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const diskEntries = view.getUint16(eocd + 8, true);
  const entries = view.getUint16(eocd + 10, true);
  const centralBytes = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entries || entries === 0xffff || centralBytes === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("Multi-disk and ZIP64 artifacts are not supported");
  }
  if (entries === 0 || entries > MAX_ENTRIES) throw new Error(`Artifact must contain 1–${MAX_ENTRIES} entries`);
  if (centralOffset + centralBytes > eocd) throw new Error("Artifact has an invalid ZIP directory");

  const names = new Set<string>();
  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Artifact has an invalid ZIP entry");
    const madeBy = view.getUint16(offset + 4, true);
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const localOffset = view.getUint32(offset + 42, true);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || localOffset + 30 > bytes.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Artifact has an invalid ZIP entry");
    if ((flags & 1) !== 0) throw new Error("Encrypted ZIP entries are not supported");
    if (method !== 0 && method !== 8) throw new Error("Artifact contains an unsupported compression method");
    const unixMode = madeBy >> 8 === 3 ? (externalAttributes >>> 16) & 0xffff : 0;
    if ((unixMode & 0xf000) === 0xa000) throw new Error("Artifact cannot contain symlinks");
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!safeArchivePath(name)) throw new Error(`Unsafe archive entry: ${name}`);
    validatePackagePath(name);
    if (names.has(name)) throw new Error(`Artifact contains duplicate entry ${name}`);
    names.add(name);
    if (uncompressed > MAX_ENTRY_BYTES) throw new Error(`Artifact entry is too large: ${name}`);
    total += uncompressed;
    if (total > MAX_TOTAL_BYTES) throw new Error("Artifact expands beyond the 50 MiB limit");
    if (compressed > bytes.byteLength) throw new Error("Artifact has an invalid compressed size");
    offset = end;
  }
  if (offset !== centralOffset + centralBytes) throw new Error("Artifact has an invalid ZIP directory size");
}

function validatePng(bytes: Uint8Array, label: string): ReturnType<typeof decodePng> {
  try { return decodePng(bytes, { checkCrc: true }); }
  catch { throw new Error(`${label} must be a valid PNG image`); }
}

export function validateSkin(files: Record<string, Uint8Array>, manifest: SlopManifest): void {
  if (!("skin" in manifest.presentation)) return;
  const skin = files[manifest.presentation.skin];
  if (!skin) throw new Error(`Artifact is missing ${manifest.presentation.skin}`);
  const png = validatePng(skin, "Window skin");
  if (png.width !== manifest.presentation.width || png.height !== manifest.presentation.height) throw new Error(`Window skin must be exactly ${manifest.presentation.width}x${manifest.presentation.height} pixels`);
  if (png.channels !== 4) throw new Error("Window skin must be an RGBA PNG image");
}
