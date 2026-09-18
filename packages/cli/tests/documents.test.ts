import * as S from "@hitslop/schema/document";
import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type CatalogTemplate, manifestSchemaURL } from "@hitslop/schema";
import {
  createDocument,
  inspectDocument,
  openDocument,
  searchCatalog,
  assertDocumentDestination,
} from "../src/documents.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const root = async () => {
  const path = await mkdtemp(join(tmpdir(), "hitslop-documents-"));
  roots.push(path);
  return path;
};
const asset = {
  url: "https://api.hitslop.com/api/artifact?key=unused",
  sha256: "a".repeat(64),
  bytes: 1,
};
const entry = (id: string, title = "Checklist"): CatalogTemplate => ({
  id,
  slug: "checklist",
  title,
  description: "A task document",
  categories: ["utilities"],
  author: { name: "Author" },
  creationCount: 0,
  release: { number: 1, publishedAt: "2026-01-01T00:00:00Z" },
  preview: asset,
  icon: asset,
  download: asset,
});
const fetcher = (run: (url: URL) => Response) =>
  (async (input: string | URL | Request) => run(new URL(String(input)))) as typeof fetch;

test("catalog search finds matches beyond the first 200 templates", async () => {
  const calls: string[] = [];
  const found = await searchCatalog("invoice", {
    fetch: fetcher((url) => {
      calls.push(url.href);
      return Response.json({
        version: 1,
        templates: url.searchParams.has("cursor")
          ? [entry("invoice-id", "Invoice")]
          : Array.from({ length: 200 }, (_, i) => entry(`entry-${i}`)),
        nextCursor: url.searchParams.has("cursor") ? null : "entry-199",
      });
    }),
  });
  expect(found.templates.map((entry) => entry.id)).toEqual(["invoice-id"]);
  expect(found.complete).toBe(true);
  expect(found.scanned).toBe(201);
  expect(calls).toHaveLength(2);
});

test("catalog errors and pagination loops never become an empty successful search", async () => {
  await expect(
    searchCatalog("invoice", { fetch: fetcher(() => new Response("offline", { status: 503 })) }),
  ).rejects.toMatchObject({ code: "catalog_unavailable" });
  await expect(
    searchCatalog("", {
      fetch: fetcher(() => Response.json({ version: 1, templates: [], nextCursor: "same" })),
    }),
  ).rejects.toMatchObject({ code: "invalid_catalog" });
  const limited = await searchCatalog("", {
    fetch: fetcher(() =>
      Response.json({
        version: 1,
        templates: Array.from({ length: 200 }, (_, i) => entry(String(i))),
      }),
    ),
  });
  expect(limited.complete).toBe(true);
});

async function document() {
  const directory = await root();
  const path = join(directory, "test.slop");
  await mkdir(path);
  await writeFile(
    join(path, "manifest.json"),
    JSON.stringify({
      $schema: manifestSchemaURL,
      slug: "test-document",
      title: "Test",
      description: "Document fixture",
      author: { name: "Tests" },
      categories: ["utilities"],
      presentation: { width: 320, height: 240 },
    }),
  );
  await writeFile(join(path, "app.html"), "<main>Test</main>");
  await writeFile(
    join(path, "data.schema.json"),
    JSON.stringify(S.envelopeSchema(S.Document({ count: S.Number() }))),
  );
  await mkdir(join(path, "assets"));
  await writeFile(join(path, "assets/initial.json"), '{"count":0}');
  return { path, directory };
}

test("inspect distinguishes missing JSON, saved JSON, and command projections", async () => {
  const { path } = await document();
  expect(await inspectDocument(path)).toMatchObject({
    dataExists: false,
    data: null,
    editing: "versioned-json",
  });
  await mkdir(join(path, "stores"));
  await writeFile(
    join(path, "stores/data.json"),
    '{"$slop":{"format":2,"documentId":"doc","schemaHash":"hash","authority":"epoch","baseRevision":0},"data":{"count":2,"custom":"keep"}}',
  );
  expect(await inspectDocument(path)).toMatchObject({
    dataExists: true,
    data: { count: 2, custom: "keep" },
  });
  await mkdir(join(path, "state"));
  await writeFile(join(path, "state/document.sqlite"), "fixture");
  expect((await inspectDocument(path)).editing).toBe("versioned-json");
});

