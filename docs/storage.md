# Storage

A slop can use JSON, SQLite, named media, any combination, or none. Storage does
not appear in the manifest and is created lazily in the writable document.

## JSON

Use JSON for small object graphs and settings. `open(initial)` creates
`stores/data.json` only when needed and returns a revision. Writes replace the
whole value atomically; pass the last revision to avoid silently overwriting a
newer external change.

Quick Checklist uses a plain TypeBox schema in root `schema.ts`, passed to
`jsonStore({ schema: checklistSchema, initial })`. The builder serializes that
schema to `data.schema.json`; Vite handles ordinary schema imports with no custom
validator plugin. The Svelte store infers its data type and uses TypeBox's
non-compiling validator on initial, loaded, external, and outgoing values.
Validation does not coerce, insert defaults, or strip fields. Use
`additionalProperties: true` to preserve unknown fields. Values must be plain JSON.
The native store validates the packaged schema on reads and writes, including
formats. Shared fixtures check TypeBox and Swift behavior. Ajv remains only in
tooling to check packaged JSON Schema validity. The CLI counter starter uses this same workflow. Backlog examples are
not migrated; there is no Zod compatibility path.

Both adapters expose `flush()`, `isDirty`, and `isSaving`. A flush snapshots
pending edits and waits for persistence; explicit reload discards local edits.
Revision conflicts use whole-document local-wins semantics: read the new
revision and retry once, then retain dirty state and report a save error.
There is no automatic merge. Atomic replacement is not a cross-process lock
against arbitrary external writers.

The macOS host flushes guest writes before normal close, quit, duplicate, and
export. A failed save keeps the document open. A damaged JSON store is reported
by the guest; opening the app shell does not replace it with initial data.

## SQLite

Use SQLite for collections, querying, ordering, and multi-step updates. Schema
creation should be idempotent. Parameterize values and use the exported
`sql` tag where it improves readability. Send every related mutation in one
`transaction`; the host keeps that transaction on one connection.

WAL and SHM files are host-owned transient sidecars. Never put them in source,
templates, published artifacts, or backups captured while the database is live.
The host snapshots SQLite safely when duplicating or coordinating a document.
Guest SQL runs on a serial storage worker. The authorizer reserves connection
and transaction control for the host. Queries return at most 10,000 rows / 16 MiB
and SQL execution has a two-second progress budget (lock waits may take up to
five seconds). Exceeding a limit rejects the operation without truncated results.
Numbers must fit the JavaScript safe range; cast larger database integers to
TEXT when reading. Blobs use `{ "$blob": "base64" }` in both directions.

## Named media

Named media is for a small, known set of user-selected files such as
`recipe-photo` or `ambient-rain`. The image/file adapters validate names and
hand content to the host. The host content-sniffs supported images and bounded
ZIP archives, then atomically replaces the named entry under `stores/media/`.

Do not use named media as an arbitrary filesystem, and do not persist browser
blob URLs. Re-open media through the adapter after host change notifications.

## Development and copies

`slop dev` supplies disposable in-memory JSON and forgiving SQLite/media stubs
for UI iteration. It performs no storage I/O, and a full page reload resets its
state. A build never copies authoring data.

Installing writes an immutable local catalog master. Opening or selecting it
creates a writable copy at a user-selected path. Personal state always belongs
to the copy, never the master.

## Theme overrides

Quick Checklist defines its theme in root `theme.ts` using `defineTheme` from
`@hitslop/runtime/theme`. This definition provides `theme.vars` to
vanilla-extract and generates immutable `assets/theme.css` during build.
Plain authored `assets/theme.css` is also supported; do not define both.
A writable
document may add `stores/theme.css` containing partial `--slop-*` overrides.
The host loads it after the default, watches it with the other stores on macOS,
and replaces the stylesheet without reloading the page.

Both files contain exactly one `:root` declaration block. The default defines
the complete public contract; the override may only use a subset of those
names. Structural selectors remain compiled into `app.html` and are not part of
the editable theme surface.
The native host validates overrides before applying them. Invalid overrides
retain the previous valid stylesheet, or use defaults on first open. Removing
the override restores defaults. Invalid mutable theme contents never block opening.

## iCloud

On iOS, documents live in the user's iCloud container. The runtime operates on
a coordinated working copy and explicitly flushes canonical JSON, SQLite,
media, and theme stores back to iCloud. Coordination errors are user-visible
and must not be treated as a successful save.
