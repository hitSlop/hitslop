import { expect, test } from "bun:test";
import type { APIEnvironment } from "../src/env";
import { handleArtifact } from "../src/artifacts";
import { route } from "../src/index";

const hash = "a".repeat(64);

function environment(get: (key: string) => Promise<R2ObjectBody | null>): APIEnvironment {
  return {
    ARTIFACTS: { get } as unknown as R2Bucket,
    ENVIRONMENT: "development",
    CONVEX_URL: "https://example.convex.cloud",
    CONVEX_SITE_URL: "https://example.convex.site",
    HITSLOP_INTERNAL_SECRET: "test-only-secret",
  };
}

test("artifact delivery permits only content-addressed package, preview, and icon keys", async () => {
  const requested: string[] = [];
  const env = environment(async (key) => { requested.push(key); return null; });
  for (const key of [`artifacts/sha256/${hash}.slop.zip`, `previews/sha256/${hash}.png`, `icons/sha256/${hash}.png`]) {
    expect((await handleArtifact(new Request(`https://api.hitslop.com/api/artifact?key=${key}`), env)).status).toBe(404);
  }
  expect(requested).toHaveLength(3);
  expect((await handleArtifact(new Request("https://api.hitslop.com/api/artifact?key=icons/not-content-addressed.png"), env)).status).toBe(400);
  expect(requested).toHaveLength(3);
});

test("router rejects unknown routes and unsupported methods", async () => {
  const env = environment(async () => null);
  expect((await route(new Request("https://api.hitslop.com/nope"), env)).status).toBe(404);
  const response = await route(new Request("https://api.hitslop.com/api/publish"), env);
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("POST");
});
