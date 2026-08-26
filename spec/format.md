# `.slop` format v2

A `.slop` is a macOS Finder document package: a directory presented as one shareable file. Its authoritative contents are one SQLite database.

```text
Silo Wall.slop/
  document.sqlite
  document.sqlite-wal    # may exist only while a writer has the document open
  document.sqlite-shm
```

The package must use the `.slop` extension and contain `document.sqlite` at its root.

```sql
PRAGMA application_id = 0x534C4F50;  -- ASCII 'SLOP'
PRAGMA user_version   = 2;
PRAGMA journal_mode   = WAL;
PRAGMA foreign_keys   = ON;
```

There is no Save operation in the format. Each mutation is committed to SQLite immediately. Writers should checkpoint before closing, duplicating, or transferring a package.

## Reserved tables

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

| Table | Purpose |
|---|---|
| `slop_meta` | Identity, presentation hints, revision, and provenance. |
| `slop_view` | Renderable bodies keyed by a URL-like path. `/` is the main HTML view. |
| `slop_docs` | In-document prose for people and agents. A `readme` topic is strongly recommended. |
| `slop_assets` | Optional images, fonts, and cached output. |

All other tables, indexes, triggers, and views belong to the individual document. That domain schema is intentionally open-ended.

## Standard metadata

Values are stored as SQLite values but hosts must accept their string representations.

| Key | Meaning | Typical/default value |
|---|---|---|
| `format` | Format identifier | `slop/2` |
| `document_id` | Stable UUID for this document instance | UUID |
| `template_id` | Optional template provenance | `habit-tracker` |
| `title` | Finder/window title | `Untitled` |
| `summary` | Short picker/preview description | empty |
| `width`, `height` | Initial content size in points | `430`, `620` |
| `min_width`, `min_height` | Minimum resizable content size | `340`, `360` |
| `corner_radius` | Frameless window corner radius | `22` |
| `always_on_top` | Whether the host begins at floating level | `0` |
| `created_at`, `modified_at` | ISO-8601 timestamps | current time |
| `revision` | Monotonic document mutation counter | `0` |
| `preview_revision` | Revision represented by the cached preview | `-1` |

Hosts may ignore presentation keys they do not support. Unknown metadata must be preserved.

## Main view and assets

The native host renders `slop_view` where `path = '/'` and `mime = 'text/html'`. The HTML may reference the injected `/slop.js` runtime:

```js
const rows = await slop.query("SELECT * FROM habits ORDER BY position", []);

await slop.exec(
  "UPDATE habits SET name = ? WHERE id = ?",
  ["Morning walk", 1]
);

await slop.transaction([
  { sql: "UPDATE recipe SET title = ? WHERE id = 1", params: ["Dinner"] },
  { sql: "DELETE FROM ingredients WHERE id = ?", params: [4] }
]);

const meta = await slop.meta();
image.src = slop.assetURL("photo.png");
const unsubscribe = slop.onChange(({ revision }) => render());
await slop.ready();
```

`slop.query` returns an array of objects keyed by column name. `slop.exec` and every statement in `slop.transaction` accept positional `?` parameters. Blob values cross the bridge as `{ "$blob": "<base64>" }`.

`slop_assets.path` is normalized with a leading slash. `slop.assetURL("photo.png")` resolves `/photo.png`. The reserved `/preview.png` asset is a cached rendering of the current view. Hosts also write that PNG to `QuickLook/Thumbnail.png` and `QuickLook/Preview.png` inside the package and set the Finder custom icon, because Quick Look extensions alone do not reliably replace a package's icon. `preview_revision` records which document revision the cached image represents. It is derived data, not the source of truth.

## Mutation and observation

The native host and CLI wrap writes in `BEGIN IMMEDIATE` transactions. A successful logical mutation increments `slop_meta.revision` and updates `modified_at`. Multi-statement UI changes should use `slop.transaction` so they commit atomically and increment once.

An open host observes external WAL changes, reads `revision`, and dispatches a `slop:change` event. Clients must re-query the facts they display instead of attempting to replay the SQL.

Direct `sqlite3` writes are valid, but callers that want dependable observation should also update `revision` and `modified_at` in the same transaction. The `slop exec` CLI handles this automatically.

## Duplication and sharing

A correct duplicate is a SQLite backup, not a recursive copy of files that may have an active WAL. The duplicate must receive:

- a new `document_id`;
- new `created_at` and `modified_at` timestamps;
- `revision = 0` and `preview_revision = -1`;
- a title matching the destination unless explicitly supplied.

The app and `slop duplicate` implement this behavior. Closed, checkpointed packages are self-contained and may be copied or shared normally.

## Compatibility policy

Version 2 is the fresh prototype contract. There is no v1 migration or backward-compatibility requirement. A host must reject a database whose `application_id` is not `SLOP`; future incompatible schema changes increment `user_version`.
