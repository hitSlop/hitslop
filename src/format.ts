/** 'SLOP' as a SQLite application_id (big-endian, offset 68). */
export const SLOP_APPLICATION_ID = 0x534c4f50;
export const SLOP_USER_VERSION = 1;

export const RESERVED_TABLES = [
  "slop_meta",
  "slop_view",
  "slop_docs",
  "slop_assets",
] as const;

export const CORE_DDL = `
CREATE TABLE IF NOT EXISTS slop_meta (
  key   TEXT PRIMARY KEY,
  value ANY
);

CREATE TABLE IF NOT EXISTS slop_view (
  path TEXT PRIMARY KEY,
  mime TEXT NOT NULL DEFAULT 'text/html',
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slop_docs (
  topic TEXT PRIMARY KEY,
  body  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slop_assets (
  path TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  body BLOB NOT NULL
);
`;
