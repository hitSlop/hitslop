import { unlinkSync } from "node:fs";
import { Database } from "bun:sqlite";
import { SLOP_APPLICATION_ID, SLOP_USER_VERSION } from "./format.ts";
import { assertSafeSql } from "./sql-guard.ts";
import { resolveDocument } from "./paths.ts";

export function openSlop(path: string, opts: { create?: boolean } = {}): Database {
  const db = new Database(path, { create: opts.create ?? false, strict: true });
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  return db;
}

/** Open a .slop package directory or a bare sqlite file. */
export function openDocument(path: string): Database {
  return openSlop(resolveDocument(path));
}

export function stamp(db: Database): void {
  db.exec(`PRAGMA application_id = ${SLOP_APPLICATION_ID}`);
  db.exec(`PRAGMA user_version = ${SLOP_USER_VERSION}`);
}

export function readMeta(db: Database): Record<string, string> {
  const rows = db.query("SELECT key, value FROM slop_meta").all() as {
    key: string;
    value: unknown;
  }[];
  const meta: Record<string, string> = {};
  for (const row of rows) meta[row.key] = row.value == null ? "" : String(row.value);
  return meta;
}

export function query(
  db: Database,
  sql: string,
  params: unknown[] = [],
): { columns: string[]; rows: Record<string, unknown>[] } {
  assertSafeSql(sql);
  const stmt = db.query(sql);
  const raw = stmt.all(...params) as Record<string, unknown>[];
  const columns = raw[0] ? Object.keys(raw[0]) : [];
  return { columns, rows: raw };
}

export function exec(
  db: Database,
  sql: string,
  params: unknown[] = [],
): { changes: number; lastInsertRowid: number } {
  assertSafeSql(sql);
  const stmt = db.query(sql);
  const result = stmt.run(...params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

export function getView(db: Database, path = "/"): { mime: string; body: string } | undefined {
  return db
    .query("SELECT mime, body FROM slop_view WHERE path = ?")
    .get(path) as { mime: string; body: string } | undefined;
}

export function getAsset(
  db: Database,
  path: string,
): { mime: string; body: Uint8Array } | undefined {
  const row = db
    .query("SELECT mime, body FROM slop_assets WHERE path = ?")
    .get(path) as { mime: string; body: Uint8Array } | undefined;
  return row;
}

export function checkpoint(db: Database): void {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
}

/** Checkpoint, close, and drop WAL sidecars so the package is one sqlite file. */
export function closeDocument(db: Database, sqlitePath: string): void {
  try {
    checkpoint(db);
  } catch {
    /* ok */
  }
  db.close();
  for (const side of [`${sqlitePath}-wal`, `${sqlitePath}-shm`]) {
    try {
      unlinkSync(side);
    } catch {
      /* still open elsewhere */
    }
  }
}

export function isSlop(path: string): boolean {
  try {
    const db = new Database(resolveDocument(path), { readonly: true });
    const id = (db.query("PRAGMA application_id").get() as { application_id: number })
      .application_id;
    db.close();
    return id === SLOP_APPLICATION_ID;
  } catch {
    return false;
  }
}
