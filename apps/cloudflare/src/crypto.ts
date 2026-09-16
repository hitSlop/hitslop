const encoder = new TextEncoder();

export const hex = (data: ArrayBuffer | Uint8Array) =>
  Array.from(data instanceof Uint8Array ? data : new Uint8Array(data), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export const digest = async (bytes: BufferSource) =>
  hex(await crypto.subtle.digest("SHA-256", bytes));

export const unbase64url = (value: string) => {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

export const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export type RoomClaims = {
  room: string;
  user: string;
  name: string;
  email: string;
  exp: number;
  owner: boolean;
};

function tokenKey(key: string): Uint8Array {
  const bytes = encoder.encode(key);
  if (bytes.length < 32) throw new Error("Room token key must contain at least 32 bytes");
  return bytes;
}

function validClaims(value: unknown): value is RoomClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  const text = (value: unknown, min: number, max: number): value is string =>
    typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    !/[\x00-\x1f\x7f]/.test(value);
  const now = Math.floor(Date.now() / 1000);
  return (
    text(c.room, 1, 80) &&
    /^[a-zA-Z0-9-]+$/.test(c.room) &&
    text(c.user, 1, 128) &&
    text(c.name, 0, 128) &&
    text(c.email, 0, 254) &&
    typeof c.owner === "boolean" &&
    typeof c.exp === "number" &&
    Number.isSafeInteger(c.exp) &&
    c.exp > now &&
    c.exp <= now + 12 * 60 * 60 + 60
  );
}

export async function signRoomToken(key: string, claims: RoomClaims): Promise<string> {
  const keyBytes = tokenKey(key);
  if (!validClaims(claims)) throw new Error("Invalid room token claims");
  const payload = base64url(encoder.encode(JSON.stringify(claims)));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = base64url(
    new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload))),
  );
  return `${payload}.${signature}`;
}

export async function verifyRoomToken(key: string, token: string): Promise<RoomClaims> {
  const keyBytes = tokenKey(key);
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    token.length > 4096 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  )
    throw new Error("Unauthorized");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      unbase64url(parts[1]!),
      encoder.encode(parts[0]!),
    ))
  )
    throw new Error("Unauthorized");
  const claims = JSON.parse(new TextDecoder().decode(unbase64url(parts[0]!))) as RoomClaims;
  if (!validClaims(claims)) throw new Error("Unauthorized");
  return claims;
}
