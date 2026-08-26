import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { CORE_DDL } from "./format.ts";
import { closeDocument, openSlop, stamp } from "./db.ts";
import { DOCUMENT_SQLITE, resolveDocument } from "./paths.ts";

function mimeFor(file: string): string {
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      const s = await stat(full);
      if (s.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(root);
  return out;
}

/** Pack an authoring folder into a .slop package directory containing document.sqlite. */
export async function pack(dir: string, out?: string): Promise<string> {
  const src = dir.replace(/\/$/, "");
  const dest = out ?? `${src}.slop`;

  const view = await readFile(join(src, "view.html"), "utf8");
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(await readFile(join(src, "meta.json"), "utf8"));
  } catch {
    meta = { title: src.split("/").pop() };
  }
  let schema = "";
  try {
    schema = await readFile(join(src, "schema.sql"), "utf8");
  } catch {
    schema = "";
  }
  let docs = "";
  try {
    docs = await readFile(join(src, "docs.md"), "utf8");
  } catch {
    docs = "";
  }

  await mkdir(dirname(dest), { recursive: true });
  await rm(dest, { recursive: true, force: true });
  await rm(`${dest}-wal`, { force: true });
  await rm(`${dest}-shm`, { force: true });
  await mkdir(dest, { recursive: true });

  const sqlitePath = join(dest, DOCUMENT_SQLITE);
  const db = openSlop(sqlitePath, { create: true });
  stamp(db);
  db.exec(CORE_DDL);

  const putMeta = db.query("INSERT INTO slop_meta(key, value) VALUES (?, ?)");
  const defaults: Record<string, unknown> = {
    title: "Untitled",
    width: 420,
    height: 720,
    created_at: new Date().toISOString(),
    format: "slop/1",
    ...meta,
  };
  for (const [key, value] of Object.entries(defaults)) {
    putMeta.run(key, value == null ? "" : String(value));
  }

  db.query("INSERT INTO slop_view(path, mime, body) VALUES (?, ?, ?)").run(
    "/",
    "text/html",
    view,
  );

  if (docs.trim()) {
    db.query("INSERT INTO slop_docs(topic, body) VALUES (?, ?)").run("readme", docs);
  }

  if (schema.trim()) {
    db.exec(schema);
  }

  const assetsDir = join(src, "assets");
  const putAsset = db.query(
    "INSERT INTO slop_assets(path, mime, body) VALUES (?, ?, ?)",
  );
  for (const file of await walkFiles(assetsDir)) {
    const rel = relative(assetsDir, file).split("\\").join("/");
    const buf = await readFile(file);
    putAsset.run(`/${rel}`, mimeFor(file), buf);
  }

  closeDocument(db, sqlitePath);
  return dest;
}

/** Update only the HTML view, keep domain data. Used by `slop dev`. */
export async function refreshView(slopPath: string, html: string): Promise<void> {
  const db = openSlop(resolveDocument(slopPath));
  db.query(
    `INSERT INTO slop_view(path, mime, body) VALUES (?, 'text/html', ?)
     ON CONFLICT(path) DO UPDATE SET body = excluded.body`,
  ).run("/", html);
  closeDocument(db, resolveDocument(slopPath));
}
