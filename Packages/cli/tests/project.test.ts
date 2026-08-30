import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { buildSlop, loadManifest } from "../src/project.ts";
import { Database } from "bun:sqlite";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(width = 240, height = 180, channels = 4): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "hitslop-mask-")); roots.push(root);
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "manifest.json"), JSON.stringify({
    slug: "masked-test", title: "Masked Test", description: "A masked window validation fixture.",
    author: { name: "Test" }, categories: ["Widgets"], stores: {},
    window: { width: 240, height: 180, resizable: false, shape: { kind: "imageMask", path: "assets/window-mask.png" } },
  }));
  const data = new Uint8Array(width * height * channels).fill(255);
  await writeFile(join(root, "assets/window-mask.png"), encode({ width, height, channels, data }));
  return root;
}

describe("imageMask validation", () => {
  test("accepts a decoded RGBA mask with exact manifest dimensions", async () => {
    await expect(loadManifest(await fixture())).resolves.toMatchObject({ window: { shape: { kind: "imageMask" } } });
  });

  test("rejects a mask with different pixel dimensions", async () => {
    await expect(loadManifest(await fixture(241, 180))).rejects.toThrow("exactly 240x180");
  });

  test("rejects a PNG without an explicit alpha channel", async () => {
    await expect(loadManifest(await fixture(240, 180, 3))).rejects.toThrow("explicit alpha");
  });
});

describe("store validation and snapshots", () => {
  test("rejects invalid JSON before build", async () => {
    const root = await mkdtemp(join(tmpdir(), "hitslop-json-")); roots.push(root);
    await mkdir(join(root, "stores"), { recursive: true });
    await writeFile(join(root, "manifest.json"), JSON.stringify({
      slug: "json-test", title: "JSON Test", description: "Tests JSON validation.", author: { name: "Test" }, categories: ["Widgets"],
      stores: { state: { kind: "json" } }, window: { width: 240, height: 180, shape: { kind: "roundedRect", radius: 20 } },
    }));
    await writeFile(join(root, "stores/state.json"), "{broken");
    await expect(loadManifest(root)).rejects.toThrow("valid UTF-8 JSON");
  });

  test("build snapshots committed WAL data without checkpointing the seed", async () => {
    const root = await mkdtemp(join(tmpdir(), "hitslop-sqlite-")); roots.push(root);
    await mkdir(join(root, "stores"), { recursive: true });
    await writeFile(join(root, "manifest.json"), JSON.stringify({
      slug: "sqlite-test", title: "SQLite Test", description: "Tests SQLite snapshots.", author: { name: "Test" }, categories: ["Widgets"],
      stores: { main: { kind: "sqlite" } }, window: { width: 240, height: 180, shape: { kind: "roundedRect", radius: 20 } },
    }));
    await writeFile(join(root, "index.html"), "<main>SQLite</main>");
    const source = join(root, "stores/main.sqlite");
    const database = new Database(source);
    database.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE notes (body TEXT); INSERT INTO notes VALUES ('saved')");
    const wal = `${source}-wal`;
    const before = (await stat(wal)).size;
    const built = await buildSlop(root);
    expect((await stat(wal)).size).toBe(before);
    const copy = new Database(join(built.directory, "stores/main.sqlite"), { readonly: true });
    expect(copy.query("SELECT body FROM notes").get()).toEqual({ body: "saved" });
    expect(copy.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "delete" });
    copy.close();
    database.close();
    expect((await readFile(join(built.directory, "app.html"), "utf8"))).toContain("SQLite");
  });
});
