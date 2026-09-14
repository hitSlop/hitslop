import { DocumentEngine } from "../../sync/src/document";
import { FileDocumentIO } from "../../sync/src/storage";
import checklistSchema from "../../../examples/slops/quick-checklist/schema";
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { zipSync } from "fflate";
import { encode } from "fast-png";
import { manifestSchemaURL } from "@hitslop/schema";
import { sha256 } from "../src/project.ts";
import { makePackageWritable } from "../src/install.ts";

const enabled = process.platform === "darwin" && Boolean(process.env.HITSLOP_NATIVE_TESTS);
(enabled ? test : test.skip)("native catalog creation verifies downloads, reuses cache, and exports edited checklist data", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-native-documents-"));
  const templates = join(root, "templates");
  const native = process.env.HITSLOP_NATIVE_CLI ?? resolve(import.meta.dir, "../../../apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
  const cli = resolve(import.meta.dir, "../src/cli.ts");
  const command = async (args: string[]) => {
    const child = Bun.spawn([process.execPath, cli, ...args, "--json"], { env: { ...process.env, HITSLOP_NATIVE_CLI: native, HITSLOP_TEMPLATES_ROOT: templates }, stdout: "pipe", stderr: "pipe" });
    const [out, err] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const code = await child.exited;
    if (!out.trim()) throw new Error(JSON.stringify({ args, code, err }));
    return { code, body: JSON.parse(out), err };
  };
  const manifest = { $schema: manifestSchemaURL, slug: "fixture", title: "Fixture", description: "Native fixture", categories: ["utilities"], author: { name: "Test" }, presentation: { width: 320, height: 240 } };
  const png = (size: number) => encode({ width: size, height: size, channels: 4, data: new Uint8Array(size * size * 4).fill(255) });
  const archive = zipSync({ "manifest.json": new TextEncoder().encode(JSON.stringify(manifest)), "app.html": new TextEncoder().encode("<main>Fixture</main>"), "QuickLook/Preview.png": png(320), "QuickLook/Icon.png": png(512) });
  const hash = sha256(archive);
  const publisher = "a".repeat(32);
  let downloads = 0;
  let bad = false;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const url = new URL(request.url);
    const digest = bad ? "b".repeat(64) : hash;
    const asset = { url: `${url.origin}/api/artifact?key=artifacts%2Fsha256%2F${digest}.slop.zip`, bytes: archive.byteLength, sha256: digest };
    if (url.pathname === "/api/catalog") return Response.json({ version: 1, nextCursor: null, templates: [{ ...manifest, id: `${publisher}_fixture`, creationCount: 0, release: { number: bad ? 2 : 1, publishedAt: "2026-01-01T00:00:00Z" }, preview: asset, icon: asset, download: asset, $schema: undefined, presentation: undefined }] });
    downloads++;
    return new Response(archive);
  } });
  try {
    const registry = server.url.origin;
    const found = await command(["catalog", "search", "fixture", "--registry", registry]);
    expect(found.body.result.templates).toHaveLength(1);
    for (const name of ["first", "second"]) {
      const created = await command(["create", `${publisher}_fixture`, "--registry", registry, "--output", join(root, `${name}.slop`)]);
      expect({ code: created.code, err: created.err }).toEqual({ code: 0, err: "" });
    }
    expect(downloads).toBe(1);
    expect((await command(["create", `${publisher}_fixture`, "--registry", registry, "--output", join(root, "first.slop")])).body.error.code).toBe("destination_exists");
    bad = true;
    const rejected = await command(["create", `${publisher}_fixture`, "--registry", registry, "--output", join(root, "bad.slop")]);
    expect(rejected.code).toBe(1);
    expect(rejected.err).toContain("checksum mismatch");
    expect(await stat(join(root, "bad.slop")).then(() => true).catch(() => false)).toBe(false);
    const source = resolve(import.meta.dir, "../../../examples/slops/quick-checklist/dist/quick-checklist.slop");
    const checklist = join(root, "Checklist.slop");
    const created = await command(["create", "--from", source, "--output", checklist]);
    expect({ code: created.code, err: created.err }).toEqual({ code: 0, err: "" });
    expect((await command(["inspect", checklist])).body.result.dataExists).toBe(false);
    const data = {title: "CLI checklist", tasks: [{id: "task-1", text: "Verify export", done: false, archived: false}]};
    await DocumentEngine.open({schema: checklistSchema, initial: data, io: await FileDocumentIO.at(checklist)});
    expect((await command(["validate", checklist])).code).toBe(0);
    const pdf = join(root, "checklist.pdf");
    const exported = await command(["export", checklist, "--format", "pdf", "--output", pdf]);
    expect({ code: exported.code, err: exported.err }).toEqual({ code: 0, err: "" });
    expect((await readFile(pdf)).subarray(0, 5).toString()).toBe("%PDF-");
    expect(JSON.parse(await readFile(join(checklist, "stores/data.json"), "utf8")).data).toEqual(data);
    expect((await command(["inspect", checklist])).body.result.data.title).toBe("CLI checklist");
    const cached = join(templates, "cache", publisher, "fixture", "1.slop");
    expect((await stat(cached)).mode & 0o222).toBe(0);
    expect(await readdir(cached)).not.toContain("stores");
  } finally {
    server.stop(true);
    await makePackageWritable(root);
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