test("local creation validates before invoking native and refuses existing destinations", async () => {
  const { path, directory } = await document();
  const calls: string[][] = [];
  const native = async (args: string[]) => {
    calls.push(args);
  };
  const output = join(directory, "copy");
  expect(await createDocument({ from: path, output }, native)).toMatchObject({
    path: output + ".slop",
  });
  expect(calls).toEqual([["create", "--from", path, "--output", output + ".slop"]]);
  await expect(createDocument({ from: path, output: path }, native)).rejects.toMatchObject({
    code: "destination_exists",
  });
  await mkdir(join(path, "stores"));
  await writeFile(join(path, "stores/data.json"), '{"count":1}');
  await expect(createDocument({ from: path, output }, native)).rejects.toThrow("stores");
  expect(calls).toHaveLength(1);
});

test("opening uses an absolute document path and malformed packages never reach native", async () => {
  const { path } = await document();
  const calls: string[][] = [];
  await openDocument(path, async (args) => {
    calls.push(args);
  });
  expect(calls).toEqual([["open", resolve(path)]]);
  await writeFile(join(path, "manifest.json"), "invalid");
  await expect(
    openDocument(path, async (args) => {
      calls.push(args);
    }),
  ).rejects.toThrow();
  expect(calls).toHaveLength(1);
});

test("catalog master protection follows ancestor symlinks", async () => {
  const directory = await root();
  const previous = process.env.HITSLOP_TEMPLATES_ROOT;
  process.env.HITSLOP_TEMPLATES_ROOT = join(directory, "templates");
  try {
    await mkdir(process.env.HITSLOP_TEMPLATES_ROOT);
    await symlink(process.env.HITSLOP_TEMPLATES_ROOT, join(directory, "alias"));
    await expect(
      assertDocumentDestination(join(directory, "alias", "new", "test.slop")),
    ).rejects.toMatchObject({ code: "managed_template" });
    await expect(
      assertDocumentDestination(join(directory, "writable", "test.slop")),
    ).resolves.toBeUndefined();
  } finally {
    if (previous === undefined) delete process.env.HITSLOP_TEMPLATES_ROOT;
    else process.env.HITSLOP_TEMPLATES_ROOT = previous;
  }
});

test.each([
  { args: ["create"] },
  { args: ["inspect", "/missing/document.slop"] },
  { args: ["unknown-command"] },
])("CLI returns one JSON error envelope: $args", async ({ args }) => {
  const child = Bun.spawn(
    [process.execPath, resolve(import.meta.dir, "../src/cli.ts"), ...args, "--json"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [out] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(await child.exited).toBe(1);
  expect(JSON.parse(out)).toMatchObject({
    ok: false,
    error: { message: expect.any(String), code: expect.any(String) },
  });
});

test("inspect and open preserve malformed editable JSON while exposing diagnostics", async () => {
  const { path } = await document();
  await mkdir(join(path, "stores"));
  await writeFile(join(path, "stores/data.json"), "{unfinished");
  const inspected = await inspectDocument(path);
  expect(inspected.dataExists).toBe(true);
  expect(inspected.dataError).not.toBeNull();
  let opened = false;
  await openDocument(path, async () => {
    opened = true;
  });
  expect(opened).toBe(true);
});

test("inspect separates version metadata from application data", async () => {
  const { path } = await document();
  await mkdir(join(path, "stores"));
  await mkdir(join(path, "state"));
  await writeFile(join(path, "state/document.sqlite"), "fixture");
  await writeFile(
    join(path, "stores/data.json"),
    JSON.stringify({
      $slop: {
        format: 2,
        documentId: "doc",
        schemaHash: "hash",
        authority: "epoch",
        baseRevision: 0,
      },
      data: { title: "Hello" },
    }),
  );
  const inspected = await inspectDocument(path);
  expect(inspected.data).toEqual({ title: "Hello" });
  expect(inspected.envelope).toEqual({
    format: 2,
    documentId: "doc",
    schemaHash: "hash",
    authority: "epoch",
    baseRevision: 0,
  });
  expect(inspected.editing).toBe("versioned-json");
});
