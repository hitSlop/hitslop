import { expect, test } from "bun:test";
import { base64url, signRoomToken, verifyRoomToken, type RoomClaims } from "../src/crypto.ts";
import { route } from "../src/index.ts";
import { MemoryRegistry } from "../src/store.ts";

const key = "isolated-security-test-key-32-bytes";
const claims = (): RoomClaims => ({
  room: crypto.randomUUID(),
  user: "owner",
  name: "Owner",
  email: "",
  owner: true,
  exp: Math.floor(Date.now() / 1000) + 600,
});
async function uncheckedToken(value: unknown) {
  const encoder = new TextEncoder(),
    payload = base64url(encoder.encode(JSON.stringify(value)));
  const signingKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return `${payload}.${base64url(new Uint8Array(await crypto.subtle.sign("HMAC", signingKey, encoder.encode(payload))))}`;
}
test("weak keys fail closed for signing and verification", async () => {
  const token = await signRoomToken(key, claims());
  for (const weak of ["", "short", "a".repeat(31)]) {
    await expect(signRoomToken(weak, claims())).rejects.toThrow();
    await expect(verifyRoomToken(weak, token)).rejects.toThrow();
  }
});
test("even correctly signed claims are validated", async () => {
  const invalid = [
    null,
    [],
    {},
    ...[
      { owner: "true" },
      { name: null },
      { email: 4 },
      { user: "" },
      { user: "a".repeat(129) },
      { room: "../other" },
      { room: "a".repeat(81) },
      { exp: 0 },
      { exp: 1.5 },
      { exp: Math.floor(Date.now() / 1000) + 86400 },
      { name: "x\nspoof" },
    ].map((change) => ({ ...claims(), ...change })),
  ];
  for (const value of invalid)
    await expect(verifyRoomToken(key, await uncheckedToken(value))).rejects.toThrow("Unauthorized");
  const token = await signRoomToken(key, claims());
  await expect(verifyRoomToken(key, `${token}x`)).rejects.toThrow();
});
test("production entry ignores any legacy test-auth environment flag", async () => {
  const env = { TOKEN_KEY: key, FIREBASE_PROJECT_ID: "hitslopapp", ALLOW_TEST_AUTH: "true" };
  const response = await route(
    new Request("https://api.hitslop.com/api/media", {
      method: "PUT",
      headers: { authorization: "Bearer test:owner", "content-type": "image/png" },
      body: new Uint8Array([1]),
    }),
    env,
    new MemoryRegistry(),
  );
  expect(response.status).toBe(401);
});
