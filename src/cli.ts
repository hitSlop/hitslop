#!/usr/bin/env bun
import { resolve, join } from "node:path";
import { existsSync, statSync } from "node:fs";
import { readFile, watch as watchFs } from "node:fs/promises";
import { checkpoint, exec, openDocument, query } from "./db.ts";
import { pack, refreshView } from "./pack.ts";
import { serveSlop } from "./serve.ts";
import { openApp } from "./open.ts";
import { createSlop } from "./create.ts";
import { SLOP_APPLICATION_ID } from "./format.ts";
import { isAuthoringDir, isSlopPackage, resolveDocument } from "./paths.ts";

const HELP = `slop — local-first mini-docs (.slop is a package; document.sqlite inside)

  slop pack  <dir> [out.slop]     Pack schema.sql + view.html into a .slop package
  slop open  <file.slop|dir>      Open in HitSlop.app (Finder-double-clickable)
  slop serve <file.slop> [--port] HTTP only (tests / browsers)
  slop query <file.slop> <sql>    Run a SELECT
  slop exec  <file.slop> <sql>    Run INSERT/UPDATE/DELETE/DDL
  slop schema <file.slop>         Print sqlite_schema
  slop dump  <file.slop>          SQL dump (shareable as text)
  slop create "<prompt>" [out]    LLM-generate a unique .slop (needs XAI_API_KEY)

A .slop is a Finder package. Right-click → Show Package Contents → document.sqlite.
Clicks COMMIT to that file. sqlite3 on document.sqlite shows up live.
`;

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i >= 0) return args[i + 1];
}

/** Authoring dir → pack. Package or sqlite → that path. */
async function asPackage(input: string): Promise<string> {
  const path = resolve(input);
  if (!existsSync(path)) die(`not found: ${path}`);
  const st = statSync(path);
  if (st.isDirectory() && isAuthoringDir(path)) return pack(path);
  if (st.isDirectory() && isSlopPackage(path)) return path;
  if (st.isFile()) return path;
  die(`${path} is not a .slop package or authoring folder`);
}

function openDb(packageOrFile: string) {
  return openDocument(packageOrFile);
}

async function cmdPack(args: string[]) {
  const dir = args[0];
  if (!dir) die("usage: slop pack <dir> [out.slop]");
  const out = await pack(resolve(dir), args[1] && resolve(args[1]));
  console.log(out);
}

async function cmdServe(args: string[]) {
  const file = args.find((a) => !a.startsWith("--")) ?? args[0];
  if (!file) die("usage: slop serve <file.slop> [--port N]");
  const port = arg(args, "--port") ? Number(arg(args, "--port")) : 0;
  const pkg = await asPackage(file);
  const sqlitePath = resolveDocument(pkg);
  const db = openDocument(pkg);
  const id = (db.query("PRAGMA application_id").get() as { application_id: number })
    .application_id;
  if (id !== SLOP_APPLICATION_ID) {
    console.error(
      `warning: ${pkg} application_id is ${id}, expected ${SLOP_APPLICATION_ID} (SLOP)`,
    );
  }
  const served = await serveSlop({ db, slopPath: sqlitePath, port });
  const shutdown = () => {
    try {
      checkpoint(db);
    } catch {
      /* ok */
    }
    served.stop();
    db.close();
  };
  process.on("SIGINT", () => {
    shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    shutdown();
    process.exit(0);
  });
  const meta = served.meta;
  console.log(`${meta.title ?? pkg}`);
  console.log(served.url);
  console.log(`package\t${pkg}`);
  console.log(`sqlite\t${sqlitePath}`);
  await new Promise(() => {});
}

async function watchDir(dir: string, pkg: string) {
  const viewPath = join(dir, "view.html");
  try {
    const watcher = watchFs(dir);
    for await (const event of watcher) {
      if (!event.filename) continue;
      if (event.filename === "view.html" || event.filename.endsWith(".html")) {
        try {
          const html = await readFile(viewPath, "utf8");
          await refreshView(pkg, html);
        } catch (err) {
          console.error("refresh failed:", err);
        }
      }
    }
  } catch {
    /* watch unsupported */
  }
}

