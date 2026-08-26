# `.slop` format v1

A `.slop` is a **Finder document package** (a directory that looks like a file). The document *is* the SQLite database inside it:

```
Silo Wall.slop/              # right-click → Show Package Contents
  document.sqlite            # application_id = 'SLOP'
  document.sqlite-wal        # only while the document is open
  document.sqlite-shm
```

Copy the `.slop` folder to share it (after close, the WAL is checkpointed away). `sqlite3 Silo Wall.slop/document.sqlite` to query it.

```
PRAGMA application_id = 0x534C4F50;  -- 'SLOP'
PRAGMA user_version   = 1;
PRAGMA journal_mode   = WAL;
```

## Reserved tables

| Table | Role |
|---|---|
| `slop_meta` | key/value identity (`title`, `width`, `height`, `created_at`, …) |
| `slop_view` | HTML (and other) bodies the host renders, keyed by `path` |
| `slop_docs` | prose for humans and AIs describing the schema and how to use it |
| `slop_assets` | optional blobs (`path`, `mime`, `body`) |

Everything else is the document’s own domain (`routes`, `expenses`, …). Those tables **are** the schema. Computed facts are `VIEW`s.

```sql
CREATE TABLE slop_meta (
  key   TEXT PRIMARY KEY,
  value ANY
);

CREATE TABLE slop_view (
  path TEXT PRIMARY KEY,
  mime TEXT NOT NULL DEFAULT 'text/html',
  body TEXT NOT NULL
);

CREATE TABLE slop_docs (
  topic TEXT PRIMARY KEY,
  body  TEXT NOT NULL
);

CREATE TABLE slop_assets (
  path TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  body BLOB NOT NULL
);
```

The host loads `slop_view` where `path = '/'`. It injects a tiny JS runtime:

```js
await slop.query(sql, params?)  // SELECT → rows
await slop.exec(sql, params?)   // INSERT/UPDATE/DELETE/DDL
slop.onChange(cb)               // fired on any commit, including ones from sqlite3
```

Writes go to **this file**. There is no other store.

## Stripping

`slop_docs` and `slop_assets` are optional. Delete + `VACUUM` and the document still opens. Domain tables and `slop_view` are load-bearing.

## Authoring sources

A directory packs to a `.slop`:

```
my-doc/
  meta.json      # title, width, height, …
  schema.sql     # domain tables, views, seed rows
  view.html      # the UI (self-contained HTML)
  docs.md        # becomes slop_docs.topic = 'readme'
  assets/        # optional files → slop_assets
```

`slop pack my-doc/` writes `my-doc.slop`.
