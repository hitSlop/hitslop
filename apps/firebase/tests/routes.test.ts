import { expect, test } from "bun:test";
import type { FinalizePublishInput, PublishResult, RegistryBackend, RegistryCatalogTemplate } from "../src/backend";
import { route } from "../src/router";

const hash = "a".repeat(64);

class FakeBackend implements RegistryBackend {
  existing = new Set<string>();
  requested: string[] = [];
  templates: RegistryCatalogTemplate[] = [];
  failCatalog = false;

  async objectExists(key: string): Promise<boolean> { this.requested.push(key); return this.existing.has(key); }
  async putObject(): Promise<void> {}
  mediaURL(key: string): string { return `https://storage.example/${key}`; }
  async finalizePublish(_input: FinalizePublishInput): Promise<PublishResult> { return { templateId: "template", releaseId: "release", releaseNumber: 1 }; }
  async listTemplates(): Promise<RegistryCatalogTemplate[]> {
    if (this.failCatalog) throw new Error("offline");
    return this.templates;
  }
  async listTemplatePage(cursor?: string) {
    const entries = await this.listTemplates();
    const start = cursor ? entries.findIndex(entry => entry.id === cursor) + 1 : 0;
    const templates = entries.slice(start, start + 200);
    return { templates, nextCursor: start + 200 < entries.length ? templates.at(-1)!.id : null };
  }
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
  const catalogResponse = await route(new Request("https://api.hitslop.com/api/catalog", { method: "POST" }), backend);
  expect(catalogResponse.status).toBe(405);
  expect(catalogResponse.headers.get("allow")).toBe("GET");
});

test("catalog returns a cacheable public wire response with artifact URLs", async () => {
  const backend = new FakeBackend();
  backend.templates.push({
    id: "publisher_counter",
    slug: "counter",
    title: "Counter",
    description: "Count one useful thing.",
    categories: ["utilities"],
    author: { name: "Counter Author", url: "https://example.com" },
    creationCount: 4,
    release: { number: 2, publishedAt: "2026-09-05T12:00:00.000Z" },
    preview: { key: `previews/sha256/${hash}.png`, sha256: hash, bytes: 512 },
    icon: { key: `icons/sha256/${hash}.png`, sha256: hash, bytes: 256 },
    download: { key: `artifacts/sha256/${hash}.slop.zip`, sha256: hash, bytes: 1024 },
  });
  const response = await route(new Request("https://api.hitslop.com/api/catalog"), backend);
  expect(response.status).toBe(200);
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("cache-control")).toContain("s-maxage=300");
  const body = await response.json();
  expect(body.version).toBe(1);
  expect(body.templates[0].download.url).toBe(`https://api.hitslop.com/api/artifact?key=artifacts%2Fsha256%2F${hash}.slop.zip`);
  expect(body.templates[0]).not.toHaveProperty("publisherKeyId");
});

test("catalog uses stable artifact URLs behind Firebase Hosting", async () => {
  const backend = new FakeBackend();
  backend.templates.push({
    id: "publisher_counter",
    slug: "counter",
    title: "Counter",
    description: "Count things.",
    categories: ["utilities"],
    author: { name: "Counter Author" },
    creationCount: 0,
    release: { number: 1, publishedAt: "2026-09-05T12:00:00.000Z" },
    preview: { key: `previews/sha256/${hash}.png`, sha256: hash, bytes: 512 },
    icon: { key: `icons/sha256/${hash}.png`, sha256: hash, bytes: 256 },
    download: { key: `artifacts/sha256/${hash}.slop.zip`, sha256: hash, bytes: 1024 },
  });
  const response = await route(new Request("https://fh-pinned---api-uc.a.run.app/api/catalog"), backend);
  const body = await response.json();
  expect(body.templates[0].download.url).toBe(`https://api.hitslop.com/api/artifact?key=artifacts%2Fsha256%2F${hash}.slop.zip`);
});

test("catalog failures are sanitized and never cached", async () => {
  const backend = new FakeBackend();
  backend.failCatalog = true;
  const response = await route(new Request("https://api.hitslop.com/api/catalog"), backend);
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Catalog temporarily unavailable" });
});


test("paginated catalog continues past 200 entries and rejects invalid cursors", async () => {
  const backend = new FakeBackend();
  const asset = { key: `artifacts/sha256/${hash}.slop.zip`, sha256: hash, bytes: 1 };
  backend.templates = Array.from({ length: 201 }, (_, i) => ({
    id: `template-${String(i).padStart(3, "0")}`, slug: "fixture", title: "Fixture", description: "Test", categories: ["utilities"],
    author: { name: "Test" }, creationCount: 0, release: { number: 1, publishedAt: "2026-01-01T00:00:00Z" },
    download: asset, preview: asset, icon: asset,
  }));
  const first = await (await route(new Request("https://api.hitslop.com/api/catalog?page=true"), backend)).json();
  expect(first.templates).toHaveLength(200);
  expect(first.nextCursor).toBe("template-199");
  const last = await (await route(new Request(`https://api.hitslop.com/api/catalog?cursor=${first.nextCursor}`), backend)).json();
  expect(last.templates.map((entry: { id: string }) => entry.id)).toEqual(["template-200"]);
  expect(last.nextCursor).toBeNull();
  expect((await route(new Request("https://api.hitslop.com/api/catalog?cursor=.."), backend)).status).toBe(400);
});
