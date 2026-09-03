# Storage

A slop can use JSON, SQLite, named media, any combination, or none. Storage does
not appear in the manifest and is created lazily in the writable document.

## JSON

Use JSON for small object graphs and settings. `open(initial)` creates
`stores/data.json` only when needed and returns a revision. Writes replace the
whole value atomically; pass the last revision to avoid silently overwriting a
newer external change.

Svelte's `jsonStore` requires an attached Zod schema, validates values at the
persistence boundary, surfaces loading/error state, and subscribes to host
changes. React's `useJsonStore` retains its current API. Design a JSON value with
explicit defaults and keep it backward-readable when adding fields.

## SQLite

Use SQLite for collections, querying, ordering, and multi-step updates. Schema
creation should be idempotent. Parameterize values and use the exported
`sql` tag where it improves readability. Send every related mutation in one
`transaction`; the host keeps that transaction on one connection.

WAL and SHM files are host-owned transient sidecars. Never put them in source,
templates, published artifacts, or backups captured while the database is live.
The host snapshots SQLite safely when duplicating or coordinating a document.

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

An app may ship immutable theme defaults in `assets/theme.css`. A writable
document may add `stores/theme.css` containing partial `--slop-*` overrides.
The host loads it after the default, watches it with the other stores on macOS,
and replaces the stylesheet without reloading the page.

Both files contain exactly one `:root` declaration block. The default defines
the complete public contract; the override may only use a subset of those
names. Structural selectors remain compiled into `app.html` and are not part of
the editable theme surface.

## iCloud

On iOS, documents live in the user's iCloud container. The runtime operates on
a coordinated working copy and explicitly flushes canonical JSON, SQLite,
media, and theme stores back to iCloud. Coordination errors are user-visible
and must not be treated as a successful save.
