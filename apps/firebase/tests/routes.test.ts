import { expect, test } from "bun:test";
import type { FinalizePublishInput, PublishResult, RegistryBackend } from "../src/backend";
import { route } from "../src/router";

const hash = "a".repeat(64);

class FakeBackend implements RegistryBackend {
  existing = new Set<string>();
  requested: string[] = [];

  async objectExists(key: string): Promise<boolean> { this.requested.push(key); return this.existing.has(key); }
  async putObject(): Promise<void> {}
  mediaURL(key: string): string { return `https://storage.example/${key}`; }
  async finalizePublish(_input: FinalizePublishInput): Promise<PublishResult> { return { templateId: "template", releaseId: "release", releaseNumber: 1 }; }
  async recordCreation(): Promise<boolean> { return true; }
}

test("artifact delivery permits only content-addressed package, preview, and icon keys", async () => {
  const backend = new FakeBackend();
  for (const key of [`artifacts/sha256/${hash}.slop.zip`, `previews/sha256/${hash}.png`, `icons/sha256/${hash}.png`]) {
    expect((await route(new Request(`https://api.hitslop.com/api/artifact?key=${key}`), backend)).status).toBe(404);
  }
  expect(backend.requested).toHaveLength(3);
  expect((await route(new Request("https://api.hitslop.com/api/artifact?key=icons/not-content-addressed.png"), backend)).status).toBe(400);
  expect(backend.requested).toHaveLength(3);
});

test("artifact delivery redirects existing objects without proxying bytes", async () => {
  const backend = new FakeBackend();
  const key = `artifacts/sha256/${hash}.slop.zip`;
  backend.existing.add(key);
  const response = await route(new Request(`https://api.hitslop.com/api/artifact?key=${key}`), backend);
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(`https://storage.example/${key}`);
});

test("router rejects unknown routes and unsupported methods", async () => {
  const backend = new FakeBackend();
  expect((await route(new Request("https://api.hitslop.com/nope"), backend)).status).toBe(404);
  const response = await route(new Request("https://api.hitslop.com/api/publish"), backend);
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("POST");
});
