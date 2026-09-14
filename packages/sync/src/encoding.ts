/** Browser and native use exactly the same canonical JSON and byte encoding. */
export const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
};
export const encode = (bytes: Uint8Array): string => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};
export const decode = (text: string): Uint8Array => Uint8Array.from(atob(text), char => char.charCodeAt(0));
export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
export const readUTF8 = (bytes: Uint8Array): string => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
export const pack = (value: unknown): string => encode(utf8(canonical(value) + "\n"));
export const unpack = (bytes: string): unknown => JSON.parse(readUTF8(decode(bytes)));
export const digest = async (bytes: Uint8Array): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, "0")).join("");
};
export const hashEncoded = (bytes: string): Promise<string> => digest(decode(bytes));
