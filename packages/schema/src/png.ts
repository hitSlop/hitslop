/** Read only IHDR before a decoder allocates pixel buffers. Full decoding/CRC
 * validation is still required by callers after this resource-budget check. */
export function checkPngDimensions(bytes: Uint8Array, label: string, expected?: { width: number; height: number }): { width: number; height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 33 || signature.some((byte, index) => bytes[index] !== byte) || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) {
    throw new Error(`${label} must be a valid PNG image`);
  }
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width > 16_384 || height > 16_384 || width * height > 24_000_000) {
    throw new Error(`${label} exceeds the PNG dimension limit (16384 per side, 24 million pixels)`);
  }
  if (expected && (width !== expected.width || height !== expected.height)) {
    throw new Error(`${label} must be exactly ${expected.width}x${expected.height} pixels`);
  }
  return { width, height };
}
