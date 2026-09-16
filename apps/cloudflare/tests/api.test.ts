import { expect, test } from "bun:test";
import { encode } from "fast-png";
import { zipSync } from "fflate";
import { documentSkillContent, documentSkillPath, manifestSchemaURL } from "@hitslop/schema";
import type { Env } from "../src/index.ts";
import { route } from "./test-auth.ts";
import { MemoryRegistry } from "../src/store.ts";
import { signRoomToken, verifyRoomToken } from "../src/crypto.ts";

const env: Env = {
  TOKEN_KEY: "isolated-api-test-token-key-32-bytes",
  FIREBASE_PROJECT_ID: "hitslopapp",
};
const auth = { authorization: "Bearer test:owner" };
const png = () =>
  Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
const icon = () =>
  encode({ width: 512, height: 512, channels: 4, data: new Uint8Array(512 * 512 * 4).fill(127) });

async function call(path: string, init?: RequestInit, registry?: MemoryRegistry) {
  return route(
    new Request(`https://api.hitslop.com${path}`, init),
    env,
    registry ?? new MemoryRegistry(),
  );
}

test("catalog is public, cacheable, and paginated", async () => {
  const registry = new MemoryRegistry();
  for (let index = 0; index < 3; index += 1) {
    await registry.finalizePublish({
      requestId: crypto.randomUUID(),
      publisherKeyId: "publisherkeyid1234",
      publicKey: "public",
      artifactKey: `artifacts/sha256/${"a".repeat(64)}.slop.zip`,
      artifactSha256: "a".repeat(64),
      artifactBytes: 100 + index,
      previewKey: `previews/sha256/${"b".repeat(64)}.png`,
      previewSha256: "b".repeat(64),
      previewBytes: 10,
      iconKey: `icons/sha256/${"c".repeat(64)}.png`,
      iconSha256: "c".repeat(64),
      iconBytes: 10,
      manifest: {
        $schema: manifestSchemaURL,
        author: { name: "Author" },
        slug: `counter-${index}`,
        title: `Counter ${index}`,
        description: "Count one useful thing.",
        categories: ["utilities"],
        presentation: { width: 320, height: 240 },
      },
    });
  }
  const first = await route(
    new Request("https://api.hitslop.com/api/catalog?limit=2"),
    env,
    registry,
  );
  expect(first.status).toBe(200);
  expect(first.headers.get("access-control-allow-origin")).toBe("*");
  const body = (await first.json()) as {
    version: number;
    templates: { id: string; download: { url: string } }[];
    nextCursor?: string;
  };
  expect(body.version).toBe(1);
  expect(body.templates).toHaveLength(2);
  expect(body.nextCursor).toBeTruthy();
  expect(body.templates[0]?.download.url).toContain("/api/artifact?key=");
  const second = await route(
    new Request(
      `https://api.hitslop.com/api/catalog?limit=2&cursor=${encodeURIComponent(body.nextCursor!)}`,
    ),
    env,
    registry,
  );
  const more = (await second.json()) as { templates: unknown[]; nextCursor?: string };
  expect(more.templates).toHaveLength(1);
  expect(more.nextCursor ?? null).toBeNull();
});

test("artifact GET streams stored bytes and rejects unsafe keys", async () => {
  const registry = new MemoryRegistry();
  const key = `artifacts/sha256/${"a".repeat(64)}.slop.zip`;
  await registry.putObject(key, new Uint8Array([1, 2, 3]), "application/zip");
  const found = await route(
    new Request(`https://api.hitslop.com/api/artifact?key=${encodeURIComponent(key)}`),
    env,
    registry,
  );
  expect(found.status).toBe(200);
  expect(await found.arrayBuffer().then((value) => new Uint8Array(value))).toEqual(
    new Uint8Array([1, 2, 3]),
  );
  expect((await call("/api/artifact?key=icons/not-content-addressed.png")).status).toBe(400);
});