async function cmdOpen(args: string[]) {
  const file = args[0];
  if (!file) die("usage: slop open <file.slop|dir>");
  const input = resolve(file);
  const pkg = await asPackage(file);
  const kind = await openApp(pkg);
  console.log(pkg);
  console.log(`window\t${kind}`);
  if (statSync(input).isDirectory() && isAuthoringDir(input)) {
    watchDir(input, pkg);
    console.log(`watching ${input} for view.html`);
    await new Promise(() => {});
    return;
  }
}

async function cmdQuery(args: string[]) {
  const file = args[0];
  const sql = args.slice(1).join(" ");
  if (!file || !sql) die("usage: slop query <file.slop> <sql>");
  const db = openDb(resolve(file));
  const { rows } = query(db, sql);
  checkpoint(db);
  db.close();
  console.log(JSON.stringify(rows, null, 2));
}

async function cmdExec(args: string[]) {
  const file = args[0];
  const sql = args.slice(1).join(" ");
  if (!file || !sql) die("usage: slop exec <file.slop> <sql>");
  const db = openDb(resolve(file));
  const result = exec(db, sql);
  checkpoint(db);
  db.close();
  console.log(JSON.stringify(result));
}

async function cmdSchema(args: string[]) {
  const file = args[0];
  if (!file) die("usage: slop schema <file.slop>");
  const db = openDb(resolve(file));
  const { rows } = query(
    db,
    "SELECT type, name, sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type, name",
  );
  db.close();
  for (const row of rows) {
    console.log(`-- ${row.type} ${row.name}`);
    console.log(String(row.sql));
    console.log();
  }
}

async function cmdDump(args: string[]) {
  const file = args[0];
  if (!file) die("usage: slop dump <file.slop>");
  const db = openDb(resolve(file));
  const tables = query(
    db,
    "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name",
  ).rows as { name: string }[];
  console.log(`PRAGMA application_id = ${SLOP_APPLICATION_ID};`);
  console.log("PRAGMA user_version = 1;");
  for (const { name } of tables) {
    const ddl = query(
      db,
      "SELECT sql FROM sqlite_schema WHERE name = ? AND sql IS NOT NULL",
      [name],
    ).rows[0] as { sql: string } | undefined;
    if (ddl?.sql) console.log(`${ddl.sql};`);
    const rows = query(db, `SELECT * FROM "${name.replaceAll('"', '""')}"`).rows;
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => sqlLiteral(row[c]));
      console.log(
        `INSERT INTO "${name.replaceAll('"', '""')}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")});`,
      );
    }
  }
  checkpoint(db);
  db.close();
}

function sqlLiteral(v: unknown): string {
  if (v == null) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString("hex")}'`;
  return `'${String(v).replaceAll("'", "''")}'`;
}

async function cmdCreate(args: string[]) {
  const prompt = args[0];
  if (!prompt) die('usage: slop create "a climbing gym visit log" [out.slop]');
  const out = args[1] && resolve(args[1]);
  process.stderr.write("generating…\n");
  const { path, doc } = await createSlop({ prompt, out });
  console.log(path);
  console.log(doc.title);
}

const [cmd, ...rest] = Bun.argv.slice(2);
switch (cmd) {
  case "pack":
    await cmdPack(rest);
    break;
  case "open":
    await cmdOpen(rest);
    break;
  case "serve":
    await cmdServe(rest);
    break;
  case "query":
    await cmdQuery(rest);
    break;
  case "exec":
    await cmdExec(rest);
    break;
  case "schema":
    await cmdSchema(rest);
    break;
  case "dump":
    await cmdDump(rest);
    break;
  case "create":
    await cmdCreate(rest);
    break;
  case "-h":
  case "--help":
  case "help":
  case undefined:
    process.stdout.write(HELP);
    break;
  default:
    die(`unknown command: ${cmd}\n\n${HELP}`);
}