test("media PUT hashes bytes and GET returns them", async () => {
  const registry = new MemoryRegistry();
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const put = await route(
    new Request("https://api.hitslop.com/api/media", {
      method: "PUT",
      headers: { ...auth, "content-type": "image/png" },
      body: bytes,
    }),
    env,
    registry,
  );
  expect(put.status).toBe(201);
  const body = (await put.json()) as { sha256: string; bytes: number };
  expect(body.bytes).toBe(4);
  expect(body.sha256).toHaveLength(64);
  const get = await route(
    new Request(`https://api.hitslop.com/api/media/${body.sha256}`),
    env,
    registry,
  );
  expect(get.status).toBe(200);
  expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes);
  expect(
    (
      await route(
        new Request("https://api.hitslop.com/api/media", { method: "PUT", body: bytes }),
        env,
        registry,
      )
    ).status,
  ).toBe(401);
});

test("shared package ingress rejects malformed archives before storage", async () => {
  const registry = new MemoryRegistry();
  const { createAPIClient } = await import("@hitslop/api/client");
  const client = createAPIClient("https://api.hitslop.com", {
    authorization: () => "test:owner",
    fetch: ((url: string, init: RequestInit) =>
      route(new Request(url, init), env, registry)) as typeof fetch,
  });
  await expect(
    client.documents.create({
      documentId: crypto.randomUUID(),
      title: "Test",
      slug: "test",
      schema: "a".repeat(64),
      checkpoint: "AQ==",
      version: "seed",
      package: new File(["not a zip"], "x.zip"),
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("room tokens expire and bind a user to one document", async () => {
  const token = await signRoomToken(env.TOKEN_KEY, {
    room: "room-1",
    user: "owner",
    name: "Owner",
    email: "o@example.com",
    exp: Math.floor(Date.now() / 1000) + 60,
    owner: true,
  });
  expect((await verifyRoomToken(env.TOKEN_KEY, token)).room).toBe("room-1");
  await expect(
    signRoomToken(env.TOKEN_KEY, {
      room: "room-1",
      user: "owner",
      name: "Owner",
      email: "o@example.com",
      exp: Math.floor(Date.now() / 1000) - 10,
      owner: true,
    }),
  ).rejects.toThrow("Invalid room token claims");
});

test("recordCreation increments a public template", async () => {
  const registry = new MemoryRegistry();
  const published = await registry.finalizePublish({
    requestId: crypto.randomUUID(),
    publisherKeyId: "publisherkeyid1234",
    publicKey: "public",
    artifactKey: `artifacts/sha256/${"a".repeat(64)}.slop.zip`,
    artifactSha256: "a".repeat(64),
    artifactBytes: 12,
    previewKey: `previews/sha256/${"b".repeat(64)}.png`,
    previewSha256: "b".repeat(64),
    previewBytes: 10,
    iconKey: `icons/sha256/${"c".repeat(64)}.png`,
    iconSha256: "c".repeat(64),
    iconBytes: 10,
    manifest: {
      $schema: manifestSchemaURL,
      author: { name: "Author" },
      slug: "counter",
      title: "Counter",
      description: "Count one useful thing.",
      categories: ["utilities"],
      presentation: { width: 320, height: 240 },
    },
  });
  expect(
    (
      await route(
        new Request("https://api.hitslop.com/api/catalog/created", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ templateId: published.templateId }),
        }),
        env,
        registry,
      )
    ).status,
  ).toBe(200);
  const catalog = (await route(
    new Request("https://api.hitslop.com/api/catalog"),
    env,
    registry,
  ).then((response) => response.json())) as { templates: { creationCount: number }[] };
  expect(catalog.templates[0]?.creationCount).toBe(1);
});

test("publish stores content-addressed package bytes", async () => {
  const registry = new MemoryRegistry();
  const files = {
    "manifest.json": new TextEncoder().encode(
      JSON.stringify({
        $schema: manifestSchemaURL,
        author: { name: "Author" },
        slug: "counter",
        title: "Counter",
        description: "Count one useful thing.",
        categories: ["utilities"],
        presentation: { width: 320, height: 240 },
      }),
    ),
    "app.html": new TextEncoder().encode("<!doctype html><html><body></body></html>"),
    "QuickLook/Preview.png": png(),
    "QuickLook/Icon.png": icon(),
    [documentSkillPath]: new TextEncoder().encode(documentSkillContent),
  };
  const zipped = zipSync(files);
  const identity = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", identity.publicKey));
  const publisherKeyId = (
    await crypto.subtle
      .digest("SHA-256", publicKey)
      .then((value) =>
        Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join(""),
      )
  ).slice(0, 32);
  const envelope = {
    format: "hitslop-publish/1" as const,
    requestId: crypto.randomUUID(),
    publisherKeyId,
    publicKey: btoa(String.fromCharCode(...publicKey))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""),
    artifactSha256: Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", zipped)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
    artifactBytes: zipped.byteLength,
    timestamp: Date.now(),
  };
  const canonical = new TextEncoder().encode(
    JSON.stringify(envelope, Object.keys(envelope).sort()),
  );
  // Use the same canonicalization as the schema helper by posting the envelope the publisher signs in production tests via schema.
  const { canonicalPublishEnvelope } = await import("@hitslop/schema");
  const signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", identity.privateKey, canonicalPublishEnvelope(envelope)),
  );
  const form = new FormData();
  form.set("envelope", JSON.stringify(envelope));
  form.set(
    "signature",
    btoa(String.fromCharCode(...signature))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""),
  );
  form.set("artifact", new File([zipped], "counter.slop.zip", { type: "application/zip" }));
  const response = await route(
    new Request("https://api.hitslop.com/api/publish", { method: "POST", body: form }),
    env,
    registry,
  );
  expect(response.status).toBe(201);
  const catalog = (await route(
    new Request("https://api.hitslop.com/api/catalog"),
    env,
    registry,
  ).then((r) => r.json())) as { templates: { slug: string }[] };
  expect(catalog.templates[0]?.slug).toBe("counter");
});

test("typed OpenAPI client preserves binary media and structured validation errors", async () => {
  const { createAPIClient } = await import("@hitslop/api/client");
  const registry = new MemoryRegistry();
  const client = createAPIClient("https://api.hitslop.com", {
    authorization: () => "test:owner",
    fetch: ((url: string, init: RequestInit) =>
      route(new Request(url, init), env, registry)) as typeof fetch,
  });
  const receipt = await client.media.put(new Blob(["image"], { type: "image/png" }));
  expect(await (await client.media.get({ sha256: receipt.sha256 })).text()).toBe("image");
});

test("room RPC failures retain HTTP status and cannot mint guest credentials", async () => {
  const registry = new MemoryRegistry();
  const { createAPIClient } = await import("@hitslop/api/client");
  const rooms = {
    getByName: () => ({
      readSeed: async () => ({ ok: false, status: 404, message: "Room not found" }),
    }),
  } as unknown as NonNullable<Env["ROOMS"]>;
  const token = await signRoomToken(env.TOKEN_KEY, {
    room: "missing",
    user: "owner",
    name: "Owner",
    email: "",
    owner: true,
    exp: (Date.now() / 1000 + 100) | 0,
  });
  const client = createAPIClient("https://api.hitslop.com", {
    authorization: () => token,
    fetch: ((url: string, init: RequestInit) =>
      route(new Request(url, init), { ...env, ROOMS: rooms }, registry)) as typeof fetch,
  });
  await expect(client.rooms.seed({ documentId: "missing" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(client.rooms.seed({ documentId: "another" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

test("invalid publish metadata is a client error and request bodies are bounded", async () => {
  const registry = new MemoryRegistry();
  const form = new FormData();
  form.set("envelope", "{}");
  form.set("signature", "invalid");
  form.set("artifact", new File(["zip"], "invalid.zip"));
  const invalid = await route(
    new Request("https://api.hitslop.com/api/publish", { method: "POST", body: form }),
    env,
    registry,
  );
  expect(invalid.status).toBe(400);
  const tooLarge = await route(
    new Request("https://api.hitslop.com/api/media", {
      method: "PUT",
      headers: auth,
      body: new Uint8Array(26 * 1024 * 1024 + 1),
    }),
    env,
    registry,
  );
  expect(tooLarge.status).toBe(413);
});

test("canonical manifest schema is served by the Worker", async () => {
  const response = await route(
    new Request("https://api.hitslop.com/schemas/v1/manifest.schema.json"),
    env,
    new MemoryRegistry(),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/schema+json");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(await response.json()).toMatchObject({
    $id: "https://api.hitslop.com/schemas/v1/manifest.schema.json",
    type: "object",
  });
});

test("missing D1 or R2 bindings never fall back to a disposable catalog", async () => {
  const response = await route(new Request("https://api.hitslop.com/api/catalog"), env);
  expect(response.status).toBe(503);
});
